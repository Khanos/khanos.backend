import { jest } from '@jest/globals';
import request from 'supertest';
import { appFor } from '../helpers/app.js';

let service;
let app;
beforeEach(() => {
  service = { getCommitsByWord: jest.fn().mockResolvedValue({ items: [], total_count: 0, incomplete_results: false }),
    getCommitsByRepoAndOwner: jest.fn().mockResolvedValue([]) };
  app = appFor({ githubService: service });
});
it('uses the actual search route and preserves the search object', async () => {
  const result = await request(app).get('/api/github/getCommits/hello%20world?page=2&per_page=10');
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ items: [], total_count: 0, incomplete_results: false });
  expect(service.getCommitsByWord).toHaveBeenCalledWith('hello world', { page: 2, perPage: 10 }, expect.any(AbortSignal));
});
it('uses the actual repository route with bounded defaults', async () => {
  const result = await request(app).get('/api/github/getCommitsByRepoAndOwner/khanos/backend');
  expect(result.body).toEqual([]);
  expect(service.getCommitsByRepoAndOwner).toHaveBeenCalledWith('backend', 'khanos', { page: 1, perPage: 30 }, expect.any(AbortSignal));
});
it.each(['page=0', 'page=1001', 'per_page=101', 'per_page=1&per_page=2'])('rejects pagination %s', async query => {
  expect((await request(app).get(`/api/github/getCommits/test?${query}`)).status).toBe(400);
  expect(service.getCommitsByWord).not.toHaveBeenCalled();
});
it('masks unexpected provider exceptions', async () => {
  service.getCommitsByWord.mockRejectedValue(new Error('synthetic-private-error'));
  const response = await request(app).get('/api/github/getCommits/test');
  expect(response.status).toBe(500);
  expect(response.body.error).toBe('Internal server error');
  expect(response.text).not.toContain('synthetic-private-error');
});
