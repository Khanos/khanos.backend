import request from 'supertest';
import server from '../../server';

describe('MainController', () => {
  describe('.index', () => {
    it('should return "Hello World!"', async () => {
      const res = await request(server).get('/api/');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Hello World!');
    });

    afterAll(done => {
      server.close(done); // Close the server after the tests
    });
  });
});
