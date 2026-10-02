import ApiError from '../utils/ApiError.js';
import { shortCode, positiveInteger } from '../utils/index.js';

/** Thin HTTP adapter; allocation/reuse and persistence policy live in the service. */
export default function createUrlController(service) {
  return {
    /** GET /api/url: bounded list, ordered by immutable _id; optional after cursor. */
    async index(req, res) {
      const limit = positiveInteger(req.query.limit, 25, 100);
      const after = req.query.after;
      if (after !== undefined && (typeof after !== 'string' || !/^[a-f0-9]{24}$/.test(after))) {
        throw new ApiError(400, 'INVALID_PAGINATION', 'Invalid pagination');
      }
      res.json(await service.getUrlList({ limit, after }));
    },
    /** POST /api/url/create: successful create/reuse remains HTTP 200. */
    async create(req, res) {
      res.json(await service.create(req.body?.original_url));
    },
    /** DELETE /api/url/delete/:short_url: missing record is 404. */
    async delete(req, res) {
      res.json(await service.deleteShortUrl(shortCode(req.params.short_url)));
    },
    /** GET /api/url/:short_url: legacy numeric codes remain addressable. */
    async getUrl(req, res) {
      res.json(await service.getUrl(shortCode(req.params.short_url)));
    },
  };
}
