import { jest } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { start } from '../../lifecycle.js';
import mongoose from 'mongoose';
import request from 'supertest';
import BlogPostModel from '../../api/models/BlogPostModel.js';
import UrlModel from '../../api/models/UrlModel.js';
import { createUrlService } from '../../api/services/UrlShortenerService.js';
import { hashCode } from '../../api/utils/index.js';
import mongoDB, { requireUrlIndexes } from '../../db.js';
import { preflight } from '../../scripts/url-preflight.js';
import { migrateUrlIndexes } from '../../scripts/url-index-migration.js';
import { startMongo } from '../helpers/mongo.js';
import { appFor, authorization, config } from '../helpers/app.js';

let mongo;
let connection;
let model;
beforeAll(async () => {
  mongo = await startMongo();
  connection = await mongoose.createConnection(mongo.uri, { autoIndex: false, autoCreate: false }).asPromise();
  model = connection.model('UrlModel', UrlModel.schema.clone());
  await model.createCollection();
  const blogs = connection.model('BlogPostModel', BlogPostModel.schema.clone());
  await blogs.createCollection();
  await blogs.createIndexes();
  await model.createIndexes(); // Explicitly isolated, never configured production/test databases.
}, 20000);
afterAll(async () => {
  if (connection) await connection.close();
  if (mongo) await mongo.stop();
});
beforeEach(async () => { await model.deleteMany({}); });

it('resolves legacy padded and new codes through the public router without changing stored mappings', async () => {
  await model.create([{ original_url: 'https://example.com/legacy', short_url: 42 },
    { original_url: 'https://example.com/new', short_url: 200000000000001 }]);
  const app = appFor({ urlService: createUrlService({ model }) });
  expect((await request(app).get('/api/url/0042')).body.original_url).toBe('https://example.com/legacy');
  expect((await request(app).get('/api/url/200000000000001')).body.original_url).toBe('https://example.com/new');
  expect((await request(app).get('/api/url')).status).toBe(401);
  expect((await request(app).delete('/api/url/delete/0042')).status).toBe(401);
  expect(await model.countDocuments()).toBe(2);
  expect((await model.findOne({ short_url: 42 })).short_url).toBe(42);
});

