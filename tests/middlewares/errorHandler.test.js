import { jest } from '@jest/globals';
import request from 'supertest';
import errorHandler from '../../api/middlewares/errorHandler.js';
import MainController from '../../api/controllers/MainController.js';
import { appFor, authorization, config } from '../helpers/app.js';

it('returns malformed JSON as safe 400 JSON through the real app', async () => {
  const response = await request(appFor()).post('/api/url/create').set('Content-Type', 'application/json').send('{"bad":');
  expect(response.status).toBe(400);
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(response.body.code).toBe('INVALID_REQUEST');
  expect(response.body.requestId).toBe(response.headers['x-request-id']);
});
it('returns oversized JSON and too many form parameters as 413', async () => {
  const response = await request(appFor()).post('/api/url/create').set('Authorization', authorization).send({ original_url: 'a'.repeat(110000) });
  expect(response.status).toBe(413);
  const parameters = Array.from({ length: 101 }, (_, i) => `key${i}=value`).join('&');
  expect((await request(appFor()).post('/api/url/create').type('form').send(parameters)).status).toBe(413);
});
it('returns unsupported encoding as 415', async () => {
  expect((await request(appFor()).post('/api/url/create').set('Content-Type', 'application/json; charset=unsupported').send('{}')).status).toBe(415);
});
it('returns API 404 JSON and documentation 404 HTML, including non-GET requests', async () => {
  for (const path of ['/api/unknown', '/api/unknown?private=synthetic', '/api?unused=x']) {
    const response = await request(appFor()).delete(path);
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/application\/json/);
  }
  const response = await request(appFor()).get('/unknown');
  expect(response.status).toBe(404);
  expect(response.headers['content-type']).toMatch(/text\/html/);
});
it('returns safe HTML for documentation exceptions', async () => {
  const spy = jest.spyOn(MainController, 'render').mockImplementation(() => { throw new Error('private error'); });
  try {
    const response = await request(appFor()).get('/');
    expect(response.status).toBe(500);
    expect(response.text).toContain('Internal server error');
    expect(response.text).not.toContain('private error');
  } finally { spy.mockRestore(); }
});
it('returns malformed path encoding as 400', async () => {
  expect((await request(appFor()).get('/api/url/%E0%A4%A')).status).toBe(400);
});
it('delegates an error after headers have been sent', () => {
  const error = new Error('after response');
  const next = jest.fn();
  errorHandler(error, { app: { locals: { log: jest.fn() } } }, { headersSent: true }, next);
  expect(next.mock.calls[0][0]).not.toBe(error);
  expect(next.mock.calls[0][0].message).toBe('Internal server error');
});
it('keeps a production limiter active without TEST and leaves health reachable', async () => {
  const app = appFor({ config: { ...config, test: false, rateLimitMax: 1 } });
  expect((await request(app).get('/api/')).status).toBe(200);
  const response = await request(app).get('/api/');
  expect(response.status).toBe(429);
  expect(response.body.code).toBe('RATE_LIMITED');
  expect((await request(app).get('/health/live')).status).toBe(200);
});
