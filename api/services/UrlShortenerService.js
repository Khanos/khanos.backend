import { randomInt } from 'node:crypto';
import UrlModel from '../models/UrlModel.js';
import ApiError from '../utils/ApiError.js';
import { validateUrl } from '../utils/index.js';

const PROJECTION = { _id: 1, original_url: 1, short_url: 1, creation_date: 1 };
// 2^47 numeric codes fit exactly in JS/BSON numbers and preserve numeric clients.
const allocateCode = () => randomInt(2 ** 47) + 2 ** 47;

export function createUrlService({ model = UrlModel, generateCode = allocateCode, log = () => {} } = {}) {
  async function database(operation, work) {
    try {
      const result = await work();
      log({ event: 'dependency', dependency: 'mongodb', operation, outcome: 'ok' });
      return result;
    } catch (error) {
      log({ event: 'dependency', dependency: 'mongodb', operation,
        outcome: error instanceof ApiError && error.status === 404 ? 'not_found' : 'failed' });
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable');
    }
  }
  const original = value => model.findOne({ original_url: value }, PROJECTION).collation({ locale: 'simple' }).lean();
  return {
    // Exact global reuse matches the previous intended policy; no canonicalization.
    async create(original_url) {
      if (!validateUrl(original_url)) throw new ApiError(400, 'INVALID_URL', 'Invalid URL');
      return database('create', async () => {
        const existing = await original(original_url);
        if (existing) return existing;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const record = await model.create({ original_url, short_url: generateCode() });
            return { _id: record._id, original_url: record.original_url,
              short_url: record.short_url, creation_date: record.creation_date };
          } catch (error) {
            if (error.code !== 11000) throw error;
            // A competing request may have won the original URL index; code
            // collisions retry with a fresh code. Neither case overwrites a link.
            const winner = await original(original_url);
            if (winner) return winner;
          }
        }
        throw new ApiError(503, 'CODE_ALLOCATION_FAILED', 'Unable to allocate short code');
      });
    },
    async getUrl(short_url) {
      return database('lookup', async () => {
        const record = await model.findOne({ short_url }, PROJECTION).lean();
        if (!record) throw new ApiError(404, 'URL_NOT_FOUND', 'URL not found');
        return record;
      });
    },
    async deleteShortUrl(short_url) {
      return database('delete', async () => {
        const record = await model.findOneAndDelete({ short_url }, { projection: PROJECTION }).lean();
        if (!record) throw new ApiError(404, 'URL_NOT_FOUND', 'URL not found');
        return record;
      });
    },
    async getUrlList({ limit, after }) {
      return database('list', async () => {
        const records = await model.find(after ? { _id: { $gt: after } } : {}, PROJECTION)
          .sort({ _id: 1 }).limit(limit + 1).lean();
        const more = records.length > limit;
        const data = records.slice(0, limit);
        return { error: false, message: 'URLs found', data,
          pagination: { limit, next: more ? String(data[data.length - 1]._id) : null } };
      });
    },
  };
}
