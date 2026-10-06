import { jest } from '@jest/globals';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { appFor, config, authorization } from '../helpers/app.js';
import { createMemoryCounter, createCounter } from '../../rateLimitStore.js';
import { connectRedis } from '../../redisConnection.js';
import { startRedisFixture } from '../helpers/redis.js';

const secret = 'test-admission-credential-0000000000000000000';
const runtime = { ...config, admissionToken: secret };
const bearer = `Bearer ${secret}`;
const body = (kind = 'resolver', clientIp = '192.0.2.1') => ({ kind, clientIp, environment: 'production' });
const consume = (app, data = body(), auth = bearer) => request(app).post('/api/admission').set('Authorization', auth).send(data);

it('requires the dedicated credential before parsing or allocating frontend keys', async () => {
  const counter = { consume: jest.fn() };
  const app = appFor({ config: runtime, rateLimitCounter: counter });
  for (const auth of ['', 'Bearer invalid', authorization]) {
    const response = await request(app).post('/api/admission').set('Authorization', auth).set('Content-Type', 'application/json').send('{invalid');
    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect(counter.consume).not.toHaveBeenCalled();
  expect((await consume(appFor(), body())).status).toBe(503);
  expect((await request(app).get('/api/url').set('Authorization', bearer)).status).toBe(401);
});
it('rejects invalid, oversized and non-JSON bodies with safe errors', async () => {
  const counter = { consume: jest.fn() };
  const app = appFor({ config: runtime, rateLimitCounter: counter });
  for (const data of [null, [], {}, { kind: 'invalid', clientIp: '192.0.2.1' }, body('owner', 'invalid'), body('owner', 1), { ...body(), environment: 'arbitrary' }, { ...body(), extra: 1 }]) {
    expect((await consume(app, data)).status).toBeGreaterThanOrEqual(400);
  }
  expect((await consume(app, { ...body(), clientIp: 'x'.repeat(2000) })).status).toBe(413);
  expect((await request(app).post('/api/admission').set('Authorization', bearer).send('plain')).status).toBe(415);
  expect((await request(app).post('/api/admission').set('Authorization', bearer).set('Content-Type', 'application/json').send('{invalid')).status).toBe(400);
  expect(counter.consume).not.toHaveBeenCalled();
});
it('preserves all four fixed policies and hashed, independent IPv4/IPv6 identities', async () => {
  const counter = { consume: jest.fn().mockResolvedValue({ count: 1, resetMs: 1000 }) };
  const app = appFor({ config: runtime, rateLimitCounter: counter });
  for (const [kind, window, max] of [['aggregate', 60000, 5000], ['owner', 60000, 120], ['failure', 600000, 20], ['resolver', 60000, 60]]) {
    expect((await consume(app, body(kind))).status).toBe(204);
    expect(counter.consume).toHaveBeenLastCalledWith(expect.stringMatching(new RegExp(`^frontend:production:${kind}:[a-f0-9]{64}$`)), window);
    counter.consume.mockResolvedValueOnce({ count: max + 1, resetMs: 12500 });
    const limited = await consume(app, body(kind));
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('13');
  }
  await consume(app, body('aggregate', '192.0.2.2'));
  expect(counter.consume).toHaveBeenLastCalledWith(`frontend:production:aggregate:${createHash('sha256').update('owner-emergency').digest('hex')}`, 60000);
  await consume(app, body('resolver', '2001:db8:1234:5600::1'));
  const key = counter.consume.mock.calls.at(-1)[0];
  await consume(app, body('resolver', '2001:db8:1234:56ff::2'));
  expect(counter.consume.mock.calls.at(-1)[0]).toBe(key);
  await consume(app, body('resolver', '2001:db8:1234:5700::1'));
  expect(counter.consume.mock.calls.at(-1)[0]).not.toBe(key);
  expect(JSON.stringify(counter.consume.mock.calls)).not.toMatch(/192\.0\.2|2001:db8|test-admission/);
});
it('fails closed on Redis failure, redacts logs and leaves health reachable', async () => {
  const log = jest.fn();
  const app = appFor({ config: runtime, log, rateLimitCounter: { consume: async () => { throw new Error('private-redis-password'); } } });
  const response = await consume(app);
  expect(response.status).toBe(503);
  expect(response.body.code).toBe('RATE_LIMIT_UNAVAILABLE');
  expect(JSON.stringify(log.mock.calls) + response.text).not.toMatch(/private-redis-password|192\.0\.2|test-admission/);
  expect((await request(app).get('/health/live')).status).toBe(200);
});
it('avoids unrelated per-egress-IP quotas for verified admission while retaining the emergency ceiling', async () => {
  const app = appFor({ config: { ...runtime, test: false, rateLimitMax: 1, rateLimitSafetyMax: 4 } });
  expect((await request(app).get('/api/')).status).toBe(200);
  expect((await request(app).get('/api/')).status).toBe(429);
  expect((await consume(app)).status).toBe(204);
  expect((await consume(app)).status).toBe(204);
  expect((await consume(app)).status).toBe(429);
  expect((await request(app).get('/health/live')).status).toBe(200);
});
it('shares the aggregate owner ceiling across IPs and does not consume another kind', async () => {
  const counter = createMemoryCounter();
  for (let n = 0; n < 5000; n++) await counter.consume(`frontend:production:aggregate:${createHash('sha256').update('owner-emergency').digest('hex')}`, 60000);
  const app = appFor({ config: runtime, rateLimitCounter: counter });
  expect((await consume(app, body('aggregate', '192.0.2.2'))).status).toBe(429);
  expect((await consume(app, body('owner', '192.0.2.2'))).status).toBe(204);
});
it('shares concurrent admission, expiry and outages across real Redis clients on separate app instances', async () => {
  const fixture = await startRedisFixture();
  const resources = [];
  try {
    const make = async () => {
      const settings = { ...runtime, rateLimitStore: 'redis', redisUrl: fixture.url, rateLimitPrefix: 'test:backend', rateLimitStoreTimeoutMs: 100 };
      const resource = await connectRedis(settings, () => {});
      resources.push(resource);
      return appFor({ config: settings, rateLimitCounter: createCounter(settings, resource.client, resource.restart) });
    };
    const first = await make(), second = await make();
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => consume(i % 2 ? first : second, body('failure'))));
    expect(results.filter(r => r.status === 204)).toHaveLength(20);
    expect(results.filter(r => r.status === 429)).toHaveLength(5);
    expect((await consume(first, body('failure', '192.0.2.2'))).status).toBe(204);
    expect((await consume(first, body('resolver'))).status).toBe(204);
    expect((await consume(first, { ...body('failure'), environment: 'preview' })).status).toBe(204);
    fixture.advance(600000);
    expect((await consume(second, body('failure'))).status).toBe(204);
    fixture.setMode('failed');
    expect((await consume(first)).body.code).toBe('RATE_LIMIT_UNAVAILABLE');
    fixture.setMode('stalled');
    expect((await consume(second)).status).toBe(503);
    expect((await request(first).get('/health/live')).status).toBe(200);
  } finally {
    await Promise.all(resources.map(r => r.close()));
    await fixture.stop();
  }
});
