import { jest } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import mongoose from 'mongoose';
import request from 'supertest';
import BlogPostModel from '../../api/models/BlogPostModel.js';
import { createBlogService } from '../../api/services/BlogService.js';
import { requireBlogIndexes } from '../../db.js';
import { readBlogSources, portableContent } from '../../scripts/blog-source.js';
import { importBlog } from '../../scripts/blog-import.js';
import { startMongo } from '../helpers/mongo.js';
import { appFor, authorization } from '../helpers/app.js';

let mongo, connection, model, app;
const input = (slug = 'en/test-post', extra = {}) => ({ slug, title: 'Test post', content: '# Heading\n\nA **useful** post.',
  coverImage: '/blog-assets/images/test.jpg', language: slug.split('/')[0], status: 'published', publishedAt: '2026-01-01T00:00:00.000Z', ...extra });
beforeAll(async () => {
  mongo = await startMongo();
  connection = await mongoose.createConnection(mongo.uri, { autoIndex: false, autoCreate: false }).asPromise();
  model = connection.model('BlogPostModel', BlogPostModel.schema.clone());
  await model.createCollection();
  await model.createIndexes();
  app = appFor({ blogService: createBlogService({ model, now: () => new Date('2026-10-03T00:00:00Z') }) });
}, 20000);
afterAll(async () => { if (connection) await connection.close(); if (mongo) await mongo.stop(); });
beforeEach(async () => { await model.deleteMany({}); });
const create = body => request(app).post('/api/blog').set('Authorization', authorization).send(body);
const get = slug => request(app).get(`/api/blog/${encodeURIComponent(slug)}`);
const adminList = query => request(app).get('/api/blog/admin').set('Authorization', authorization).query(query || {});
const adminGet = id => request(app).get(`/api/blog/admin/${id}`).set('Authorization', authorization);

it('requires owner authorization on both admin reads before accessing persistence', async () => {
  const list = jest.spyOn(model, 'find');
  const lookup = jest.spyOn(model, 'findById');
  try {
    for (const path of ['/api/blog/admin', '/api/blog/admin/000000000000000000000001']) {
      for (const header of [undefined, 'Bearer incorrect-owner-token-0000000000000000', 'Basic invalid']) {
        let req = request(app).get(path);
        if (header) req = req.set('Authorization', header);
        const response = await req;
        expect(response.status).toBe(401);
        expect(response.headers['www-authenticate']).toBe('Bearer');
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.body).toEqual({ error: 'Owner authorization required', code: 'UNAUTHORIZED', requestId: response.headers['x-request-id'] });
      }
      expect((await request(app).get(path).query({ token: authorization })).status).toBe(401);
    }
    expect(list).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  } finally { list.mockRestore(); lookup.mockRestore(); }
});

it('shows draft A, published B and future C only to the owner; C becomes public at its publication time', async () => {
  const posts = [];
  for (const body of [input('en/draft-a', { status: 'draft', publishedAt: undefined }), input('en/published-b'),
    input('es/future-c', { publishedAt: '2026-10-04T00:00:00Z' })]) {
    const response = await create(body);
    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    posts.push(response.body);
  }
  const publicList = await request(app).get('/api/blog').set('Authorization', authorization);
  expect(publicList.body.data.map(post => post.slug)).toEqual(['en/published-b']);
  expect(publicList.headers['cache-control']).toBe('public, max-age=0, s-maxage=60');
  for (const post of posts) {
    const publicPost = await get(post.slug).set('Authorization', authorization);
    expect(publicPost.status).toBe(post.slug === 'en/published-b' ? 200 : 404);
    const privatePost = await adminGet(post.id);
    expect(privatePost.status).toBe(200);
    expect(privatePost.body).toEqual(post);
    expect(privatePost.headers['cache-control']).toBe('no-store');
  }
  const ownerList = await adminList();
  expect(ownerList.status).toBe(200);
  expect(ownerList.headers['cache-control']).toBe('no-store');
  expect(ownerList.body.pagination).toEqual({ page: 1, limit: 25, total: 3, pages: 1 });
  expect(ownerList.body.data.map(post => post.id).sort()).toEqual(posts.map(post => post.id).sort());
  for (const summary of ownerList.body.data) {
    expect(summary).not.toHaveProperty('content');
    expect(summary).not.toHaveProperty('_id');
    expect(summary).not.toHaveProperty('__v');
  }
  const later = appFor({ blogService: createBlogService({ model, now: () => new Date('2026-10-04T00:00:00Z') }) });
  expect((await request(later).get('/api/blog')).body.data.map(post => post.slug)).toEqual(['en/published-b', 'es/future-c']);
  expect((await request(later).get('/api/blog/es%2Ffuture-c')).status).toBe(200);
  expect((await request(later).get('/api/blog/en%2Fdraft-a')).status).toBe(404);
});

