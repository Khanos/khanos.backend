import { jest } from '@jest/globals';
import { createUrlService } from '../../api/services/UrlShortenerService.js';

const record = { _id: 'record', original_url: 'https://example.com', short_url: 123, creation_date: new Date() };
let model;
let service;
let log;
const query = value => ({ lean: () => Promise.resolve(value), collation() { return this; } });
beforeEach(() => {
  model = { findOne: jest.fn().mockReturnValue(query(null)), create: jest.fn().mockResolvedValue(record), findOneAndDelete: jest.fn().mockReturnValue(query(record)) };
  log = jest.fn();
  service = createUrlService({ model, generateCode: () => 123, log });
});
it('reuses by exact original URL, never by a small hash', async () => {
  model.findOne.mockReturnValue(query(record));
  expect(await service.create(record.original_url)).toEqual(record);
  expect(model.findOne.mock.calls[0][0]).toEqual({ original_url: record.original_url });
  expect(model.create).not.toHaveBeenCalled();
});
it('creates a projected record and retries code collisions', async () => {
  model.create.mockRejectedValueOnce({ code: 11000 });
  expect(await service.create(record.original_url)).toEqual(record);
  expect(model.create).toHaveBeenCalledTimes(2);
});
it('returns the competing winner for identical concurrent creation', async () => {
  model.findOne.mockReturnValueOnce(query(null)).mockReturnValueOnce(query(record));
  model.create.mockRejectedValue({ code: 11000 });
  expect(await service.create(record.original_url)).toEqual(record);
  expect(model.create).toHaveBeenCalledTimes(1);
});
it('bounds exhausted allocation retries', async () => {
  model.create.mockRejectedValue({ code: 11000 });
  await expect(service.create(record.original_url)).rejects.toMatchObject({ status: 503, code: 'CODE_ALLOCATION_FAILED' });
  expect(model.create).toHaveBeenCalledTimes(5);
});
it('fails before persistence on invalid URL', async () => {
  await expect(service.create({})).rejects.toMatchObject({ status: 400 });
  expect(model.findOne).not.toHaveBeenCalled();
});
it('never allocates after a database lookup failure', async () => {
  model.findOne.mockImplementation(() => { throw new Error('private detail'); });
  await expect(service.create(record.original_url)).rejects.toMatchObject({ status: 503, message: 'Database unavailable' });
  expect(model.create).not.toHaveBeenCalled();
  expect(JSON.stringify(log.mock.calls)).not.toContain('private detail');
});
it('classifies create failures without exposing underlying details', async () => {
  model.create.mockRejectedValue(new Error('private'));
  await expect(service.create(record.original_url)).rejects.toMatchObject({ status: 503 });
});
it('handles successful/missing lookups and deletions separately', async () => {
  model.findOne.mockReturnValueOnce(query(record)).mockReturnValueOnce(query(null));
  expect(await service.getUrl(123)).toEqual(record);
  await expect(service.getUrl(123)).rejects.toMatchObject({ status: 404 });
  expect(await service.deleteShortUrl(123)).toEqual(record);
  model.findOneAndDelete.mockReturnValue(query(null));
  await expect(service.deleteShortUrl(123)).rejects.toMatchObject({ status: 404 });
});
it('caps reads, uses indexed ordering and returns next cursor', async () => {
  const lean = jest.fn().mockResolvedValue([record, { ...record, _id: 'next' }]);
  const limit = jest.fn().mockReturnValue({ lean });
  const sort = jest.fn().mockReturnValue({ limit });
  model.find = jest.fn().mockReturnValue({ sort });
  expect(await service.getUrlList({ limit: 1, after: 'cursor' })).toEqual({ error: false, message: 'URLs found', data: [record], pagination: { limit: 1, next: 'record' } });
  expect(model.find.mock.calls[0][0]).toEqual({ _id: { $gt: 'cursor' } });
  expect(sort).toHaveBeenCalledWith({ _id: 1 });
  expect(limit).toHaveBeenCalledWith(2);
  lean.mockResolvedValue([]);
  expect((await service.getUrlList({ limit: 25 })).pagination.next).toBeNull();
});
