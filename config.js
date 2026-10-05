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
function trustedProxies(value = '') {
  if (!value) return false;
  const addresses = value.split(',').map(address => address.trim());
  if (addresses.length > 32 || addresses.some(address => {
    const [ip, mask, extra] = address.split('/');
    const family = net.isIP(ip);
    return !family || extra !== undefined || (mask !== undefined &&
      (!/^\d+$/.test(mask) || Number(mask) < 1 || Number(mask) > (family === 4 ? 32 : 128)));
  })) throw new Error('Invalid TRUSTED_PROXY_CIDRS');
  return Object.freeze(addresses);
}
// Pure parsing: tests never read a local .env or inherit database credentials.
export function parseConfig(env) {
  const environment = env.NODE_ENV || env.ENV || 'development';
  if (!['development', 'production', 'test'].includes(environment) ||
      (env.ENV && env.NODE_ENV && env.ENV !== env.NODE_ENV)) throw new Error('ENV and NODE_ENV must agree');
  if (env.TEST && !['true', 'false'].includes(env.TEST)) throw new Error('Invalid TEST');
  const test = env.TEST === 'true' || environment === 'test';
  if (test && environment === 'production') throw new Error('Production test mode is forbidden');
  const rateLimitStore = env.RATE_LIMIT_STORE || (test ? 'memory' : undefined);
  if (!['memory', 'redis'].includes(rateLimitStore)) throw new Error('RATE_LIMIT_STORE must be explicitly configured');
  if (rateLimitStore === 'memory' && !test && env.RATE_LIMIT_SINGLE_PROCESS !== 'true') throw new Error('Memory rate limits require RATE_LIMIT_SINGLE_PROCESS=true');
  let rateLimitRedisUrl;
  if (rateLimitStore === 'redis') {
    const url = new URL(env.RATE_LIMIT_REDIS_REST_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Invalid RATE_LIMIT_REDIS_REST_URL');
    if (typeof env.RATE_LIMIT_REDIS_REST_TOKEN !== 'string' || !/^[\x21-\x7e]{16,512}$/.test(env.RATE_LIMIT_REDIS_REST_TOKEN)) throw new Error('Invalid RATE_LIMIT_REDIS_REST_TOKEN');
    rateLimitRedisUrl = url.href;
  }
  const rateLimitPrefix = env.RATE_LIMIT_PREFIX || 'khanos:backend:limits:v1';
  if (!/^[a-z\d:_-]{1,64}$/i.test(rateLimitPrefix)) throw new Error('Invalid RATE_LIMIT_PREFIX');
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
    rateLimitStore, rateLimitRedisUrl, rateLimitRedisToken: env.RATE_LIMIT_REDIS_REST_TOKEN,
    rateLimitPrefix,
    rateLimitStoreTimeoutMs: integer(env, 'RATE_LIMIT_STORE_TIMEOUT_MS', 1000, 1, 5000),
    rateLimitSafetyMax: integer(env, 'RATE_LIMIT_SAFETY_MAX', 5000, 1, 100000),
    urlRateLimitWindowMs: integer(env, 'URL_RATE_LIMIT_WINDOW_MS', 60000, 1, 3600000),
    urlRateLimitMax: Object.freeze({
      anonymous: integer(env, 'URL_RATE_LIMIT_ANONYMOUS_MAX', 60, 1, 100000),
      relay: integer(env, 'URL_RATE_LIMIT_RELAY_MAX', 300, 1, 100000),
      owner: integer(env, 'URL_RATE_LIMIT_OWNER_MAX', 60, 1, 100000),
    }),
    trustedProxyCidrs: trustedProxies(env.TRUSTED_PROXY_CIDRS),
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
