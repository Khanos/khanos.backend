import { jest } from '@jest/globals';
import request from 'supertest';
import { COUNTER_SCRIPT, createCounter, createMemoryCounter, createRedisCounter } from '../rateLimitStore.js';
import { connectRedis } from '../redisConnection.js';
import { appFor, authorization, config } from './helpers/app.js';
import { startRedisFixture } from './helpers/redis.js';

const redisOptions = { prefix: 'test:backend', timeoutMs: 1000 };

it('bounds the single-process counter and expires exhausted clients', async () => {
  let time = 0;
  const counter = createMemoryCounter({ now: () => time, maxEntries: 1 });
  expect(await counter.consume('A', 1000)).toEqual({ count: 1, resetMs: 1000 });
  expect(await counter.consume('A', 1000)).toEqual({ count: 2, resetMs: 1000 });
  await expect(counter.consume('B', 1000)).rejects.toThrow('Rate limit store unavailable');
  time = 1000;
  expect(await counter.consume('B', 1000)).toEqual({ count: 1, resetMs: 1000 });
  time = 2000;
  expect(await counter.consume('B', 1000)).toEqual({ count: 1, resetMs: 1000 });
  expect(await createCounter(config).consume('C', 1000)).toEqual({ count: 1, resetMs: 1000 });
  expect(() => createCounter({ ...config, rateLimitStore: 'redis' })).toThrow('Rate limit store unavailable');
  expect(() => createCounter({ ...config, rateLimitStore: 'invalid' })).toThrow();
});

it.each([undefined, {}, [0, 1000], [1, -1], [1, 1001], [1, 1, 1], ['1', 1000], [Number.MAX_SAFE_INTEGER + 1, 1000]])('fails closed with a redacted error for invalid Redis result %#', async result => {
  const client = { isReady: true, withCommandOptions: () => ({ eval: async () => result }) };
  await expect(createRedisCounter({ ...redisOptions, client }).consume('A', 1000)).rejects.toThrow('Rate limit store unavailable');
});
it('requires a ready injected client and redacts native command exceptions', async () => {
  const client = { isReady: false, withCommandOptions: jest.fn() };
  const counter = createRedisCounter({ ...redisOptions, client });
  await expect(counter.consume('A', 1000)).rejects.toThrow('Rate limit store unavailable');
  expect(client.withCommandOptions).not.toHaveBeenCalled();
  client.isReady = true;
  client.withCommandOptions.mockImplementation(() => { throw new Error('synthetic-private-redis-secret'); });
  await expect(counter.consume('A', 1000)).rejects.toThrow('Rate limit store unavailable');
});
it('hashes identities and accepts a legitimate zero TTL at the expiry boundary', async () => {
  const evalCommand = jest.fn().mockResolvedValue([1, 0]);
  const client = { isReady: true, withCommandOptions: jest.fn().mockReturnValue({ eval: evalCommand }) };
  expect(await createRedisCounter({ ...redisOptions, client }).consume('anonymous:192.0.2.10', 1000)).toEqual({ count: 1, resetMs: 0 });
  expect(evalCommand).toHaveBeenCalledWith(COUNTER_SCRIPT, { keys: [expect.stringMatching(/^test:backend:[a-f0-9]{64}$/)], arguments: ['1000'] });
  expect(JSON.stringify(evalCommand.mock.calls)).not.toContain('192.0.2.10');
});

describe('native Redis wire adapter across independent app replicas', () => {
  let fixture;
  let resources;
  let log;
  beforeEach(async () => { fixture = await startRedisFixture(); resources = []; log = jest.fn(); });
  afterEach(async () => { await Promise.all(resources.map(resource => resource.close())); await fixture.stop(); });
  async function fixtureCounter(timeoutMs = 1000) {
    const runtime = { ...config, rateLimitStore: 'redis', redisUrl: fixture.url, rateLimitPrefix: redisOptions.prefix, rateLimitStoreTimeoutMs: timeoutMs };
    const resource = await connectRedis(runtime, log);
    resources.push(resource);
    return createCounter(runtime, resource.client, resource.restart);
  }

  it('shares finite relay quota, expires keys, reuses connections, and recovers from errors', async () => {
    const runtime = { ...config, test: false, urlRateLimitMax: { anonymous: 1, relay: 2, owner: 1 } };
    const make = async () => appFor({ config: runtime, rateLimitCounter: await fixtureCounter(), urlService: { getUrl: async () => ({ short_url: 42 }) }, log });
    const first = await make(); const second = await make();
    expect((await request(first).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
    expect((await request(second).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
    expect((await request(first).get('/api/url/42').set('Authorization', authorization)).status).toBe(429);
    fixture.advance(runtime.urlRateLimitWindowMs);
    expect((await request(second).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
    fixture.setMode('failed');
    const failed = await request(first).get('/api/url/42').set('Authorization', authorization);
    expect(failed.status).toBe(503); expect(failed.body.code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(JSON.stringify(log.mock.calls) + failed.text).not.toContain('synthetic-private-redis-secret');
    expect((await request(second).get('/health/live')).status).toBe(200);
    fixture.setMode('normal');
    expect((await request(second).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
    expect(fixture.connections).toBe(2);
    expect(fixture.commands.filter(([command]) => command === 'EVAL')).toHaveLength(11);
  });

  it('sends one atomic EVAL per increment during concurrent adapter requests', async () => {
    const first = await fixtureCounter(); const second = await fixtureCounter();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? first : second).consume('relay:owner', 1000)));
    expect(results.map(result => result.count).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(results.every(result => result.resetMs === 1000)).toBe(true);
    expect(fixture.counters.size).toBe(1);
    fixture.advance(900);
    expect(await first.consume('relay:owner', 1000)).toEqual({ count: 11, resetMs: 100 });
    fixture.advance(100);
    expect(await second.consume('relay:owner', 1000)).toEqual({ count: 1, resetMs: 1000 });
  });

  it('recovers from an unexpected socket loss through a single bounded connection loop', async () => {
    const counter = await fixtureCounter(100);
    expect((await counter.consume('A', 1000)).count).toBe(1);
    fixture.dropConnections();
    const deadline = Date.now() + 2000;
    while (fixture.connections < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    while (!resources[0].isReady() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    expect((await counter.consume('A', 1000)).count).toBe(2);
    expect(fixture.connections).toBe(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-redis-secret');
  });

  it('bounds a stalled native command, returns safe 503, reconnects once and retains counters', async () => {
    const counter = await fixtureCounter(100);
    expect(await counter.consume('A', 1000)).toEqual({ count: 1, resetMs: 1000 });
    fixture.setMode('stalled');
    const app = appFor({ config: { ...config, test: false }, rateLimitCounter: counter, log });
    const started = performance.now();
    const response = await request(app).get('/api/url/42');
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(performance.now() - started).toBeLessThan(1000);
    expect((await request(app).get('/health/live')).status).toBe(200);
    await expect(counter.consume('A', 1000)).rejects.toThrow('Rate limit store unavailable');
    fixture.setMode('normal');
    const deadline = Date.now() + 2000;
    while (!resources[0].isReady() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
    expect(await counter.consume('A', 1000)).toEqual({ count: 2, resetMs: 1000 });
    expect(fixture.connections).toBe(2);
  });
});
