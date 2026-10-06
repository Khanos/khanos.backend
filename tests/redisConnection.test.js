import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { connectRedis } from '../redisConnection.js';
import { config } from './helpers/app.js';

const runtime = { ...config, redisUrl: 'rediss://:synthetic-private-secret@counter.example:12345', redisTlsRejectUnauthorized: false, rateLimitStoreTimeoutMs: 20 };
function fakeClient() {
  const client = new EventEmitter();
  client.isOpen = false; client.isReady = false;
  client.connect = jest.fn(async () => { client.isOpen = true; client.isReady = true; });
  client.close = jest.fn(async () => { client.isOpen = false; client.isReady = false; });
  client.destroy = jest.fn(() => { client.isOpen = false; client.isReady = false; });
  return client;
}
it('connects once, handles error events safely, and configures bounded queues/TLS/retries', async () => {
  const client = fakeClient(); const factory = jest.fn(() => client); const log = jest.fn();
  const resource = await connectRedis(runtime, log, factory);
  expect(client.connect).toHaveBeenCalledTimes(1);
  const options = factory.mock.calls[0][0];
  expect(options).toMatchObject({ url: runtime.redisUrl, disableOfflineQueue: true, commandsQueueMaxLength: 1000,
    socket: { connectTimeout: 20, rejectUnauthorized: false, reconnectStrategy: false } });
  client.emit('error', new Error(runtime.redisUrl));
  expect(log).toHaveBeenCalledWith({ event: 'redis', outcome: 'unavailable' });
  expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-secret');
  expect(resource.isReady()).toBe(true);
  await resource.close(); await resource.close();
  expect(client.close).toHaveBeenCalledTimes(1);
  resource.restart(); expect(client.connect).toHaveBeenCalledTimes(1);
});
it('preserves verified TLS by default and accepts non-TLS local Redis', async () => {
  const factory = jest.fn(fakeClient);
  const verified = await connectRedis({ ...runtime, redisTlsRejectUnauthorized: true }, jest.fn(), factory);
  expect(factory.mock.calls[0][0].socket.rejectUnauthorized).toBe(true);
  await verified.close();
  const local = await connectRedis({ ...runtime, redisUrl: 'redis://127.0.0.1' }, jest.fn(), factory);
  expect(factory.mock.calls[1][0].socket.rejectUnauthorized).toBeUndefined();
  await local.close();
});
it.each(['failed', 'stalled'])('bounds and redacts %s startup; destroys half-open connections', async mode => {
  const client = fakeClient();
  client.connect.mockImplementation(async () => {
    client.isOpen = true;
    if (mode === 'failed') throw new Error(runtime.redisUrl);
    await new Promise(() => {});
  });
  await expect(connectRedis(runtime, jest.fn(), () => client)).rejects.toThrow('Redis startup failed');
  expect(client.destroy).toHaveBeenCalledTimes(1);
});
it('redacts client factory errors', async () => {
  await expect(connectRedis(runtime, jest.fn(), () => { throw new Error(runtime.redisUrl); })).rejects.toThrow('Redis startup failed');
});
it('bounds stalled graceful close and forcibly releases the connection', async () => {
  const client = fakeClient(); const resource = await connectRedis(runtime, jest.fn(), () => client);
  client.close.mockImplementation(() => { client.isOpen = false; return new Promise(() => {}); });
  await expect(resource.close()).rejects.toThrow('Redis shutdown failed');
  expect(client.destroy).toHaveBeenCalledTimes(1);
});
it('cancels scheduled reconnect on shutdown', async () => {
  const client = fakeClient(); const resource = await connectRedis(runtime, jest.fn(), () => client);
  resource.restart(); resource.restart();
  expect(client.destroy).toHaveBeenCalledTimes(1);
  await resource.close();
  expect(client.connect).toHaveBeenCalledTimes(1);
});
it('bounds stalled recovery handshakes and retries once with capped backoff', async () => {
  jest.useFakeTimers();
  const random = jest.spyOn(Math, 'random').mockReturnValue(0);
  const client = fakeClient(); const log = jest.fn();
  const resource = await connectRedis(runtime, log, () => client);
  try {
    client.connect.mockImplementationOnce(async () => { client.isOpen = true; await new Promise(() => {}); });
    resource.restart();
    await jest.advanceTimersByTimeAsync(250);
    expect(client.connect).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(20);
    expect(client.destroy).toHaveBeenCalledTimes(2);
    expect(resource.isReady()).toBe(false);
    await jest.advanceTimersByTimeAsync(500);
    expect(client.connect).toHaveBeenCalledTimes(3);
    expect(resource.isReady()).toBe(true);
    expect(log).toHaveBeenCalledWith({ event: 'redis', outcome: 'unavailable' });
  } finally { await resource.close(); random.mockRestore(); jest.useRealTimers(); }
});
