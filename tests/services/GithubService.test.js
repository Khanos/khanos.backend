import { jest } from '@jest/globals';
import http from 'node:http';
import request from 'supertest';
import { createGithubService } from '../../api/services/GithubService.js';
import { appFor } from '../helpers/app.js';

const paging = { page: 1, perPage: 30 };
const search = { items: [], total_count: 0, incomplete_results: false };
const ok = value => ({ ok: true, json: async () => value });
let fetchImpl;
let log;
let service;
beforeEach(() => {
  fetchImpl = jest.fn().mockResolvedValue(ok(search));
  log = jest.fn();
  service = createGithubService({ baseUrl: 'https://api.github.com/', timeoutMs: 1000, fetchImpl, log });
});
it('encodes public phrase search and does not permit query parameter injection', async () => {
  expect(await service.getCommitsByWord('fix & page=3 #1', paging)).toEqual(search);
  const [url, options] = fetchImpl.mock.calls[0];
  expect(new URL(url).searchParams.get('q')).toBe('"fix & page=3 #1"');
  expect(new URL(url).searchParams.get('page')).toBe('1');
  expect(options.redirect).toBe('error');
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(options.headers.Accept).toBe('application/vnd.github+json');
});
it('validates owner and repository and explicitly paginates', async () => {
  fetchImpl.mockResolvedValue(ok([]));
  expect(await service.getCommitsByRepoAndOwner('khanos.backend', 'Khanos', { page: 2, perPage: 100 })).toEqual([]);
  expect(fetchImpl.mock.calls[0][0]).toBe('https://api.github.com/repos/Khanos/khanos.backend/commits?page=2&per_page=100');
});
it.each([undefined, {}, '', '  ', 'a'.repeat(201), 'line\nbreak', '"quoted"', 'back\\slash'])('rejects invalid search text %#', async word => {
  await expect(service.getCommitsByWord(word, paging)).rejects.toMatchObject({ status: 400 });
  expect(fetchImpl).not.toHaveBeenCalled();
});
it.each([[{}, 'owner'], ['repo', {}], ['repo', '-owner'], ['repo', 'owner/other'], ['.', 'owner'], ['..', 'owner'], ['../repo', 'owner'], ['x'.repeat(101), 'owner']])('rejects invalid repo/owner %#', async (repo, owner) => {
  await expect(service.getCommitsByRepoAndOwner(repo, owner, paging)).rejects.toMatchObject({ status: 400 });
});
it.each([[404, 404, 'GITHUB_NOT_FOUND'], [403, 503, 'GITHUB_LIMITED'], [429, 503, 'GITHUB_LIMITED'], [400, 502, 'GITHUB_UPSTREAM_ERROR'], [401, 502, 'GITHUB_UPSTREAM_ERROR'], [500, 502, 'GITHUB_UPSTREAM_ERROR'], [503, 502, 'GITHUB_UPSTREAM_ERROR']])('classifies upstream %i without exposing error bodies', async (upstream, status, code) => {
  const cancel = jest.fn();
  const json = jest.fn();
  fetchImpl.mockResolvedValue({ ok: false, status: upstream, body: { cancel }, json });
  await expect(service.getCommitsByWord('test', paging)).rejects.toMatchObject({ status, code });
  expect(json).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalled();
  expect(fetchImpl).toHaveBeenCalledTimes(upstream === 503 ? 2 : 1);
});
it('supports upstream errors with no body', async () => {
  fetchImpl.mockResolvedValue({ ok: false, status: 404, body: null });
  await expect(service.getCommitsByWord('test', paging)).rejects.toMatchObject({ status: 404 });
});
it('retries only transient reads within the same deadline', async () => {
  fetchImpl.mockResolvedValueOnce({ ok: false, status: 502 }).mockResolvedValueOnce(ok(search));
  expect(await service.getCommitsByWord('test', paging)).toEqual(search);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  fetchImpl.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(ok(search));
  expect(await service.getCommitsByWord('test', paging)).toEqual(search);
});
it('bounds network retries', async () => {
  fetchImpl.mockRejectedValue(new Error('synthetic-private-detail'));
  await expect(service.getCommitsByWord('test', paging)).rejects.toMatchObject({ status: 502, code: 'GITHUB_UNAVAILABLE' });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(log.mock.calls)).not.toContain('synthetic-private-detail');
});
it.each([null, {}, { items: {}, total_count: 0, incomplete_results: false }, { items: [], total_count: '0', incomplete_results: false }, { items: [], total_count: 0 }])('rejects malformed search response %#', async value => {
  fetchImpl.mockResolvedValue(ok(value));
  await expect(service.getCommitsByWord('test', paging)).rejects.toMatchObject({ code: 'GITHUB_INVALID_RESPONSE' });
});
it('rejects non-array commit lists and invalid JSON', async () => {
  fetchImpl.mockResolvedValue(ok({}));
  await expect(service.getCommitsByRepoAndOwner('repo', 'owner', paging)).rejects.toMatchObject({ status: 502 });
  fetchImpl.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('private body'); } });
  await expect(service.getCommitsByWord('test', paging)).rejects.toMatchObject({ code: 'GITHUB_INVALID_RESPONSE' });
});
it('aborts the whole application deadline, without retrying timeout', async () => {
  const fetchImpl = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
  }));
  const service = createGithubService({ baseUrl: 'https://api.github.com/', timeoutMs: 10, fetchImpl });
  await expect(service.getCommitsByWord('test', paging)).rejects.toMatchObject({ status: 504 });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
