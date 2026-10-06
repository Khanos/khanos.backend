import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import request from 'supertest';

import { connectRedis } from '../../redisConnection.js';
import { createCounter } from '../../rateLimitStore.js';
import { appFor, authorization, config } from '../helpers/app.js';
import { startRedisFixture } from '../helpers/redis.js';

// Optional local proof: owns a Redis process and directory, never uses REDIS_URL
// from the environment or connects to Heroku/a configured external database.
test('actual Redis Lua: shared app quota, atomic concurrency, expiry and stalled command recovery', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'khanos-redis-test-'));
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.env.REDIS_SERVER_BIN || 'redis-server', ['--bind', '127.0.0.1', '--port', String(port),
    '--save', '', '--appendonly', 'no', '--dir', directory], { stdio: 'ignore' });
  let failed = false;
  child.on('error', () => { failed = true; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  const resources = [];
  const runtime = { ...config, test: false, rateLimitStore: 'redis', redisUrl: `redis://127.0.0.1:${port}`,
    rateLimitStoreTimeoutMs: 1000, urlRateLimitMax: { anonymous: 1, relay: 2, owner: 1 } };
  const log = () => {};
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    const startupDeadline = Date.now() + 5000;
    let ready = false;
    while (!ready && Date.now() < startupDeadline) {
      if (failed || child.exitCode !== null) throw new Error('Install local Redis or set REDIS_SERVER_BIN');
      ready = await new Promise(resolve => {
        const socket = net.connect({ host: '127.0.0.1', port });
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('error', () => resolve(false));
      });
      if (!ready) await wait(20);
    }
    assert.ok(ready, 'local Redis startup');
    for (let i = 0; i < 2; i += 1) resources.push(await connectRedis(runtime, log));
    const counters = resources.map(resource => createCounter(runtime, resource.client, resource.restart));
    const apps = counters.map(rateLimitCounter => appFor({ config: runtime, rateLimitCounter,
      urlService: { getUrl: async () => ({ short_url: 42 }) } }));
    assert.equal((await request(apps[0]).get('/api/url/42').set('Authorization', authorization)).status, 200);
    assert.equal((await request(apps[1]).get('/api/url/42').set('Authorization', authorization)).status, 200);
    assert.equal((await request(apps[0]).get('/api/url/42').set('Authorization', authorization)).status, 429);
    const results = await Promise.all(Array.from({ length: 100 }, (_, i) => counters[i % 2].consume('atomic:shared', 1500)));
    assert.deepEqual(results.map(result => result.count).sort((a, b) => a - b), Array.from({ length: 100 }, (_, i) => i + 1));
    await wait(250);
    const subsequent = await counters[0].consume('atomic:shared', 1500);
    assert.equal(subsequent.count, 101);
    assert.ok(subsequent.resetMs < results[0].resetMs, 'later increments must not extend expiry');
    const keys = await resources[0].client.keys(`${runtime.rateLimitPrefix}:*`); // isolated owned DB only
    assert.ok(keys.every(key => /^khanos:backend:limits:v1:[a-f0-9]{64}$/.test(key)));
    await wait(subsequent.resetMs + 30);
    const atomicKey = `${runtime.rateLimitPrefix}:${createHash('sha256').update('atomic:shared').digest('hex')}`;
    assert.equal(await resources[0].client.exists(atomicKey), 0);
    assert.equal((await counters[1].consume('atomic:shared', 1500)).count, 1);

    const fast = createCounter({ ...runtime, rateLimitStoreTimeoutMs: 100 }, resources[0].client, resources[0].restart);
    await resources[1].client.sendCommand(['CLIENT', 'PAUSE', '700', 'ALL']);
    await assert.rejects(fast.consume('stalled:counter', 1000), /Rate limit store unavailable/);
    assert.equal(resources[0].isReady(), false);
    const recoveryDeadline = Date.now() + 3000;
    while (!resources[0].isReady() && Date.now() < recoveryDeadline) await wait(20);
    assert.equal((await counters[0].consume('recovery:counter', 1000)).count, 1);
    assert.equal((await request(apps[0]).get('/health/live')).status, 200);
  } finally {
    await Promise.allSettled(resources.map(resource => resource.close()));
    if (child.pid && child.exitCode === null) {
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
      await exited;
      clearTimeout(timer);
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test('native rediss: verified TLS rejects a self-signed endpoint; explicit Heroku opt-in succeeds', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'khanos-redis-tls-test-'));
  let fixture;
  let resource;
  const records = [];
  const log = record => records.push(record);
  try {
    const keyFile = path.join(directory, 'key.pem');
    const certFile = path.join(directory, 'cert.pem');
    await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', keyFile, '-out', certFile, '-days', '1', '-subj', '/CN=localhost']);
    fixture = await startRedisFixture({ key: await readFile(keyFile), cert: await readFile(certFile) });
    const runtime = { ...config, rateLimitStore: 'redis', redisUrl: fixture.url, rateLimitPrefix: 'test:backend',
      redisTlsRejectUnauthorized: true, rateLimitStoreTimeoutMs: 200 };
    await assert.rejects(connectRedis(runtime, log), /Redis startup failed/);
    resource = await connectRedis({ ...runtime, redisTlsRejectUnauthorized: false }, log);
    const counter = createCounter(runtime, resource.client, resource.restart);
    assert.equal((await counter.consume('anonymous:192.0.2.10', 1000)).count, 1);
    assert.ok(!JSON.stringify(records).includes('synthetic-private-redis-secret'));
    assert.ok(!JSON.stringify(records).includes('192.0.2.10'));
  } finally {
    if (resource) await resource.close();
    if (fixture) await fixture.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