it('filters admin status/language/category and paginates every allowed sort with stable slug ties', async () => {
  const posts = [];
  for (const body of [input('en/a-post', { status: 'draft', publishedAt: undefined, categories: ['react'] }),
    input('en/b-post', { categories: ['react'] }), input('es/c-post', { publishedAt: '2030-01-01' })]) {
    posts.push((await create(body)).body);
  }
  // Fixed timestamps in this disposable database make ordering deterministic.
  const dates = ['2026-01-01', '2026-02-01', '2026-03-01'];
  for (let i = 0; i < posts.length; i++) {
    await model.collection.updateOne({ _id: new mongoose.Types.ObjectId(posts[i].id) },
      { $set: { createdAt: new Date(dates[i]), updatedAt: new Date(dates[2 - i]) } });
  }
  expect((await adminList({ status: 'draft' })).body.data.map(post => post.slug)).toEqual(['en/a-post']);
  expect((await adminList({ status: 'published' })).body.pagination.total).toBe(2);
  expect((await adminList({ language: 'es' })).body.data.map(post => post.slug)).toEqual(['es/c-post']);
  expect((await adminList({ status: 'published', language: 'en', category: 'react' })).body.data.map(post => post.slug)).toEqual(['en/b-post']);
  expect((await adminList({ category: 'absent' })).body).toEqual({ data: [], pagination: { page: 1, limit: 25, total: 0, pages: 0 } });
  for (const [sort, expected] of [[undefined, ['en/a-post', 'en/b-post', 'es/c-post']],
    ['updatedAt', ['en/a-post', 'en/b-post', 'es/c-post']], ['createdAt', ['es/c-post', 'en/b-post', 'en/a-post']],
    ['publishedAt', ['es/c-post', 'en/b-post', 'en/a-post']], ['slug', ['en/a-post', 'en/b-post', 'es/c-post']]]) {
    const first = await adminList({ ...(sort ? { sort } : {}), limit: 2 });
    expect(first.body.data.map(post => post.slug)).toEqual(expected.slice(0, 2));
    expect(first.body.pagination).toEqual({ page: 1, limit: 2, total: 3, pages: 2 });
    const second = await adminList({ ...(sort ? { sort } : {}), limit: 2, page: 2 });
    expect(second.body.data.map(post => post.slug)).toEqual(expected.slice(2));
  }
  await model.collection.updateMany({}, { $set: { updatedAt: new Date('2026-01-01') } });
  expect((await adminList()).body.data.map(post => post.slug)).toEqual(['en/a-post', 'en/b-post', 'es/c-post']);
  expect((await adminList({ page: 1000, limit: 100 })).body.data).toEqual([]);
});

it.each(['status=scheduled', 'status=', 'language=fr', 'page=0', 'page=1001', 'page=1.5', 'limit=101', 'limit=-1',
  'sort=title', 'sort=updatedAt&sort=slug', 'status=draft&status=published', 'language=en&language=es',
  'page=1&page=2', 'limit=1&limit=2', 'category=react&category=next', 'category=', 'category=' + 'x'.repeat(81),
  'status[$ne]=draft', 'language[$in][]=en', 'category[$regex]=.*', 'sort[$gt]=slug', 'page[x]=1',
  '$where=bad', 'unknown=value', 'token=bad'])('rejects malformed or unsafe admin query %s', async query => {
  const response = await request(app).get(`/api/blog/admin?${query}`).set('Authorization', authorization);
  expect(response.status).toBe(400);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body).toEqual({ error: 'Invalid blog input', code: 'INVALID_BLOG_INPUT', requestId: response.headers['x-request-id'] });
});

