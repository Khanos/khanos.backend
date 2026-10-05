import { createHash, timingSafeEqual } from 'node:crypto';
import ApiError from '../utils/ApiError.js';

const digest = value => createHash('sha256').update(value).digest();
/** Optional authentication shares the same comparison as the required owner boundary. */
export function createOwnerVerifier(token) {
  const expected = digest(token);
  return header => typeof header === 'string' && /^Bearer [\x21-\x7e]{32,256}$/i.test(header) &&
    timingSafeEqual(expected, digest(header.slice(7)));
}
/** Single-owner administration. Credentials are accepted only in Authorization. */
export default function ownerAuth(token) {
  const verify = createOwnerVerifier(token);
  return (req, res, next) => {
    const header = req.get('Authorization');
    if (!verify(header)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return next(new ApiError(401, 'UNAUTHORIZED', 'Owner authorization required'));
    }
    next();
  };
}
