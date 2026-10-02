import { jest } from '@jest/globals';
import request from 'supertest';
import { createLogger } from '../logger.js';
import { createGithubService } from '../api/services/GithubService.js';
import { appFor } from './helpers/app.js';

it('logs safe fields only with generated correlation IDs and route templates', async () => {
  const sink = jest.fn();
  const log = createLogger(sink);
  const app = appFor({ log, urlService: { getUrl: async () => ({ short_url: 123 }) } });
  const response = await request(app).get('/api/url/123?private=synthetic-query').set('Cookie', 'synthetic-private-cookie').set('X-Request-ID', 'untrusted');
  expect(response.headers['x-request-id']).toMatch(/^[a-f0-9-]{36}$/);
  expect(response.headers['x-request-id']).not.toBe('untrusted');
  const records = sink.mock.calls.map(([line]) => JSON.parse(line));
  expect(records[0]).toMatchObject({ event: 'request', requestId: response.headers['x-request-id'], route: '/api/url/:short_url', status: 200 });
  expect(JSON.stringify(records)).not.toMatch(/synthetic-query|synthetic-private-cookie|untrusted/);
  log({ event: 'dependency', dependency: 'github', operation: 'search', outcome: 'failed', code: 'GITHUB_TIMEOUT', token: 'private', headers: 'private', url: 'private', exception: 'private' });
  expect(sink.mock.calls.at(-1)[0]).not.toContain('private');
});
it('correlates unmatched errors without logging raw URLs', async () => {
  const sink = jest.fn();
  const response = await request(appFor({ log: createLogger(sink) })).get('/api/unknown?private=synthetic');
  expect(response.body.requestId).toBe(response.headers['x-request-id']);
  expect(sink.mock.calls.map(([line]) => JSON.parse(line))).toEqual(expect.arrayContaining([
    expect.objectContaining({ event: 'request', route: 'unmatched', status: 404 }),
    expect.objectContaining({ event: 'request_error', code: 'NOT_FOUND', requestId: response.body.requestId }),
  ]));
});

it('associates dependency outcomes with the owning request without logging search text', async () => {
  const sink = jest.fn();
  const log = createLogger(sink);
  const service = createGithubService({ baseUrl: 'https://api.github.com/', timeoutMs: 1000,
    log, fetchImpl: async () => ({ ok: false, status: 404 }) });
  const response = await request(appFor({ log, githubService: service })).get('/api/github/getCommits/synthetic-search');
  const records = sink.mock.calls.map(([line]) => JSON.parse(line));
  expect(records.find(record => record.event === 'dependency')).toMatchObject({ requestId: response.body.requestId, dependency: 'github', outcome: 'failed' });
  expect(JSON.stringify(records)).not.toContain('synthetic-search');
});
