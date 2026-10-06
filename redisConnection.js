import { createClient } from 'redis';
import { withDeadline } from './rateLimitStore.js';

/** One client per start/process, never opened by an app factory or request. */
export async function connectRedis(config, log, clientFactory = createClient) {
  let client;
  try {
    client = clientFactory({
      url: config.redisUrl,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 1000,
      socket: {
        connectTimeout: config.rateLimitStoreTimeoutMs,
        // Explicit opt-in for Heroku KVS self-signed certificates; TLS stays enabled.
        ...(config.redisUrl.startsWith('rediss:') ? { rejectUnauthorized: config.redisTlsRejectUnauthorized } : {}),
        // This lifecycle owns one bounded recovery loop, including handshakes.
        reconnectStrategy: false,
      },
    });
    // Never forward exception text (which can contain credentials).
    client.on('error', () => log({ event: 'redis', outcome: 'unavailable' }));
    await withDeadline(() => client.connect(), config.rateLimitStoreTimeoutMs);
    let closed = false;
    let reconnectTimer;
    let recoveryAttempts = 0;
    let recovering = false;
    const destroy = () => {
      closed = true;
      clearTimeout(reconnectTimer);
      // close() sets isOpen=false before pending replies drain. destroy() must
      // still run on timeout to release that socket; node-redis is idempotent.
      client.destroy();
    };
    const scheduleRecovery = () => {
      const delay = Math.min(250 * (2 ** Math.min(recoveryAttempts, 4)), 3000) + Math.floor(Math.random() * 250);
      recoveryAttempts += 1;
      reconnectTimer = setTimeout(async () => {
        reconnectTimer = undefined;
        if (closed) return;
        recovering = true;
        try {
          await withDeadline(() => client.connect(), config.rateLimitStoreTimeoutMs);
          recoveryAttempts = 0;
        } catch {
          if (closed) return;
          client.destroy();
          log({ event: 'redis', outcome: 'unavailable' });
          scheduleRecovery();
        } finally { recovering = false; }
      }, delay);
      reconnectTimer.unref();
    };
    // With native retries disabled, terminal socket failures request exactly
    // one recovery. Failed recovery attempts are handled by the loop itself.
    client.on('terminated', () => {
      if (!closed && !recovering && !reconnectTimer) scheduleRecovery();
    });
    return {
      client,
      isReady: () => client.isReady,
      destroy,
      // A reply deadline must also release the native pending-command queue.
      // Restart the SAME client in the background, once, with jitter. Requests
      // never create connections or retry their uncertain increment.
      restart() {
        if (closed || !client.isOpen) return;
        client.destroy();
        scheduleRecovery();
      },
      async close() {
        closed = true;
        clearTimeout(reconnectTimer);
        try {
          if (client.isOpen) await withDeadline(() => client.close(), config.rateLimitStoreTimeoutMs);
        } catch { throw new Error('Redis shutdown failed'); }
        finally { destroy(); }
      },
    };
  } catch {
    client?.destroy();
    throw new Error('Redis startup failed');
  }
}
