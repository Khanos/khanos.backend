import { createHash } from 'node:crypto';

// One atomic Redis operation: fixed window starts with its first request and expires.
export const COUNTER_SCRIPT = 'local n=redis.call("INCR",KEYS[1]); if n==1 then redis.call("PEXPIRE",KEYS[1],ARGV[1]) end; return {n,redis.call("PTTL",KEYS[1])}';
const unavailable = () => new Error('Rate limit store unavailable');

/** Explicit single-process store only; entries and expiry scanning are bounded. */
export function createMemoryCounter({ now = Date.now, maxEntries = 50000 } = {}) {
  const counters = new Map();
  let lastCleanup = 0;
  return {
    async consume(key, windowMs) {
      const time = now();
      if (time - lastCleanup >= 1000) {
        for (const [name, entry] of counters) if (entry.reset <= time) counters.delete(name);
        lastCleanup = time;
      }
      let entry = counters.get(key);
      if (!entry || entry.reset <= time) {
        if (!entry && counters.size >= maxEntries) throw unavailable();
        entry = { count: 0, reset: time + windowMs };
        counters.set(key, entry);
      }
      entry.count += 1;
      return { count: entry.count, resetMs: entry.reset - time };
    },
  };
}

/** Native Redis adapter; connection ownership belongs to application startup. */
export function createRedisCounter({ client, prefix, timeoutMs, onTimeout }) {
  if (!client) throw unavailable();
  return {
    async consume(key, windowMs) {
      const controller = new AbortController();
      try {
        if (!client.isReady) throw unavailable();
        const hashed = createHash('sha256').update(key).digest('hex');
        const result = await withDeadline(() => client.withCommandOptions({
          abortSignal: controller.signal, timeout: timeoutMs,
        }).eval(COUNTER_SCRIPT, { keys: [`${prefix}:${hashed}`], arguments: [String(windowMs)] }), timeoutMs, onTimeout);
        // PTTL may legitimately be zero immediately before expiry.
        if (!Array.isArray(result) || result.length !== 2 || !Number.isSafeInteger(result[0]) || result[0] < 1 ||
            !Number.isSafeInteger(result[1]) || result[1] < 0 || result[1] > windowMs) throw unavailable();
        return { count: result[0], resetMs: result[1] };
      } catch { throw unavailable(); }
      finally { controller.abort(); }
    },
  };
}

// An application deadline also bounds replies already sent to Redis; abort alone only
// cancels queued node-redis commands. Never retry an uncertain increment.
export async function withDeadline(operation, timeoutMs, onTimeout) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise((resolve, reject) => {
      timer = setTimeout(() => { onTimeout?.(); reject(unavailable()); }, timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}

export function createCounter(config, client, onTimeout) {
  if (config.rateLimitStore === 'redis') return createRedisCounter({
    client, onTimeout, prefix: config.rateLimitPrefix, timeoutMs: config.rateLimitStoreTimeoutMs,
  });
  if (config.rateLimitStore !== 'memory') throw unavailable();
  return createMemoryCounter();
}