it('preserves numeric legacy lookup and separates the documented colliding URLs', async () => {
  const first = 'https://example.com/782'; const second = 'https://example.com/1000';
  expect(hashCode(first)).toBe(hashCode(second));
  await model.create({ original_url: first, short_url: 9376 });
  const service = createUrlService({ model });
  expect((await service.create(first)).short_url).toBe(9376);
  const created = await service.create(second);
  expect(created.original_url).toBe(second);
  expect(created.short_url).toBeGreaterThanOrEqual(2 ** 47);
  expect(created.short_url).toBeLessThan(2 ** 48);
  expect((await service.getUrl(9376)).original_url).toBe(first);
});
it('retries an actual MongoDB unique-code collision without changing an issued code', async () => {
  await model.create({ original_url: 'https://example.com/existing', short_url: 9376 });
  let calls = 0;
  const service = createUrlService({ model, generateCode: () => ++calls === 1 ? 9376 : 2 ** 47 });
  expect((await service.create('https://example.com/new')).short_url).toBe(2 ** 47);
  expect(calls).toBe(2);
  expect((await service.getUrl(9376)).original_url).toBe('https://example.com/existing');
});
it('handles simultaneous identical creates with one persisted record and one code', async () => {
  const service = createUrlService({ model });
  const results = await Promise.all(Array.from({ length: 32 }, () => service.create('https://example.com/concurrent')));
  expect(new Set(results.map(record => record.short_url)).size).toBe(1);
  expect(await model.countDocuments()).toBe(1);
});
it('handles simultaneous distinct creates without code reuse', async () => {
  const service = createUrlService({ model });
  const results = await Promise.all(Array.from({ length: 32 }, (_, i) => service.create(`https://example.com/distinct/${i}`)));
  expect(new Set(results.map(record => record.short_url)).size).toBe(32);
  expect(await model.countDocuments()).toBe(32);
});
it('enforces both real uniqueness constraints', async () => {
  await model.create({ original_url: 'https://example.com', short_url: 10 });
  await expect(model.create({ original_url: 'https://example.com/other', short_url: 10 })).rejects.toMatchObject({ code: 11000 });
  await expect(model.create({ original_url: 'https://example.com', short_url: 11 })).rejects.toMatchObject({ code: 11000 });
  await expect(requireUrlIndexes(model.collection)).resolves.toBeUndefined();
});
it('paginates stable projected records through the real router and indexed _id query', async () => {
  await model.create(Array.from({ length: 5 }, (_, i) => ({ original_url: `https://example.com/page/${i}`, short_url: i })));
  const app = appFor({ urlService: createUrlService({ model }) });
  const first = await request(app).get('/api/url?limit=2').set('Authorization', authorization);
  const second = await request(app).get(`/api/url?limit=2&after=${first.body.pagination.next}`).set('Authorization', authorization);
  const third = await request(app).get(`/api/url?limit=2&after=${second.body.pagination.next}`).set('Authorization', authorization);
  expect([...first.body.data, ...second.body.data, ...third.body.data].map(item => item.short_url)).toEqual([0, 1, 2, 3, 4]);
  expect(third.body.pagination.next).toBeNull();
  expect(first.body.data[0]).not.toHaveProperty('__v');
  const plan = await model.find({ _id: { $gt: new mongoose.Types.ObjectId(first.body.pagination.next) } }).sort({ _id: 1 }).limit(2).explain('executionStats');
  expect(plan.executionStats.totalDocsExamined).toBeLessThanOrEqual(2);
});
it('returns real database not-found as 404 and an unavailable connection as 503', async () => {
  const app = appFor({ urlService: createUrlService({ model }) });
  expect((await request(app).get('/api/url/123')).status).toBe(404);
  const unavailable = mongoose.createConnection();
  const offline = unavailable.model('OfflineURL', UrlModel.schema.clone());
  try {
    const app = appFor({ urlService: createUrlService({ model: offline }) });
    expect((await request(app).get('/api/url/123')).status).toBe(503);
  } finally { await unavailable.close(); }
});
it('reproduces the legacy unconstrained check-then-insert race and preflights it read-only', async () => {
  const collection = connection.db.collection('legacy_race');
  await collection.deleteMany({});
  const original_url = 'https://example.com/782';
  // Synchronize the old check-then-insert pattern before any writes occur.
  const misses = await Promise.all(Array.from({ length: 16 }, () => collection.findOne({ short_url: hashCode(original_url) })));
  expect(misses.every(item => item === null)).toBe(true);
  await Promise.all(misses.map(() => collection.insertOne({ original_url, short_url: hashCode(original_url), creation_date: new Date() })));
  expect(await collection.countDocuments()).toBe(16);
  await collection.insertOne({ original_url: 'file:///tmp', short_url: 'invalid', creation_date: 'invalid' });
  const before = await collection.countDocuments();
  expect(await preflight(collection)).toEqual({ records: 17, invalidRecords: 1, duplicateCodeGroups: 1, duplicateOriginalGroups: 1, requiredIndexesPresent: false });
  expect(await collection.countDocuments()).toBe(before);
  await expect(requireUrlIndexes(collection)).rejects.toThrow('Required URL uniqueness');
  expect(await preflight(model.collection)).toEqual({ records: 0, invalidRecords: 0, duplicateCodeGroups: 0, duplicateOriginalGroups: 0, requiredIndexesPresent: true });
});

it('boots the real database adapter against only the disposable database', async () => {
  try {
    await mongoDB.connect({ connectionUrl: mongo.uri, databaseName: 'khanos_architecture_test' });
    expect(mongoDB.isReady()).toBe(true);
  } finally { await mongoose.connection.close(); }
});

it('keeps exact global reuse even with a case-insensitive collection default', async () => {
  const schema = UrlModel.schema.clone();
  const caseModel = connection.model('CaseURL', schema, 'case_urls');
  await caseModel.createCollection({ collation: { locale: 'en', strength: 2 } });
  await caseModel.createIndexes();
  const service = createUrlService({ model: caseModel });
  const upper = await service.create('https://example.com/Case');
  const lower = await service.create('https://example.com/case');
  expect(upper.short_url).not.toBe(lower.short_url);
  await expect(requireUrlIndexes(caseModel.collection)).resolves.toBeUndefined();
  expect((await preflight(caseModel.collection)).duplicateOriginalGroups).toBe(0);
});

