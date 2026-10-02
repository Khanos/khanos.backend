import { parseConfig } from '../config.js';
import { token } from './helpers/app.js';

const base = { OWNER_API_TOKEN: token, CONNECTION_URL: 'mongodb://127.0.0.1:27017', TEST_DB_NAME: 'isolated_development', DB_NAME: 'deployment' };
it('explicitly chooses environment, database and bind address', () => {
  const dev = parseConfig(base);
  expect(dev.environment).toBe('development');
  expect(dev.databaseName).toBe('isolated_development');
  expect(dev.bindHost).toBe('0.0.0.0');
  expect(dev.port).toBe(3000);
  expect(parseConfig({ ...base, ENV: 'production', BIND_HOST: '127.0.0.1' }).databaseName).toBe('deployment');
  expect(parseConfig({ ...base, ENV: 'development', NODE_ENV: 'development' }).databaseName).toBe('isolated_development');
  expect(Object.isFrozen(dev)).toBe(true);
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
