import { jest } from '@jest/globals';
import request from 'supertest';
import { appFor, authorization } from '../helpers/app.js';
import ApiError from '../../api/utils/ApiError.js';
import { createUrlService } from '../../api/services/UrlShortenerService.js';

const record = { original_url: 'https://example.com', short_url: 123, creation_date: '2026-01-01' };
let service;
let app;
beforeEach(() => {
  service = { create: jest.fn().mockResolvedValue(record), getUrl: jest.fn().mockResolvedValue(record),
    deleteShortUrl: jest.fn().mockResolvedValue(record), getUrlList: jest.fn().mockResolvedValue({ error: false, message: 'URLs found', data: [], pagination: { limit: 25, next: null } }) };
  app = appFor({ urlService: service });
});

describe('actual URL router and owner policy', () => {
  it.each([['get', '/api/url'], ['post', '/api/url/create'], ['delete', '/api/url/delete/123']])('protects %s %s', async (method, path) => {
    for (const header of [undefined, 'Bearer wrong', 'Basic invalid', `Bearer ${'x'.repeat(64)}`]) {
      const call = request(app)[method](path);
      if (header) call.set('Authorization', header);
      const response = await call.send({ original_url: 'https://example.com' });
      expect(response.status).toBe(401);
      expect(response.headers['www-authenticate']).toBe('Bearer');
      expect(response.body.code).toBe('UNAUTHORIZED');
    }
    expect(Object.values(service).every(fn => fn.mock.calls.length === 0)).toBe(true);
  });
  it('never accepts an owner credential in a query parameter', async () => {
    expect((await request(app).get('/api/url').query({ token: 'synthetic-query-value' })).status).toBe(401);
  });
  it('accepts auth scheme casing while keeping credential bytes case-sensitive', async () => {
    expect((await request(app).get('/api/url').set('Authorization', authorization.replace('Bearer', 'bearer'))).status).toBe(200);
    expect((await request(app).get('/api/url').set('Authorization', authorization.toUpperCase())).status).toBe(401);
  });
  it('keeps lookup public and preserves numeric legacy lookup', async () => {
    const response = await request(app).get('/api/url/123');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(record);
    expect(service.getUrl).toHaveBeenCalledWith(123);
    expect((await request(app).get('/api/url/0')).status).toBe(200);
  });
  it('uses the production deletion path', async () => {
    const response = await request(app).delete('/api/url/delete/123').set('Authorization', authorization);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(record);
    expect(service.deleteShortUrl).toHaveBeenCalledWith(123);
  });
  it('preserves success documents and accepts form bodies', async () => {
    const response = await request(app).post('/api/url/create').set('Authorization', authorization)
      .type('form').send({ original_url: record.original_url });
    expect(response.body).toEqual(record);
    expect(service.create).toHaveBeenCalledWith(record.original_url);
  });
  it('forwards a missing body as invalid input rather than crashing', async () => {
    const app = appFor({ urlService: createUrlService() });
    const response = await request(app).post('/api/url/create').set('Authorization', authorization);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_URL');
  });
  it.each(['-1', '0123', '1e3', '1.5', '9007199254740992', 'abc'])('rejects malformed code %s', async (code) => {
    expect((await request(app).get(`/api/url/${code}`)).status).toBe(400);
    expect(service.getUrl).not.toHaveBeenCalled();
  });
  it('separates missing records from database failures', async () => {
    service.getUrl.mockRejectedValueOnce(new ApiError(404, 'URL_NOT_FOUND', 'URL not found'))
      .mockRejectedValueOnce(new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable'));
    expect((await request(app).get('/api/url/123')).status).toBe(404);
    expect((await request(app).get('/api/url/123')).status).toBe(503);
    service.deleteShortUrl.mockRejectedValue(new ApiError(404, 'URL_NOT_FOUND', 'URL not found'));
    expect((await request(app).delete('/api/url/delete/123').set('Authorization', authorization)).status).toBe(404);
  });
  it('uses bounded defaults and passes an opaque cursor', async () => {
    const response = await request(app).get('/api/url').set('Authorization', authorization);
    expect(response.status).toBe(200);
    expect(service.getUrlList).toHaveBeenCalledWith({ limit: 25, after: undefined });
    await request(app).get('/api/url?limit=100&after=012345678901234567890abc').set('Authorization', authorization);
    expect(service.getUrlList).toHaveBeenLastCalledWith({ limit: 100, after: '012345678901234567890abc' });
  });
  it.each(['limit=0', 'limit=101', 'limit=2&limit=3', 'after=', 'after=bad', 'after=a&after=b'])('rejects bad pagination %s', async query => {
    const response = await request(app).get(`/api/url?${query}`).set('Authorization', authorization);
    expect(response.status).toBe(400);
    expect(service.getUrlList).not.toHaveBeenCalled();
  });
});

it.each([{}, 123, 'ftp://example.com', 'https://example.com/path with space'])('returns real-router 400 for invalid URL input %#', async original_url => {
  const response = await request(appFor({ urlService: createUrlService() })).post('/api/url/create')
    .set('Authorization', authorization).send({ original_url });
  expect(response.status).toBe(400);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.body.code).toBe('INVALID_URL');
});
