import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
function integer(env, name, fallback, min, max) {
  const value = env[name] || String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) throw new Error(`Invalid ${name}`);
  return Number(value);
}
// Pure parsing: tests never read a local .env or inherit database credentials.
export function parseConfig(env) {
  const environment = env.NODE_ENV || env.ENV || 'development';
  if (!['development', 'production', 'test'].includes(environment) ||
      (env.ENV && env.NODE_ENV && env.ENV !== env.NODE_ENV)) throw new Error('ENV and NODE_ENV must agree');
  if (env.TEST && !['true', 'false'].includes(env.TEST)) throw new Error('Invalid TEST');
  const test = env.TEST === 'true' || environment === 'test';
  if (test && environment === 'production') throw new Error('Production test mode is forbidden');
  const databaseName = environment === 'production' ? env.DB_NAME : env.TEST_DB_NAME;
  if (typeof env.OWNER_API_TOKEN !== 'string' || !/^[\x21-\x7e]{32,256}$/.test(env.OWNER_API_TOKEN)) throw new Error('OWNER_API_TOKEN must contain 32-256 non-whitespace ASCII characters');
  if (!test && (!databaseName || !/^mongodb(?:\+srv)?:\/\//.test(env.CONNECTION_URL || ''))) throw new Error('Database configuration is required');
  if (!test && (typeof databaseName !== 'string' || !/^[a-z\d_-]{1,63}$/i.test(databaseName))) throw new Error('Invalid database name');
  const bindHost = env.BIND_HOST || '0.0.0.0';
  if (!net.isIP(bindHost) && !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)*$/i.test(bindHost)) throw new Error('Invalid BIND_HOST');
  const githubBase = new URL(env.GITHUB_API_URL || 'https://api.github.com/');
  if (githubBase.protocol !== 'https:' || githubBase.username || githubBase.password ||
      githubBase.search || githubBase.hash || !githubBase.pathname.endsWith('/')) throw new Error('Invalid GitHub base URL');
  return Object.freeze({
    environment, test, databaseName, connectionUrl: env.CONNECTION_URL, ownerToken: env.OWNER_API_TOKEN,
    // Preserve the former wildcard bind unless an explicit bind address is supplied.
    bindHost,
    port: integer(env, 'PORT', test ? 0 : 3000, test ? 0 : 1, 65535),
    rateLimitWindowMs: integer(env, 'RATE_LIMIT_WINDOW_MS', 300000, 1, 3600000),
    rateLimitMax: integer(env, 'RATE_LIMIT_MAX', 50, 1, 100000),
    githubBase: githubBase.href,
    githubTimeoutMs: integer(env, 'GITHUB_TIMEOUT_MS', 5000, 1, 30000),
    shutdownTimeoutMs: integer(env, 'SHUTDOWN_TIMEOUT_MS', 10000, 1, 30000),
  });
}
export function loadConfig() {
  dotenv.config({ path: path.join(ROOT, '.env') });
  const config = parseConfig(process.env);
  process.env.NODE_ENV = config.environment;
  return config;
}
