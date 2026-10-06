import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import http from 'node:http';
import request from 'supertest';
import mongoose from 'mongoose';
import { start } from '../lifecycle.js';
import mongoDB, { requireUrlIndexes } from '../db.js';
import { createApp } from '../app.js';
import { config } from './helpers/app.js';

const runtime = { ...config, test: false, port: 0, bindHost: '127.0.0.1', shutdownTimeoutMs: 1000 };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let database;
let signals;
let log;
beforeEach(() => {
  database = { connect: jest.fn().mockResolvedValue(), disconnect: jest.fn().mockResolvedValue(), isReady: jest.fn().mockReturnValue(true) };
  signals = new EventEmitter(); signals.exit = jest.fn();
  log = jest.fn();
});
it('waits for DB readiness before listener creation and tracks live dependency readiness', async () => {
  const connected = deferred();
  database.connect.mockReturnValue(connected.promise);
  const factory = jest.fn(http.createServer);
  const starting = start({ config: runtime, database, signals, log, serverFactory: factory });
  expect(factory).not.toHaveBeenCalled();
  connected.resolve();
  const application = await starting;
  try {
    expect(application.server.address().address).toBe('127.0.0.1');
    expect((await request(application.server).get('/health/ready')).body).toEqual({ status: 'ready' });
    database.isReady.mockReturnValue(false);
    expect((await request(application.server).get('/health/ready')).status).toBe(503);
    expect((await request(application.server).get('/health/live')).body).toEqual({ status: 'ok' });
  } finally { await application.shutdown(); }
  expect(database.disconnect).toHaveBeenCalledTimes(1);
  expect(signals.listenerCount('SIGTERM')).toBe(0);
});
it('fails safely before opening a socket if persistence is unavailable', async () => {
  database.connect.mockRejectedValue(new Error('synthetic-private-connection'));
  const factory = jest.fn();
  await expect(start({ config: runtime, database, signals, log, serverFactory: factory })).rejects.toThrow();
  expect(factory).not.toHaveBeenCalled();
  expect(database.disconnect).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-connection');
});
it('cleans up after a real listener bind failure', async () => {
  const occupied = http.createServer();
  await new Promise((resolve, reject) => { occupied.once('error', reject); occupied.listen(0, '127.0.0.1', resolve); });
  try {
    await expect(start({ config: { ...runtime, port: occupied.address().port }, database, signals, log })).rejects.toThrow();
    expect(database.disconnect).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ event: 'startup', outcome: 'failed', code: 'LISTENER_STARTUP_FAILED' });
  } finally { await new Promise(resolve => occupied.close(resolve)); }
});
it('identifies missing URL indexes without exposing the database exception', async () => {
  database.connect.mockRejectedValue(Object.assign(new Error('synthetic-private-database-detail'), { code: 'URL_INDEXES_MISSING' }));
  const factory = jest.fn();
  await expect(start({ config: runtime, database, signals, log, serverFactory: factory })).rejects.toThrow();
  expect(factory).not.toHaveBeenCalled();
  expect(database.disconnect).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith({ event: 'startup', outcome: 'failed', code: 'URL_INDEXES_MISSING' });
  expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-database-detail');
});
it('awaits disconnect and makes repeated shutdown idempotent', async () => {
  const disconnected = deferred();
  database.disconnect.mockReturnValue(disconnected.promise);
  const application = await start({ config: runtime, database, signals, log });
  let done = false;
  const closing = application.shutdown().then(() => { done = true; });
  await new Promise(resolve => setImmediate(resolve));
  expect(done).toBe(false);
  disconnected.resolve();
  await Promise.all([closing, application.shutdown()]);
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
it('drains a real in-flight request before disconnect', async () => {
  const response = deferred();
  const entered = deferred();
  const application = await start({ config: runtime, database, signals, log,
    appFactory: options => createApp({ ...options, urlService: { getUrl: async () => { entered.resolve(); return response.promise; } } }) });
  const requesting = request(application.server).get('/api/url/123').then(result => result);
  await entered.promise;
  const closing = application.shutdown();
  expect(database.disconnect).not.toHaveBeenCalled();
  response.resolve({ short_url: 123 });
  expect((await requesting).status).toBe(200);
  await closing;
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
it('bounds shutdown including a stuck database disconnect', async () => {
  database.disconnect.mockReturnValue(new Promise(() => {}));
  const application = await start({ config: { ...runtime, shutdownTimeoutMs: 10 }, database, signals, log });
  await expect(application.shutdown()).rejects.toThrow('Shutdown deadline');
  expect(log).toHaveBeenCalledWith({ event: 'shutdown', outcome: 'failed' });
});
it('terminates active connections on a bounded drain timeout', async () => {
  const entered = deferred();
  const application = await start({ config: { ...runtime, shutdownTimeoutMs: 20 }, database, signals, log,
    appFactory: () => (req, res) => { entered.resolve(); res.write('pending'); } });
  const client = http.get(`http://127.0.0.1:${application.server.address().port}/`, res => res.resume());
  client.on('error', () => {});
  await entered.promise;
  await expect(application.shutdown()).rejects.toThrow('Shutdown deadline');
  client.destroy();
  await new Promise(resolve => setImmediate(resolve));
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
it('handles SIGTERM and runtime listener errors safely', async () => {
  const application = await start({ config: runtime, database, signals, log });
  signals.emit('SIGTERM');
  await application.shutdown();
  await new Promise(resolve => setImmediate(resolve));
  expect(signals.exitCode).toBe(0);
  const again = await start({ config: runtime, database, signals, log });
  again.server.emit('error', new Error('private listener error'));
  await again.shutdown();
  expect(log).toHaveBeenCalledWith({ event: 'listener', outcome: 'failed' });
});
it('reports disconnect failures and exits on failed signal shutdown', async () => {
  database.disconnect.mockRejectedValue(new Error('private disconnect error'));
  const application = await start({ config: runtime, database, signals, log });
  signals.emit('SIGINT');
  await expect(application.shutdown()).rejects.toThrow();
  await new Promise(resolve => setImmediate(resolve));
  expect(signals.exit).toHaveBeenCalledWith(1);
});
it('refuses bootstrap TEST bypass', async () => {
  await expect(start({ config, database, signals, log })).rejects.toThrow('TEST mode cannot start');
  expect(database.connect).not.toHaveBeenCalled();
});
it('rejects incomplete, partial, sparse, collated and compound uniqueness indexes', async () => {
  for (const index of [{ key: { short_url: 1 } }, { key: { short_url: 1 }, unique: true, sparse: true },
    { key: { short_url: 1 }, unique: true, partialFilterExpression: {} }, { key: { short_url: 1 }, unique: true, collation: {} },
    { key: { short_url: 1, original_url: 1 }, unique: true }]) {
    await expect(requireUrlIndexes({ indexes: async () => [index] })).rejects.toThrow();
  }
});
it('awaits the real disconnect wrapper and exposes connection readiness only', async () => {
  const spy = jest.spyOn(mongoose.connection, 'close').mockResolvedValue();
  try { await mongoDB.disconnect(); expect(spy).toHaveBeenCalledTimes(1); expect(mongoDB.isReady()).toBe(false); }
  finally { spy.mockRestore(); }
});

it('awaits Redis startup before app creation, injects its counter, and closes it after drain', async () => {
  const connected = deferred();
  const client = { isReady: true, withCommandOptions: () => ({ eval: async () => [1, 1000] }) };
  const redis = { client, isReady: jest.fn(() => client.isReady), close: jest.fn().mockResolvedValue(), destroy: jest.fn() };
  const redisFactory = jest.fn(() => connected.promise);
  const appFactory = jest.fn(createApp);
  const starting = start({ config: { ...runtime, rateLimitStore: 'redis' }, database, signals, log, redisFactory, appFactory });
  await new Promise(resolve => setImmediate(resolve));
  expect(redisFactory).toHaveBeenCalledTimes(1);
  expect(appFactory).not.toHaveBeenCalled();
  connected.resolve(redis);
  const application = await starting;
  try {
    expect(appFactory.mock.calls[0][0].rateLimitCounter).toBeDefined();
    expect((await request(application.server).get('/health/ready')).status).toBe(200);
    client.isReady = false;
    expect((await request(application.server).get('/health/ready')).status).toBe(503);
    expect((await request(application.server).get('/health/live')).status).toBe(200);
    expect((await request(application.server).get('/api/url/42')).body.code).toBe('RATE_LIMIT_UNAVAILABLE');
  } finally { await application.shutdown(); }
  await application.shutdown();
  expect(redis.close).toHaveBeenCalledTimes(1);
  expect(database.disconnect).toHaveBeenCalledTimes(1);
});
it('cleans Mongo after Redis startup failure without opening HTTP or exposing credentials', async () => {
  const factory = jest.fn();
  const redisFactory = jest.fn().mockRejectedValue(new Error('rediss://:synthetic-private-secret@host'));
  await expect(start({ config: { ...runtime, rateLimitStore: 'redis' }, database, signals, log, redisFactory, serverFactory: factory })).rejects.toThrow();
  expect(factory).not.toHaveBeenCalled(); expect(database.disconnect).toHaveBeenCalledTimes(1);
  expect(log).toHaveBeenCalledWith({ event: 'startup', outcome: 'failed', code: 'REDIS_STARTUP_FAILED' });
  expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-secret');
});
it('closes Redis even when Mongo disconnect fails', async () => {
  const redis = { client: {}, isReady: () => true, close: jest.fn().mockResolvedValue(), destroy: jest.fn() };
  const application = await start({ config: { ...runtime, rateLimitStore: 'redis' }, database, signals, log, redisFactory: async () => redis });
  database.disconnect.mockRejectedValue(new Error('private disconnect failure'));
  await expect(application.shutdown()).rejects.toThrow();
  expect(redis.close).toHaveBeenCalledTimes(1);
});
it('never creates a Redis connection from createApp and requires injection for Redis mode', () => {
  expect(() => createApp({ config: { ...runtime, rateLimitStore: 'redis' } })).toThrow('Rate limit store unavailable');
});
