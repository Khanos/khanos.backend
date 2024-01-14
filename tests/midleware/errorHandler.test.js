const express = require('express');
const request = require('supertest');
const errorHandler = require('../../api/middlewares/errorHandler');

describe('errorHandler middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.get('/', () => {
      throw new Error('Test error');
    });
    app.use(errorHandler);
  });

  it('should handle errors correctly in development environment', async () => {
    process.env.ENV = 'development';
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Ups, something bad happened: Test error');
  });

  it('should handle errors correctly in non-development environment', async () => {
    process.env.ENV = 'production';
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('🤦‍♂️, something bad happened');
  });
});
