const request = require('supertest');
const server = require('../../server'); // Import your express app here

describe('MainController', () => {
  describe('.index', () => {
    afterAll(done => {
      server.close(done); // Close the server after the tests
    });

    it('should return "Hello World!"', async () => {
      const res = await request(server).get('/api/');
      expect(res.statusCode).toEqual(200);
      expect(res.text).toEqual('Hello World!');
    });
  });
});