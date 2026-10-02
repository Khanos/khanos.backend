import { createHash, timingSafeEqual } from 'node:crypto';
import ApiError from '../utils/ApiError.js';

const digest = value => createHash('sha256').update(value).digest();
/** Single-owner administration. Credentials are accepted only in Authorization. */
export default function ownerAuth(token) {
  const expected = digest(token);
  return (req, res, next) => {
    const header = req.get('Authorization');
    if (typeof header !== 'string' || !/^Bearer [\x21-\x7e]{32,256}$/i.test(header) ||
        !timingSafeEqual(expected, digest(header.slice(7)))) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return next(new ApiError(401, 'UNAUTHORIZED', 'Owner authorization required'));
    }
    next();
  };
}
