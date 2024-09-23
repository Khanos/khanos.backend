import request from 'supertest';
import server from '../../server'; // Adjust the import path as needed

describe('.index', () => {
  it('should return "Hello World!"', async () => {
    const res = await request(server).get('/api/');
    expect(res.statusCode).toEqual(200);
    expect(res.text).toEqual('Hello World!');
  });

  afterAll(() => {
    return new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });
});