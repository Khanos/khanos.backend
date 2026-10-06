import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import express from 'express';
import { ipKeyGenerator } from 'express-rate-limit';
import { createOwnerVerifier } from './ownerAuth.js';
import ApiError from '../utils/ApiError.js';

// Fixed server-owned policy: clients cannot choose a threshold, window or Redis key.
const policies = new Map([
  ['aggregate', { max: 5000, windowMs: 60000 }],
  ['owner', { max: 120, windowMs: 60000 }],
  ['failure', { max: 20, windowMs: 600000 }],
  ['resolver', { max: 60, windowMs: 60000 }],
]);

/** Only the trusted frontend may assert its Vercel ingress identity over HTTPS. */
export default function createAdmission({ config, counter }) {
  const verify = config.admissionToken && createOwnerVerifier(config.admissionToken);
  const authenticate = (req, res, next) => {
    req.logRoute = '/api/admission';
    res.setHeader('Cache-Control', 'no-store');
    res.vary('Authorization');
    if (!config.admissionToken) return next(new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Service temporarily unavailable'));
    if (!verify(req.get('Authorization'))) return next(new ApiError(401, 'UNAUTHORIZED', 'Admission authorization required'));
    if (!req.is('application/json')) return next(new ApiError(415, 'UNSUPPORTED_ENCODING', 'JSON required'));
    next();
  };
  const consume = async (req, res, next) => {
    const body = req.body;
    if (!body || Array.isArray(body) || Object.keys(body).length !== 3 ||
        !['production', 'preview'].includes(body.environment) || !policies.has(body.kind) || typeof body.clientIp !== 'string' || !isIP(body.clientIp)) {
      return next(new ApiError(400, 'INVALID_REQUEST', 'Invalid admission request'));
    }
    const { max, windowMs } = policies.get(body.kind);
    const identity = body.kind === 'aggregate' ? 'owner-emergency' : ipKeyGenerator(body.clientIp);
    // Hash before passing identities even to injected/memory stores. Redis also
    // hashes the complete namespaced key using the existing atomic adapter.
    const key = `frontend:${body.environment}:${body.kind}:${createHash('sha256').update(identity).digest('hex')}`;
    try {
      const result = await counter.consume(key, windowMs);
      if (result.count > max) {
        req.app.locals.log({ event: 'rate_limit', operation: `frontend_${body.kind}`, outcome: 'limited' });
        res.setHeader('Retry-After', String(Math.min(3600, Math.max(1, Math.ceil(result.resetMs / 1000)))));
        return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
      }
      res.status(204).end();
    } catch {
      req.app.locals.log({ event: 'rate_limit', operation: `frontend_${body.kind}`, outcome: 'unavailable' });
      next(new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Service temporarily unavailable'));
    }
  };
  return [authenticate, express.json({ limit: '1kb', strict: true }), consume];
}