it('preflights a missing collection without creating it', async () => {
  const empty = connection.db.collection('untouched_preflight');
  expect(await preflight(empty)).toEqual({ records: 0, invalidRecords: 0, duplicateCodeGroups: 0,
    duplicateOriginalGroups: 0, requiredIndexesPresent: false });
  expect(await connection.db.listCollections({ name: 'untouched_preflight' }).toArray()).toHaveLength(0);
});

it('uses one URL application operation for authorized concurrent real-router creates', async () => {
  const app = appFor({ urlService: createUrlService({ model }) });
  const responses = await Promise.all(Array.from({ length: 16 }, () => request(app).post('/api/url/create')
    .set('Authorization', authorization).send({ original_url: 'https://example.com/router-concurrent' })));
  expect(responses.every(response => response.status === 200)).toBe(true);
  expect(new Set(responses.map(response => response.body.short_url)).size).toBe(1);
  expect(await model.countDocuments()).toBe(1);
});
it('refuses to listen with a real database whose required indexes are absent', async () => {
  const factory = jest.fn();
  await expect(start({ config: { ...config, test: false, connectionUrl: mongo.uri,
    databaseName: 'khanos_missing_index_test' }, serverFactory: factory, log: () => {} })).rejects.toThrow();
  expect(factory).not.toHaveBeenCalled();
  expect(mongoose.connection.readyState).toBe(0);
  expect(connection.readyState).toBe(1); // Disconnect only the application's owned connection.
});

it('explicitly migrates clean legacy records, preserves mappings and retries idempotently', async () => {
  const collection = connection.db.collection('index_migration');
  await collection.insertMany([{ original_url: 'https://example.com/migration/legacy', short_url: 42, creation_date: new Date() },
    { original_url: 'https://example.com/migration/new', short_url: 200000000000001, creation_date: new Date() }]);
  const before = await collection.find().sort({ _id: 1 }).toArray();
  const planned = await migrateUrlIndexes(collection);
  expect(planned).toMatchObject({ records: 2, mode: 'dry-run', requiredIndexesPresent: false, blockedBy: null,
    pendingIndexes: ['unique_short_code', 'unique_original_url'], createdIndexes: [] });
  expect(await collection.indexes()).toHaveLength(1);
  await expect(requireUrlIndexes(collection)).rejects.toMatchObject({ code: 'URL_INDEXES_MISSING' });
  expect(await migrateUrlIndexes(collection, { apply: true })).toMatchObject({ requiredIndexesPresent: true,
    createdIndexes: ['unique_short_code', 'unique_original_url'] });
  expect(await collection.find().sort({ _id: 1 }).toArray()).toEqual(before);
  expect((await migrateUrlIndexes(collection, { apply: true })).createdIndexes).toEqual([]);
  await expect(collection.insertOne({ ...before[0], _id: new mongoose.Types.ObjectId() })).rejects.toMatchObject({ code: 11000 });
  await expect(requireUrlIndexes(collection)).resolves.toBeUndefined();
});

it('blocks migration on duplicate or invalid data without creating indexes or changing records', async () => {
  const collection = connection.db.collection('blocked_migration');
  await collection.insertMany([{ original_url: 'https://example.com/duplicate', short_url: 42, creation_date: new Date() },
    { original_url: 'https://example.com/duplicate', short_url: 42, creation_date: new Date() },
    { original_url: 'file:///invalid', short_url: 43, creation_date: new Date() }]);
  const before = await collection.find().toArray();
  expect(await migrateUrlIndexes(collection)).toMatchObject({ blockedBy: 'URL_MIGRATION_DATA_CONFLICT' });
  await expect(migrateUrlIndexes(collection, { apply: true })).rejects.toMatchObject({ code: 'URL_MIGRATION_DATA_CONFLICT' });
  expect(await collection.find().toArray()).toEqual(before);
  expect(await collection.indexes()).toHaveLength(1);
});

