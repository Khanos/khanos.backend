jest.mock('../../api/services/UrlShortenerService');
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { 
  urlencoded: urlencodedParser,
} = require('express');
const app = express();
const UrlShortenerController = require('../../api/controllers/UrlShortenerController');
const UrlShortenerService = require('../../api/services/UrlShortenerService');

app.use(urlencodedParser({ extended: true })); // Parse URL-encoded bodies
app.use(session({
  secret: 'test',  // a secret string used to sign the session ID cookie
  resave: false,  // don't save session if unmodified
  saveUninitialized: false  // don't create session until something stored
}))

app.get('/url', UrlShortenerController.index);
app.post('/url/create', UrlShortenerController.create);
app.get('/url/:short_url', UrlShortenerController.getUrl);
app.delete('/url/:short_url', UrlShortenerController.delete);

describe('UrlShortenerController', () => {
  beforeEach(() => {
    const url = 'http://example.com';

    UrlShortenerService.getUrlList.mockResolvedValue({
      error: false,
      message: 'URLs found',
      data: [],
    });

    UrlShortenerService.getUrl.mockResolvedValue({
      error: false,
      message: 'URL found',
      data: { original_url: url, short_url: 123, creation_date: new Date() },
    });
  
    UrlShortenerService.getShortUrl.mockResolvedValue({
      error: false,
      message: 'URL found',
      data: { original_url: url, short_url: 123, creation_date: new Date() },
    });
  
    UrlShortenerService.createNewShortUrl.mockResolvedValue({
      error: false,
      message: 'URL shortened successfully',
      data: { original_url: url, short_url: 123, creation_date: new Date() },
    });

    UrlShortenerService.deleteShortUrl.mockResolvedValue({
      error: false,
      message: 'URL deleted successfully',
      data: { original_url: url, short_url: 123, creation_date: new Date() },
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('.index', () => {
    it('should return all URLs', async () => {
      const res = await request(app).get('/url');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ error: false, message: 'URLs found', data: [] });
    });

    it('should return an error if something goes wrong', async () => {
      UrlShortenerService.getUrlList.mockRejectedValue(new Error('Some error'));
      const res = await request(app).get('/url');
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Some error' });
    });
  });

  describe('.create', () => {
    it('should create a new URL', async () => {
      const url = 'http://example.com';
      UrlShortenerService.getShortUrl.mockResolvedValue({
        error: true,
        message: 'URL not found',
        data: null,
      });
      const res = await request(app).post('/url/create').send(`original_url=${url}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ original_url: url, short_url: 123, creation_date: expect.any(String) });
    });

    it('should return an error if the URL is invalid', async () => {
      const url = 'invalid';
      const res = await request(app).post('/url/create').send(`original_url=${url}`);
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Invalid URL' });
    });

    it('should return the URL if is already shortened', async () => {
      const url = 'http://example.com';
      const res = await request(app).post('/url/create').send(`original_url=${url}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ original_url: url, short_url: 123, creation_date: expect.any(String) });
    });

    it('should return an error if something goes wrong', async () => {
      const url = 'http://example.com';
      UrlShortenerService.getShortUrl.mockResolvedValue({
            error: true,
            message: 'URL not found',
            data: null,
          });
      UrlShortenerService.createNewShortUrl.mockResolvedValue({
        error: true,
        message: 'Some error',
        data: null,
      });
      const res = await request(app).post('/url/create').send(`original_url=${url}`);
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'Some error' });
    });
  });

  describe('.getUrl', () => {
    it('should return a URL', async () => {
      const res = await request(app).get('/url/123');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ original_url: 'http://example.com', short_url: 123, creation_date: expect.any(String) });
    });

    it('should return an error if the URL is not found', async () => {
      UrlShortenerService.getUrl.mockResolvedValue({
        error: true,
        message: 'URL not found',
        data: null,
      });
      const res = await request(app).get('/url/123');
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'URL not found' });
    });
  });

  describe('.delete', () => {
    it('should delete a URL', async () => {
      const res = await request(app).delete('/url/123');
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ original_url: 'http://example.com', short_url: 123, creation_date: expect.any(String) });
    });

    it('should return an error if the URL is not found', async () => {
      UrlShortenerService.deleteShortUrl.mockResolvedValue({
        error: true,
        message: 'URL not found',
        data: null,
      });
      const res = await request(app).delete('/url/123');
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: 'URL not found' });
    });
  });
});
