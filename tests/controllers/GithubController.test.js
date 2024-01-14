// FILEPATH: /Users/khanos/workspace/khanos/backend/tests/controllers/GithubController.test.js

const request = require('supertest');
const express = require('express');
const GithubController = require('../../api/controllers/GithubController');
const GithubService = require('../../api/services/GithubService');
const app = express();

app.get('/api/github/getCommits/:word', GithubController.getCommits);

describe('GithubController', () => {  
  describe('.getCommits', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });
    
    it('should return 500 if there is an internal server error', async () => {
      jest.spyOn(GithubService, 'getCommitsByWord').mockImplementation(() => {
        throw new Error('Internal server error');
      });

      const res = await request(app).get('/api/github/getCommits/test');
      expect(res.statusCode).toEqual(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
    });

    it('should return commits by a given word', async () => {
      const mockedResponse = {
        total_count: 1,
        incomplete_results: false,
        items: [{data: 'test'}],
      };
      jest.spyOn(GithubService, 'getCommitsByWord').mockImplementation(() => mockedResponse);

      const res = await request(app).get('/api/github/getCommits/test');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toEqual(mockedResponse);
    });
  });
});
