import os from 'node:os';
import request from 'supertest';
import { routes } from '../../api/routes/docs.js';
import { appFor, authorization } from '../helpers/app.js';
const server = appFor();

describe('.index', () => {
  it('should return the structured API documentation catalog as JSON', async () => {
    const res = await request(server).get('/api/');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    // The catalog is grouped by feature area.
    const labels = res.body.map(group => group.label);
    expect(labels).toContain('GitHub');
    expect(labels).toContain('URL Shortener');
    expect(labels).not.toContain('Gemini');
    expect(res.body.flatMap(group => group.endpoints).map(endpoint => endpoint.path))
      .not.toEqual(expect.arrayContaining([expect.stringMatching(/^\/api\/gemini/)]));
  });

  it('should render the HTML documentation page from README + endpoint metadata', async () => {
    const res = await request(server).get('/');
    expect(res.statusCode).toEqual(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    // Endpoint groups and paths are rendered from routes/docs.js.
    expect(res.text).toContain('Khanos Backend API');
    expect(res.text).toContain('GitHub');
    expect(res.text).toContain('/api/github/getCommits/:word');
    // README overview markdown is still rendered at the bottom.
    expect(res.text).toContain('khanos.backend');
    expect(res.text).not.toContain('Gemini text/image generation');
    expect(res.text).toContain('Google Gemini API has been retired');
  });

  it.each([
    '/api/gemini',
    '/api/gemini/getFromText?prompt=test',
    '/api/gemini/getChatFromText/test',
  ])('should return 410 JSON for retired Google endpoint %s', async (path) => {
    const res = await request(server).get(path);
    expect(res.statusCode).toBe(410);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toEqual({ error: 'Google Gemini API has been retired.' });
  });

  it('should reject retired image generation without accepting an upload', async () => {
    const res = await request(server)
      .post('/api/gemini/getFromImage')
      .field('prompt', 'test')
      .attach('image', Buffer.from('retired upload'), {
        filename: 'retired.png',
        contentType: 'image/png',
      });
    expect(res.statusCode).toBe(410);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.body).toEqual({ error: 'Google Gemini API has been retired.' });
  });

});

it('serves cached documentation and static assets from another working directory', async () => {
  const previous = process.cwd();
  try {
    process.chdir(os.tmpdir());
    const first = await request(server).get('/');
    const second = await request(server).get('/');
    expect(first.status).toBe(200);
    expect(second.text).toBe(first.text);
    expect((await request(server).get('/styles/main.css')).status).toBe(200);
    expect(first.headers['content-security-policy']).not.toContain("script-src 'self' 'unsafe-inline'");
  } finally { process.chdir(previous); }
});

it('exercises every documented method/path against the actual composed app', async () => {
  const record = { original_url: 'https://example.com', short_url: 123 };
  const app = appFor({ isReady: () => true, urlService: {
    create: async () => record, getUrl: async () => record, deleteShortUrl: async () => record,
    getUrlList: async () => ({ error: false, data: [] }),
  }, githubService: { getCommitsByWord: async () => ({ items: [], total_count: 0, incomplete_results: false }), getCommitsByRepoAndOwner: async () => [] } });
  const values = { word: 'test', owner: 'khanos', repo: 'backend', short_url: '123' };
  for (const endpoint of routes.flatMap(group => group.endpoints)) {
    const path = endpoint.path.replace(/:(word|owner|repo|short_url)/g, (match, key) => values[key]);
    const response = await request(app)[endpoint.method.toLowerCase()](path).set('Authorization', authorization).send({ original_url: record.original_url });
    expect({ method: endpoint.method, path, status: response.status }).toEqual({ method: endpoint.method, path, status: 200 });
    expect(endpoint.responses.some(item => item.status === response.status)).toBe(true);
  }
});
it.each(['get', 'post', 'put', 'patch', 'delete'])('keeps retired responses before body parsing for %s', async method => {
  const response = await request(server)[method]('/api/gemini/legacy').set('Content-Type', 'application/json').send('{invalid');
  expect(response.status).toBe(410);
  expect(response.body).toEqual({ error: 'Google Gemini API has been retired.' });
});
