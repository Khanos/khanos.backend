import { parseConfig } from '../config.js';
import { token } from './helpers/app.js';

const base = { OWNER_API_TOKEN: token, CONNECTION_URL: 'mongodb://127.0.0.1:27017', TEST_DB_NAME: 'isolated_development', DB_NAME: 'deployment', RATE_LIMIT_STORE: 'memory', RATE_LIMIT_SINGLE_PROCESS: 'true' };
it('explicitly chooses environment, database and bind address', () => {
  const dev = parseConfig(base);
  expect(dev.environment).toBe('development');
  expect(dev.databaseName).toBe('isolated_development');
  expect(dev.bindHost).toBe('0.0.0.0');
  expect(dev.port).toBe(3000);
  expect(parseConfig({ ...base, ENV: 'production', BIND_HOST: '127.0.0.1' }).databaseName).toBe('deployment');
  expect(parseConfig({ ...base, ENV: 'development', NODE_ENV: 'development' }).databaseName).toBe('isolated_development');
  expect(Object.isFrozen(dev)).toBe(true);
  expect(dev.trustedProxyCidrs).toBe(false);
  expect(dev.urlRateLimitMax).toEqual({ anonymous: 60, relay: 300, owner: 60 });
});
it.each([{ RATE_LIMIT_STORE: '' }, { RATE_LIMIT_STORE: 'unbounded' }, { RATE_LIMIT_SINGLE_PROCESS: '' },
  { RATE_LIMIT_PREFIX: 'unsafe key' }, { RATE_LIMIT_STORE_TIMEOUT_MS: '5001' },
  { RATE_LIMIT_SAFETY_MAX: '0' }, { URL_RATE_LIMIT_WINDOW_MS: '0' }, { URL_RATE_LIMIT_RELAY_MAX: '-1' },
  { URL_RATE_LIMIT_OWNER_MAX: 'NaN' }, { URL_RATE_LIMIT_ANONYMOUS_MAX: '100001' },
  { TRUSTED_PROXY_CIDRS: 'true' }, { TRUSTED_PROXY_CIDRS: '1' }, { TRUSTED_PROXY_CIDRS: '0.0.0.0/0' },
  { TRUSTED_PROXY_CIDRS: '::/0' }, { TRUSTED_PROXY_CIDRS: '192.0.2.0/33' }, { TRUSTED_PROXY_CIDRS: '::/129' },
  { TRUSTED_PROXY_CIDRS: '127.0.0.1/8/extra' }, { TRUSTED_PROXY_CIDRS: '127.0.0.1/NaN' },
  { TRUSTED_PROXY_CIDRS: Array(33).fill('127.0.0.1').join(',') }])('rejects unsafe limiter and proxy settings %#', patch => {
  expect(() => parseConfig({ ...base, ...patch })).toThrow();
});
it('accepts only explicitly configured Redis REST credentials and address ranges', () => {
  const redis = { ...base, RATE_LIMIT_STORE: 'redis', RATE_LIMIT_REDIS_REST_URL: 'https://counter.example/', RATE_LIMIT_REDIS_REST_TOKEN: 'synthetic-store-credential', TRUSTED_PROXY_CIDRS: '127.0.0.1, ::1/128,192.0.2.0/24' };
  expect(parseConfig(redis)).toMatchObject({ rateLimitStore: 'redis', rateLimitRedisUrl: 'https://counter.example/', trustedProxyCidrs: ['127.0.0.1', '::1/128', '192.0.2.0/24'] });
  for (const url of ['http://counter.example/', 'https://user:password@counter.example/', 'https://counter.example/?q=x', 'https://counter.example/#x', 'https://counter.example/path', 'invalid']) {
    expect(() => parseConfig({ ...redis, RATE_LIMIT_REDIS_REST_URL: url })).toThrow();
  }
  for (const token of ['', undefined, 'short', 'contains spaces and more']) {
    expect(() => parseConfig({ ...redis, RATE_LIMIT_REDIS_REST_TOKEN: token })).toThrow();
  }
});
it.each([{ TEST: 'true', NODE_ENV: 'production' }, { ENV: 'production', NODE_ENV: 'development' },
  { NODE_ENV: 'invalid' }, { TEST: 'yes' }, { OWNER_API_TOKEN: '' }, { OWNER_API_TOKEN: 'x'.repeat(257) },
  { DB_NAME: '', NODE_ENV: 'production' }, { TEST_DB_NAME: '' }, { CONNECTION_URL: 'invalid' },
  { BIND_HOST: 'https://localhost' }, { TEST_DB_NAME: '../invalid' }, { PORT: '3.5' }, { PORT: '70000' }, { RATE_LIMIT_WINDOW_MS: '0' }, { RATE_LIMIT_MAX: 'NaN' },
  { GITHUB_TIMEOUT_MS: '30001' }, { SHUTDOWN_TIMEOUT_MS: '-1' },
  { GITHUB_API_URL: 'http://example.com/' }, { GITHUB_API_URL: 'https://example.com/no-trailing-slash' },
  { GITHUB_API_URL: 'https://example.com/?query=x' }, { GITHUB_API_URL: 'https://example.com/#fragment' },
  { GITHUB_API_URL: 'https://synthetic:placeholder@example.com/' }])('rejects unsafe configuration %#', patch => {
  expect(() => parseConfig({ ...base, ...patch })).toThrow();
});
it('makes test mode explicit without connecting to any DB', () => {
  expect(parseConfig({ OWNER_API_TOKEN: token, TEST: 'true' }).test).toBe(true);
  expect(parseConfig({ OWNER_API_TOKEN: token, NODE_ENV: 'test' }).port).toBe(0);
});