it('returns safe admin ID errors and masks database failures for both reads', async () => {
  for (const id of ['invalid', 'A'.repeat(24), '%24where', '%ZZ']) {
    const response = await adminGet(id);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: id === '%ZZ' ? 'INVALID_REQUEST' : 'INVALID_BLOG_INPUT', requestId: response.headers['x-request-id'] });
    expect(response.headers['cache-control']).toBe('no-store');
  }
  const missing = await adminGet('000000000000000000000001');
  expect(missing.status).toBe(404);
  expect(missing.body).toEqual({ error: 'Blog post not found', code: 'BLOG_NOT_FOUND', requestId: missing.headers['x-request-id'] });
  for (const [method, read] of [['countDocuments', () => adminList()], ['findById', () => adminGet('000000000000000000000001')]]) {
    const failure = new Error('private database credentials');
    const spy = method === 'findById' ? jest.spyOn(model, method).mockReturnValueOnce({ lean: async () => { throw failure; } })
      : jest.spyOn(model, method).mockRejectedValueOnce(failure);
    try {
      const response = await read();
      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: 'Database unavailable', code: 'DATABASE_UNAVAILABLE', requestId: response.headers['x-request-id'] });
      expect(response.headers['cache-control']).toBe('no-store');
    } finally { spy.mockRestore(); }
  }
});

it('supports the complete admin editorial flow while preserving write derivation and public visibility', async () => {
  const body = input('en/admin-flow'); delete body.status; delete body.publishedAt;
  const created = await create(body);
  expect(created.status).toBe(201);
  expect(created.body.status).toBe('draft');
  expect((await adminGet(created.body.id)).body).toEqual(created.body);
  const patch = data => request(app).patch(`/api/blog/${created.body.id}`).set('Authorization', authorization).send(data);
  const changed = await patch({ content: Array(201).fill('word').join(' ') });
  expect(changed.status).toBe(200);
  expect(changed.body.status).toBe('draft');
  expect(changed.body.excerpt).toBe(changed.body.content.slice(0, 400));
  expect(changed.body.readingMinutes).toBe(2);
  expect((await get(body.slug)).status).toBe(404);
  const published = await patch({ status: 'published' });
  expect(published.body.publishedAt).toBe('2026-10-03T00:00:00.000Z');
  expect((await get(body.slug)).body).toEqual(published.body);
  const edited = await patch({ content: 'Published edit', excerpt: 'Explicit summary' });
  expect(edited.body.excerpt).toBe('Explicit summary');
  expect(edited.body.readingMinutes).toBe(1);
  expect((await get(body.slug)).body.content).toBe('Published edit');
  const scheduled = await patch({ publishedAt: '2030-01-01T00:00:00Z' });
  expect(scheduled.body.status).toBe('published');
  expect((await get(body.slug)).status).toBe(404);
  expect((await adminGet(created.body.id)).body).toEqual(scheduled.body);
  const deleted = await request(app).delete(`/api/blog/${created.body.id}`).set('Authorization', authorization);
  expect(deleted.body).toEqual({ id: created.body.id });
  expect((await adminGet(created.body.id)).status).toBe(404);
  expect((await get(body.slug)).status).toBe(404);
  for (const response of [created, changed, published, edited, scheduled, deleted]) {
    expect(response.headers['cache-control']).toBe('no-store');
  }
});

it.each(['post', 'patch'])('rejects Mongo operators in owner %s bodies without changing stored data', async method => {
  const created = await create(input());
  const response = await request(app)[method](method === 'post' ? '/api/blog' : `/api/blog/${created.body.id}`)
    .set('Authorization', authorization).send(method === 'post' ? { ...input('en/unsafe'), $set: { status: 'published' } } : { title: { $ne: null } });
  expect(response.status).toBe(400);
  expect(response.body.code).toBe('INVALID_BLOG_INPUT');
  expect((await adminGet(created.body.id)).body).toEqual(created.body);
  expect(await model.countDocuments()).toBe(1);
});

