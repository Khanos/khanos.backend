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

/** Upstash-compatible Redis REST; no provider provisioning or client-side credentials. */
export function createRedisCounter({ url, token, prefix, timeoutMs, fetchImpl = fetch }) {
  return {
    async consume(key, windowMs) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let reader;
      try {
        const hashed = createHash('sha256').update(key).digest('hex');
        const response = await fetchImpl(url, { method: 'POST', redirect: 'error', signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(['EVAL', COUNTER_SCRIPT, '1', `${prefix}:${hashed}`, String(windowMs)]),
        });
        if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) throw unavailable();
        reader = response.body.getReader();
        let size = 0;
        const chunks = [];
        let chunk = await reader.read();
        while (!chunk.done) {
          const { value } = chunk;
          size += value.byteLength;
          if (size > 4096) throw unavailable();
          chunks.push(Buffer.from(value));
          chunk = await reader.read();
        }
        const { result } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!Array.isArray(result) || result.length !== 2 || !Number.isSafeInteger(result[0]) || result[0] < 1 ||
            !Number.isSafeInteger(result[1]) || result[1] < 1 || result[1] > windowMs) throw unavailable();
        return { count: result[0], resetMs: result[1] };
      } catch {
        controller.abort();
        if (reader) await reader.cancel().catch(() => {});
        throw unavailable();
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export function createCounter(config) {
  return config.rateLimitStore === 'redis' ? createRedisCounter({
    url: config.rateLimitRedisUrl, token: config.rateLimitRedisToken,
    prefix: config.rateLimitPrefix, timeoutMs: config.rateLimitStoreTimeoutMs,
  }) : createMemoryCounter();
}
