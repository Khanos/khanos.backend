import request from 'supertest';
import server from '../../server'; // Adjust the import path as needed

describe('.index', () => {
  it('should return the structured API documentation catalog as JSON', async () => {
    const res = await request(server).get('/api/');
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    // The catalog is grouped by feature area.
    const labels = res.body.map(group => group.label);
    expect(labels).toContain('GitHub');
    expect(labels).toContain('URL Shortener');
    expect(labels).toContain('Gemini');
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
  });

  afterAll(() => {
    return new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });
});