it('lists summaries, loads published bodies, filters languages/categories and preserves ordering', async () => {
  await create(input('en/b-post', { categories: ['react'] }));
  await create(input('en/a-post', { publishedAt: '2026-02-01T00:00:00Z' }));
  await create(input('es/c-post'));
  const page = await request(app).get('/api/blog?status=published&language=en&limit=1');
  expect(page.status).toBe(200);
  expect(page.headers['cache-control']).toContain('s-maxage=60');
  expect(page.body.pagination).toEqual({ page: 1, limit: 1, total: 2, pages: 2 });
  expect(page.body.data.map(post => post.slug)).toEqual(['en/a-post']);
  expect(page.body.data[0]).not.toHaveProperty('content');
  expect(page.body.data[0]).not.toHaveProperty('_id');
  expect(page.body.data[0]).not.toHaveProperty('__v');
  expect((await request(app).get('/api/blog?language=en&page=2&limit=1')).body.data[0].slug).toBe('en/b-post');
  expect((await request(app).get('/api/blog?category=react')).body.data.map(post => post.slug)).toEqual(['en/b-post']);
  expect((await request(app).get('/api/blog?sort=publishedAt')).body.data[0].slug).toBe('en/a-post');
  const article = await get('en/b-post');
  expect(article.status).toBe(200);
  expect(article.body.content).toBe(input().content);
  expect(article.body.publishedAt).toBe('2026-01-01T00:00:00.000Z');
  expect(article.body.readingMinutes).toBe(1);
});
it('does not expose drafts, future publications or unknown slugs, even with owner credentials', async () => {
  const draft = await create(input('en/draft', { status: 'draft' }));
  expect(draft.status).toBe(201);
  await create(input('en/future', { publishedAt: '2030-01-01' }));
  for (const slug of ['en/draft', 'en/future', 'en/unknown']) {
    const response = await get(slug).set('Authorization', authorization);
    expect(response.status).toBe(404);
    expect(response.headers['cache-control']).toBe('no-store');
  }
  expect((await request(app).get('/api/blog')).body.pagination.total).toBe(0);
  expect((await request(app).get('/api/blog?status=draft')).status).toBe(400);
});
it('creates drafts by default and permits the owner to publish, update and delete by MongoDB ID', async () => {
  const body = input(); delete body.status; delete body.publishedAt;
  const draft = await create(body);
  expect(draft.body.status).toBe('draft');
  expect(draft.body.publishedAt).toBeUndefined();
  const changed = await request(app).patch(`/api/blog/${draft.body.id}`).set('Authorization', authorization)
    .send({ status: 'published', content: 'Updated content', author: 'Writer', anonymous: true });
  expect(changed.status).toBe(200);
  expect(changed.body.content).toBe('Updated content');
  expect(changed.body.excerpt).toBe('Updated content');
  expect(changed.body.publishedAt).toBe('2026-10-03T00:00:00.000Z');
  expect(changed.body.createdAt).toBe(draft.body.createdAt);
  expect(new Date(changed.body.updatedAt).getTime()).toBeGreaterThanOrEqual(Date.parse(draft.body.updatedAt));
  expect((await get('en/test-post')).status).toBe(200);
  const revised = await request(app).patch(`/api/blog/${draft.body.id}`).set('Authorization', authorization).send({ title: 'Revised', excerpt: 'Custom summary' });
  expect(revised.status).toBe(200);
  expect(revised.body.excerpt).toBe('Custom summary');
  const deleted = await request(app).delete(`/api/blog/${draft.body.id}`).set('Authorization', authorization);
  expect(deleted.status).toBe(200);
  expect(deleted.body).toEqual({ id: draft.body.id });
  expect((await get('en/test-post')).status).toBe(404);
});
it('enforces unique slugs on creation, concurrent creation and update, including paired languages', async () => {
  const first = await create(input());
  expect((await create(input())).status).toBe(409);
  expect((await create(input('es/test-post'))).status).toBe(201);
  const second = await create(input('en/second'));
  expect((await request(app).patch(`/api/blog/${second.body.id}`).set('Authorization', authorization).send({ slug: 'en/test-post' })).status).toBe(409);
  const concurrent = await Promise.all([create(input('en/concurrent')), create(input('en/concurrent'))]);
  expect(concurrent.map(response => response.status).sort()).toEqual([201, 409]);
  expect(await model.countDocuments({ slug: 'en/concurrent' })).toBe(1);
  expect((await get('en/test-post')).body.id).toBe(first.body.id);
});
it('blocks unauthorized writes before invoking persistence', async () => {
  for (const header of [undefined, 'Bearer incorrect-owner-token-0000000000000000']) {
    for (const method of ['post', 'patch', 'delete']) {
      let req = request(app)[method](method === 'post' ? '/api/blog' : '/api/blog/000000000000000000000001');
      if (header) req = req.set('Authorization', header);
      const response = await req.send(input());
      expect(response.status).toBe(401);
      expect(response.headers['cache-control']).toBe('no-store');
    }
  }
  expect(await model.countDocuments()).toBe(0);
});
it.each(['patch', 'delete'])('returns 404 for missing owner %s targets and 400 for invalid IDs', async method => {
  expect((await request(app)[method]('/api/blog/000000000000000000000001').set('Authorization', authorization).send({ title: 'Unknown' })).status).toBe(404);
  expect((await request(app)[method]('/api/blog/invalid').set('Authorization', authorization).send({ title: 'Unknown' })).status).toBe(400);
});
it('migrates all original posts, verifies content, charts, metadata and idempotent retries', async () => {
  const posts = await readBlogSources();
  expect(posts).toHaveLength(12);
  const planned = await importBlog(model, posts);
  expect(planned).toMatchObject({ mode: 'dry-run', pendingPosts: 12, blockedBy: null });
  expect(await model.countDocuments()).toBe(0);
  expect(await importBlog(model, posts, { apply: true })).toMatchObject({ importedPosts: 12, verifiedPosts: 12 });
  const before = await model.find().sort({ slug: 1 }).lean();
  expect((await importBlog(model, posts, { apply: true })).importedPosts).toBe(0);
  expect(await model.find().sort({ slug: 1 }).lean()).toEqual(before);
  for (const post of posts) {
    const stored = (await get(post.slug)).body;
    expect(stored.content).toBe(post.content);
    expect(stored).toMatchObject({ slug: post.slug, title: post.title, coverImage: post.coverImage, categories: post.categories, language: post.language, excerpt: post.excerpt, displayDate: post.displayDate });
    expect(stored.publishedAt).toBe(post.publishedAt);

  }
  for (const post of posts.filter(item => item.slug.includes('6-state'))) {
    const stored = (await get(post.slug)).body;
    expect(stored.content).not.toMatch(/import SurveyChart|<SurveyChart|\{format/);
    expect(stored.content.match(/data-chart=/g)).toHaveLength(6);
    expect(stored.content).toContain('<details>');
    expect(stored.anonymous).toBe(true);
  }
  const recent = await request(app).get('/api/blog?language=en&sort=publishedAt&limit=3');
  expect(recent.body.data.map(post => post.slug.split('/')[1][0])).toEqual(['6', '5', '4']);
  await model.updateOne({ slug: posts[0].slug }, { title: 'Owner edit' });
  expect((await importBlog(model, posts, { apply: true })).blockedBy).toBe('BLOG_DATA_CONFLICT');
  expect((await model.findOne({ slug: posts[0].slug })).title).toBe('Owner edit');
});
it('preflights missing/conflicting indexes and creates indexes only on explicit import', async () => {
  const target = connection.model('UnindexedBlog', BlogPostModel.schema.clone(), 'unindexed_blog');
  const posts = [input()];
  // readBlogSources prepares derived fields used by the importer.
  const sources = (await readBlogSources()).slice(0, 1);
  expect((await importBlog(target, sources)).pendingIndexes).toEqual(['unique_blog_slug', 'blog_publication']);
  expect(await connection.db.listCollections({ name: 'unindexed_blog' }).toArray()).toHaveLength(0);
  await expect(requireBlogIndexes(target.collection)).rejects.toMatchObject({ code: 'BLOG_INDEXES_MISSING' });
  expect((await importBlog(target, sources, { apply: true })).verifiedPosts).toBe(1);
  await expect(requireBlogIndexes(target.collection)).resolves.toBeUndefined();
  const conflict = connection.model('ConflictingBlog', BlogPostModel.schema.clone(), 'conflicting_blog');
  await conflict.collection.createIndex({ slug: 1 }, { name: 'legacy_slug' });
  expect((await importBlog(conflict, sources, { apply: true })).blockedBy).toBe('BLOG_INDEX_CONFLICT');
  expect(await conflict.countDocuments()).toBe(0);
  await expect(importBlog(target, [])).rejects.toThrow();
  await expect(importBlog(target, [...posts, ...posts])).rejects.toThrow();
});
it('runs the actual CLI against a disposable target and masks configuration failures', () => {
  const env = { PATH: process.env.PATH, MIGRATION_MONGODB_URI: mongo.uri, MIGRATION_DB_NAME: 'blog_cli_test' };
  const script = 'scripts/blog-import.js';
  const args = { env, encoding: 'utf8', timeout: 10000 };
  const check = spawnSync(process.execPath, [script, '--source-check'], args);
  expect(check.status).toBe(0);
  expect(JSON.parse(check.stdout).sourcePosts).toBe(12);
  const plan = spawnSync(process.execPath, [script], args);
  expect(plan.status).toBe(0);
  expect(JSON.parse(plan.stdout).pendingPosts).toBe(12);
  const apply = spawnSync(process.execPath, [script, '--apply'], args);
  expect(apply.status).toBe(0);
  expect(JSON.parse(apply.stdout).verifiedPosts).toBe(12);
  const retry = spawnSync(process.execPath, [script, '--apply'], args);
  expect(JSON.parse(retry.stdout).importedPosts).toBe(0);
  const bad = spawnSync(process.execPath, [script, '--invalid'], args);
  expect(bad.status).toBe(1);
  expect(bad.stderr).not.toContain(mongo.uri);
}, 20000);
it('rejects executable or unknown MDX expressions without evaluation', () => {
  expect(() => portableContent('{process.exit()}')).toThrow();
  expect(() => portableContent('{survey.unknown}')).toThrow();
  expect(() => portableContent('<SurveyChart kind="unknown" />')).toThrow();
});
it('maps storage validation and dependency failures to safe API errors', async () => {
  for (const [error, status] of [[new Error('private database detail'), 503], [{ name: 'ValidationError' }, 400]]) {
    const spy = jest.spyOn(model, 'create').mockRejectedValueOnce(error);
    try {
      const response = await create(input());
      expect(response.status).toBe(status);
      expect(JSON.stringify(response.body)).not.toContain('private');
    } finally { spy.mockRestore(); }
  }
});
it('returns 404 when a concurrent delete wins during update', async () => {
  const created = await create(input());
  const spy = jest.spyOn(model, 'findByIdAndUpdate').mockReturnValueOnce({ lean: async () => null });
  try { expect((await request(app).patch(`/api/blog/${created.body.id}`).set('Authorization', authorization).send({ title: 'Change' })).status).toBe(404); }
  finally { spy.mockRestore(); }
});

it('uses the default clock for publication when no date is supplied', async () => {
  const service = createBlogService({ model });
  const body = input('en/default-clock'); delete body.publishedAt;
  const created = await service.create(body);
  expect(created.publishedAt).toBeInstanceOf(Date);
  expect((await service.get(body.slug)).slug).toBe(body.slug);
});

it('serves cacheable public cover images across the frontend origin', async () => {
  const response = await request(app).get('/blog-assets/images/laptop-workspace-unsplash.jpg');
  expect(response.status).toBe(200);
  expect(response.headers['content-type']).toContain('image/jpeg');
  expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
  expect(response.headers['cache-control']).toContain('max-age=3600');
  expect(response.headers.etag).toBeDefined();
});

it('keeps simultaneous import retries idempotent, including creation/update timestamps', async () => {
  const sources = (await readBlogSources()).slice(0, 2);
  const reports = await Promise.all([importBlog(model, sources, { apply: true }), importBlog(model, sources, { apply: true })]);
  expect(reports.reduce((total, report) => total + report.importedPosts, 0)).toBe(2);
  expect(await model.countDocuments()).toBe(2);
  const before = await model.find().lean();
  await importBlog(model, sources, { apply: true });
  expect(await model.find().lean()).toEqual(before);
});
