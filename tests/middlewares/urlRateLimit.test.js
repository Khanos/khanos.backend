import { jest } from '@jest/globals';
import request from 'supertest';
import { appFor, authorization, config } from '../helpers/app.js';
import { createMemoryCounter } from '../../rateLimitStore.js';

const runtime = { ...config, test: false, rateLimitMax: 1,
  urlRateLimitMax: { anonymous: 1, relay: 2, owner: 1 } };
const urlService = { getUrl: async () => ({ short_url: 42 }), getUrlList: async () => [], create: async () => ({ short_url: 42 }), deleteShortUrl: async () => ({ short_url: 42 }) };
const options = { config: runtime, urlService };

it('isolates anonymous lookup, finite verified relay, owner operations and unrelated API budgets', async () => {
  const app = appFor(options);
  expect((await request(app).get('/api/url/0042')).status).toBe(200);
  const limited = await request(app).get('/api/url/42');
  expect(limited.status).toBe(429);
  expect(limited.headers).toMatchObject({ 'cache-control': 'no-store', 'retry-after': '60', vary: expect.stringContaining('Authorization') });
  expect(limited.body).toEqual({ error: 'Too many requests', code: 'RATE_LIMITED', requestId: expect.any(String) });
  expect((await request(app).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
  expect((await request(app).head('/API/URL/0042/').set('Authorization', authorization)).status).toBe(200);
  expect((await request(app).get('/api/url/42').set('Authorization', authorization)).status).toBe(429);
  expect((await request(app).get('/api/url').set('Authorization', authorization)).status).toBe(200);
  expect((await request(app).post('/api/url/create').set('Authorization', authorization).send({ original_url: 'https://example.com/' })).status).toBe(429);
  expect((await request(app).get('/api/')).status).toBe(200);
  expect((await request(app).get('/api/')).status).toBe(429);
});

it.each([undefined, 'Bearer invalid', 'Bearer wrong-owner-credential-000000000000000000', 'Basic synthetic'])('does not award a relay quota to invalid optional credentials %#', async header => {
  const app = appFor(options);
  await request(app).get('/api/url/42');
  const get = request(app).get('/api/url/42');
  if (header) get.set('Authorization', header);
  expect((await get).status).toBe(429);
  expect((await request(app).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
});

it('leaves invalid optional bearer public and denies unauthorized owner operations', async () => {
  const app = appFor({ ...options, config: { ...runtime, urlRateLimitMax: { ...runtime.urlRateLimitMax, anonymous: 10 } } });
  expect((await request(app).get('/api/url/42').set('Authorization', 'Bearer invalid')).status).toBe(200);
  for (const [method, path] of [['get', '/api/url'], ['post', '/api/url/create'], ['delete', '/api/url/delete/42']]) {
    expect((await request(app)[method](path).set('Authorization', 'Bearer invalid')).status).toBe(401);
  }
});

it('ignores spoofed client headers with proxy trust disabled', async () => {
  const app = appFor(options);
  expect((await request(app).get('/api/url/42').set('X-Forwarded-For', '192.0.2.10')).status).toBe(200);
  expect((await request(app).get('/api/url/42').set('X-Forwarded-For', '192.0.2.11').set('Forwarded', 'for=192.0.2.11')).status).toBe(429);
});

it('isolates two clients under explicitly trusted loopback proxy without trusting earlier forged hops', async () => {
  const app = appFor({ ...options, config: { ...runtime, trustedProxyCidrs: ['127.0.0.1', '::1'] } });
  expect((await request(app).get('/api/url/42').set('X-Forwarded-For', '198.51.100.1, 192.0.2.10')).status).toBe(200);
  expect((await request(app).get('/api/url/42').set('X-Forwarded-For', '198.51.100.2, 192.0.2.10')).status).toBe(429);
  expect((await request(app).get('/api/url/42').set('X-Forwarded-For', '192.0.2.11')).status).toBe(200);
  expect((await request(app).get('/api/url').set('Authorization', authorization)).status).toBe(200);
});

it('retains aggregate emergency protection and health reachability through store outages', async () => {
  const app = appFor({ ...options, config: { ...runtime, rateLimitSafetyMax: 1 } });
  expect((await request(app).get('/api/')).status).toBe(200);
  expect((await request(app).get('/api/url/42').set('Authorization', authorization)).status).toBe(429);
  expect((await request(app).get('/health/live')).status).toBe(200);
  const log = jest.fn();
  const counter = { consume: jest.fn().mockRejectedValue(new Error('synthetic-private-store-token')) };
  const failed = appFor({ ...options, log, rateLimitCounter: counter });
  const result = await request(failed).get('/api/url/42');
  expect(result.status).toBe(503);
  expect(result.headers['cache-control']).toBe('no-store');
  expect(result.headers['retry-after']).toBeUndefined();
  expect(result.body.code).toBe('RATE_LIMIT_UNAVAILABLE');
  expect(log).toHaveBeenCalledWith({ event: 'rate_limit', operation: 'anonymous', outcome: 'unavailable' });
  expect(JSON.stringify(log.mock.calls) + result.text).not.toContain('synthetic-private-store-token');
  expect((await request(failed).get('/health/live')).status).toBe(200);
  expect((await request(failed).get('/health/ready')).status).toBe(503);
  counter.consume.mockResolvedValue({ count: 1, resetMs: 1000 });
  expect((await request(failed).get('/api/url/42')).status).toBe(200);
});

it('reports only safe quota classification for anonymous, relay, and emergency denials', async () => {
  const log = jest.fn();
  const app = appFor({ ...options, log });
  await request(app).get('/api/url/42');
  await request(app).get('/api/url/42').set('X-Forwarded-For', 'synthetic-private-ip');
  await request(app).get('/api/url/42').set('Authorization', authorization);
  await request(app).get('/api/url/42').set('Authorization', authorization);
  await request(app).get('/api/url/42').set('Authorization', authorization);
  expect(log).toHaveBeenCalledWith({ event: 'rate_limit', operation: 'anonymous', outcome: 'limited' });
  expect(log).toHaveBeenCalledWith({ event: 'rate_limit', operation: 'relay', outcome: 'limited' });
  const emergency = appFor({ ...options, log, config: { ...runtime, rateLimitSafetyMax: 1 } });
  await request(emergency).get('/api/');
  await request(emergency).get('/api/url/42');
  expect(log).toHaveBeenCalledWith({ event: 'rate_limit', operation: 'safety', outcome: 'limited' });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/synthetic-private-ip|test-owner-credential/);
});

it('bounds retry timing at one second even near expiry', async () => {
  let time = 1000;
  const app = appFor({ ...options, rateLimitCounter: createMemoryCounter({ now: () => time }) });
  await request(app).get('/api/url/42');
  time += 59999;
  expect((await request(app).get('/api/url/42')).headers['retry-after']).toBe('1');
  time += 1;
  expect((await request(app).get('/api/url/42')).status).toBe(200);
});

it('rejects aggregate exhaustion without minting or incrementing an operation counter', async () => {
  const counter = { consume: jest.fn().mockResolvedValue({ count: runtime.rateLimitSafetyMax + 1, resetMs: 12000 }) };
  const app = appFor({ ...options, rateLimitCounter: counter });
  const response = await request(app).get('/api/url/42').set('Authorization', authorization);
  expect(response.status).toBe(429);
  expect(response.headers['retry-after']).toBe('12');
  expect(counter.consume).toHaveBeenCalledTimes(1);
  expect(counter.consume).toHaveBeenCalledWith('safety:aggregate', runtime.urlRateLimitWindowMs);
});