it('blocks existing index conflicts and leaves existing indexes intact', async () => {
  const collection = connection.db.collection('conflicting_migration');
  await collection.createIndex({ short_url: 1 }, { name: 'legacy_code_index' });
  const before = await collection.indexes();
  expect(await migrateUrlIndexes(collection)).toMatchObject({ blockedBy: 'URL_MIGRATION_INDEX_CONFLICT' });
  await expect(migrateUrlIndexes(collection, { apply: true })).rejects.toMatchObject({ code: 'URL_MIGRATION_INDEX_CONFLICT' });
  expect(await collection.indexes()).toEqual(before);
});

it('plans a missing collection read-only and requires explicit apply to create its indexes', async () => {
  const collection = connection.db.collection('missing_migration');
  expect(await migrateUrlIndexes(collection)).toMatchObject({ records: 0, requiredIndexesPresent: false, mode: 'dry-run' });
  expect(await connection.db.listCollections({ name: 'missing_migration' }).toArray()).toHaveLength(0);
  expect(await migrateUrlIndexes(collection, { apply: true })).toMatchObject({ requiredIndexesPresent: true });
});

it('reports partial index builds safely and completes them on an explicit retry', async () => {
  const collection = connection.db.collection('partial_migration');
  await collection.insertOne({ original_url: 'https://example.com/partial', short_url: 42, creation_date: new Date() });
  const createIndex = collection.createIndex.bind(collection);
  const spy = jest.spyOn(collection, 'createIndex').mockImplementationOnce(createIndex)
    .mockRejectedValueOnce(new Error('synthetic-private-index-error'));
  try {
    await expect(migrateUrlIndexes(collection, { apply: true })).rejects.toMatchObject({ code: 'URL_INDEX_BUILD_FAILED',
      message: 'URL index migration could not be completed', createdIndexes: ['unique_short_code'] });
    expect((await collection.indexes()).filter(index => index.unique).map(index => index.name)).toEqual(['unique_short_code']);
  } finally { spy.mockRestore(); }
  expect((await migrateUrlIndexes(collection, { apply: true })).createdIndexes).toEqual(['unique_original_url']);
  expect(await collection.countDocuments()).toBe(1);
});

it('rejects a reserved index name on a different field before building any index', async () => {
  const collection = connection.db.collection('named_index_conflict');
  await collection.createIndex({ unrelated: 1 }, { name: 'unique_original_url' });
  const before = await collection.indexes();
  await expect(migrateUrlIndexes(collection, { apply: true })).rejects.toMatchObject({ code: 'URL_MIGRATION_INDEX_CONFLICT' });
  expect(await collection.indexes()).toEqual(before);
  await expect(migrateUrlIndexes(collection, { apply: 'true' })).rejects.toMatchObject({ code: 'INVALID_MIGRATION_ARGUMENTS' });
});

it('runs the actual migration CLI only against the explicitly selected disposable database', async () => {
  const databaseName = 'khanos_index_cli_test';
  const collection = connection.getClient().db(databaseName).collection('urlmodels');
  await collection.insertOne({ original_url: 'https://example.com/cli', short_url: 42, creation_date: new Date() });
  const script = fileURLToPath(new URL('../../scripts/url-index-migration.js', import.meta.url));
  const env = { PATH: process.env.PATH, MIGRATION_MONGODB_URI: mongo.uri, MIGRATION_DB_NAME: databaseName };
  const planned = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 10000 });
  expect(planned.status).toBe(0);
  expect(planned.stderr).toBe('');
  expect(JSON.parse(planned.stdout)).toMatchObject({ mode: 'dry-run', records: 1, requiredIndexesPresent: false });
  expect(await collection.indexes()).toHaveLength(1);
  const applied = spawnSync(process.execPath, [script, '--apply'], { env, encoding: 'utf8', timeout: 10000 });
  expect(applied.status).toBe(0);
  expect(applied.stderr).toBe('');
  expect(JSON.parse(applied.stdout)).toMatchObject({ mode: 'apply', records: 1, requiredIndexesPresent: true });
  await expect(requireUrlIndexes(collection)).resolves.toBeUndefined();
}, 20000);
