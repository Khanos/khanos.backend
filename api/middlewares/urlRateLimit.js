import { isIP } from 'node:net';
import { ipKeyGenerator } from 'express-rate-limit';
import { createOwnerVerifier } from './ownerAuth.js';
import ApiError from '../utils/ApiError.js';

/** Quota classification never trusts a credential's presence or caller-supplied IP headers. */
export default function createUrlRateLimit({ config, counter }) {
  const verify = createOwnerVerifier(config.ownerToken);
  const verifyAdmission = config.admissionToken && createOwnerVerifier(config.admissionToken);
  return async (req, res, next) => {
    const path = req.path.toLowerCase().replace(/\/+$/, '');
    const isUrl = path === '/api/url' || path.startsWith('/api/url/');
    if (isUrl) {
      res.setHeader('Cache-Control', 'no-store');
      res.vary('Authorization');
    }
    const authenticated = isUrl && verify(req.get('Authorization'));
    const lookup = (req.method === 'GET' || req.method === 'HEAD') && /^\/api\/url\/[^/]+$/.test(path);
    const bucket = authenticated ? (lookup ? 'relay' : 'owner') : (isUrl ? 'anonymous' : 'api');
    const maximum = bucket === 'api' ? config.rateLimitMax : config.urlRateLimitMax[bucket];
    const windowMs = bucket === 'api' ? config.rateLimitWindowMs : config.urlRateLimitWindowMs;
    const reject = (operation, resetMs) => {
      req.app.locals.log({ event: 'rate_limit', operation, outcome: 'limited' });
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Retry-After', String(Math.min(3600, Math.max(1, Math.ceil(resetMs / 1000)))));
      return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    };
    try {
      if (!isIP(req.ip) || (config.rateLimitProxyMode === 'heroku' && !req.get('X-Forwarded-For'))) {
        throw new Error('Client identity unavailable');
      }
      const identity = authenticated ? 'owner-principal' : ipKeyGenerator(req.ip);
      // Documented emergency ceiling is deliberately shared by all non-health traffic.
      const safety = await counter.consume('safety:aggregate', config.urlRateLimitWindowMs);
      // Globally blocked new identities must not allocate another counter key.
      if (safety.count > config.rateLimitSafetyMax) return reject('safety', safety.resetMs);
      // Authenticated admission uses its own four buckets, never the unrelated API
      // per-egress-IP budget. It still pays the shared backend emergency ceiling.
      if (req.method === 'POST' && path === '/api/admission' && verifyAdmission?.(req.get('Authorization'))) return next();
      const operation = await counter.consume(`${bucket}:${identity}`, windowMs);
      if (operation.count > maximum) return reject(bucket, operation.resetMs);
      next();
    } catch {
      req.app.locals.log({ event: 'rate_limit', operation: bucket, outcome: 'unavailable' });
      res.setHeader('Cache-Control', 'no-store');
      next(new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Service temporarily unavailable'));
    }
  };
}
