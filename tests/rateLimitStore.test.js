import http from 'node:http';
import { jest } from '@jest/globals';
import request from 'supertest';
import { COUNTER_SCRIPT, createCounter, createMemoryCounter, createRedisCounter } from '../rateLimitStore.js';
import { appFor, authorization, config } from './helpers/app.js';

const redisOptions = { url: 'https://counter.example/', token: 'synthetic-store-credential', prefix: 'test:backend', timeoutMs: 1000 };

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
  expect(typeof createCounter({ ...config, rateLimitStore: 'redis' }).consume).toBe('function');
});

it.each([
  () => new Response('{}', { status: 500 }),
  () => new Response('{}', { headers: { 'content-type': 'text/html' } }),
  () => new Response('x'.repeat(4097), { headers: { 'content-type': 'application/json' } }),
  () => new Response('{invalid', { headers: { 'content-type': 'application/json' } }),
  () => Response.json({ error: 'private provider details' }),
  () => Response.json({ result: [0, 1000] }),
  () => Response.json({ result: [1, -1] }),
  () => Response.json({ result: [1, 1001] }),
  () => Response.json({ result: [1, 1, 1] }),
  () => Response.json({ result: ['1', 1000] }),
  () => { throw new Error('private provider token'); },
])('fails closed with a redacted error for provider failure %#', async response => {
  const counter = createRedisCounter({ ...redisOptions, fetchImpl: async () => response() });
  await expect(counter.consume('A', 1000)).rejects.toThrow('Rate limit store unavailable');
});

it('cancels oversized responses and preserves a strict EVAL command/key contract', async () => {
  const cancel = jest.fn();
  const read = jest.fn().mockResolvedValue({ done: false, value: new Uint8Array(4097) });
  const fetchImpl = jest.fn().mockResolvedValue({ ok: true, headers: new Headers({ 'content-type': 'application/json; charset=utf-8' }), body: { getReader: () => ({ read, cancel }) } });
  await expect(createRedisCounter({ ...redisOptions, fetchImpl }).consume('anonymous:192.0.2.10', 1000)).rejects.toThrow();
  expect(cancel).toHaveBeenCalledTimes(1);
  const [url, options] = fetchImpl.mock.calls[0];
  expect(url).toBe(redisOptions.url);
  expect(options).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer synthetic-store-credential', 'Content-Type': 'application/json' } });
  expect(JSON.parse(options.body)).toEqual(['EVAL', COUNTER_SCRIPT, '1', expect.stringMatching(/^test:backend:[a-f0-9]{64}$/), '1000']);
  expect(options.body).not.toContain('192.0.2.10');
});

describe('owned Redis REST protocol fixture across independent app replicas', () => {
  let server;
  let origin;
  let counters;
  let time;
  let mode;
  beforeEach(async () => {
    counters = new Map(); time = 1000; mode = 'normal';
    server = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk;
      if (mode === 'stalled') return;
      if (mode === 'failed') { res.writeHead(503); return res.end('private provider details'); }
      const [command, script, keys, key, window] = JSON.parse(body);
      if (command !== 'EVAL' || script !== COUNTER_SCRIPT || keys !== '1' || req.headers.authorization !== 'Bearer synthetic-store-credential') {
        res.writeHead(400); return res.end();
      }
      let entry = counters.get(key);
      if (!entry || entry.reset <= time) { entry = { count: 0, reset: time + Number(window) }; counters.set(key, entry); }
      entry.count += 1;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ result: [entry.count, entry.reset - time] }));
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${server.address().port}/`;
  });
  afterEach(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const fixtureCounter = () => createRedisCounter({ ...redisOptions, timeoutMs: 50,
    fetchImpl: (_url, options) => fetch(origin, options) });

  it('shares finite relay quota between replicas, expires keys, and recovers safely from outages', async () => {
    const runtime = { ...config, test: false, urlRateLimitMax: { anonymous: 1, relay: 2, owner: 1 } };
    const make = () => appFor({ config: runtime, rateLimitCounter: fixtureCounter(), urlService: { getUrl: async () => ({ short_url: 42 }) } });
    const first = make(); const second = make();
    expect((await request(first).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
    expect((await request(second).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
    expect((await request(first).get('/api/url/42').set('Authorization', authorization)).status).toBe(429);
    time += runtime.urlRateLimitWindowMs;
    expect((await request(second).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
    mode = 'failed';
    const failed = await request(first).get('/api/url/42').set('Authorization', authorization);
    expect(failed.status).toBe(503); expect(failed.body.code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(failed.text).not.toContain('private provider details');
    expect((await request(second).get('/health/live')).status).toBe(200);
    mode = 'normal';
    expect((await request(second).get('/api/url/42').set('Authorization', authorization)).status).toBe(200);
  });

  it('sends one atomic EVAL per increment during concurrent adapter requests', async () => {
    const first = fixtureCounter(); const second = fixtureCounter();
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? first : second).consume('relay:owner', 1000)));
    expect(results.map(result => result.count).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(counters.size).toBe(1);
  });

  it('bounds a stalled native HTTP request', async () => {
    mode = 'stalled';
    await expect(fixtureCounter().consume('A', 1000)).rejects.toThrow('Rate limit store unavailable');
  });
});