it('honors both prior and subsequent caller cancellation', async () => {
  const fetchImpl = jest.fn((url, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'));
    signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
  }));
  const service = createGithubService({ baseUrl: 'https://api.github.com/', timeoutMs: 1000, fetchImpl });
  const before = new AbortController(); before.abort();
  await expect(service.getCommitsByWord('test', paging, before.signal)).rejects.toMatchObject({ status: 504 });
  const during = new AbortController();
  const operation = service.getCommitsByWord('test', paging, during.signal);
  during.abort();
  await expect(operation).rejects.toMatchObject({ status: 504 });
});
it('cancels during JSON body consumption', async () => {
  const controller = new AbortController();
  fetchImpl.mockImplementation(async () => ({ ok: true, json: async () => { controller.abort(); throw new Error('cancelled'); } }));
  await expect(service.getCommitsByWord('test', paging, controller.signal)).rejects.toMatchObject({ status: 504 });
});
it('uses the native fetch transport and real router against an isolated HTTP upstream', async () => {
  const paths = [];
  const upstream = http.createServer((req, res) => {
    paths.push(req.url);
    if (req.url.includes('missing')) { res.writeHead(404); res.end('synthetic-private-body'); }
    else if (req.url.includes('body-delay')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); }
    else if (req.url.includes('slow')) { /* Leave open to test native cancellation. */ }
    else { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(search)); }
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${upstream.address().port}/`;
    // Successful cold native fetches use the production default deadline, not a
    // scheduler-speed assertion. Deliberately stalled responses test a separate bound.
    const service = createGithubService({ baseUrl, timeoutMs: 5000 });
    const app = appFor({ githubService: service });
    expect((await request(app).get('/api/github/getCommits/fix%20%26%20tidy')).body).toEqual(search);
    expect(new URL(paths[0], 'http://localhost').searchParams.get('q')).toBe('"fix & tidy"');
    const failure = await request(app).get('/api/github/getCommits/missing');
    expect(failure.status).toBe(404);
    expect(failure.text).not.toContain('synthetic-private-body');
    const boundedApp = appFor({ githubService: createGithubService({ baseUrl, timeoutMs: 500 }) });
    expect((await request(boundedApp).get('/api/github/getCommits/slow')).status).toBe(504);
    expect(paths.at(-1)).toContain('slow');
    expect((await request(boundedApp).get('/api/github/getCommits/body-delay')).status).toBe(504);
    expect(paths.at(-1)).toContain('body-delay');
  } finally {
    upstream.closeAllConnections();
    await new Promise(resolve => upstream.close(resolve));
  }
});
