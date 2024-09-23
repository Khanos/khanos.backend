require('dotenv').config();
import GithubService from '../../api/services/GithubService';
import commitsByWord_MockedData from '../../api/mocks/commitsByWord.json';
import commitsByRepoAndOwner_MockedData from '../../api/mocks/commitsByRepoOwner.json';

describe('GithubService', () => {
  describe('.getCommitsByWord', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return commits by a given word', async () => {
      process.env.ENV = 'development';
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve(commitsByWord_MockedData),
        })
      );

      const commits = await GithubService.getCommitsByWord('test');

      expect(commits).toEqual(commitsByWord_MockedData);
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.GITHUB_API_URL}search/commits?q=repo/test&&per_page=1`
      );
    });

    it('should return commits by a given word in production', async () => {
      process.env.ENV = 'production';
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve(commitsByWord_MockedData),
        })
      );

      const commits = await GithubService.getCommitsByWord('test');

      expect(commits).toEqual(commitsByWord_MockedData);
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.GITHUB_API_URL}search/commits?q=repo/test`
      );
    });

    it('should return null if there is an error', async () => {
      process.env.ENV = 'development';
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.reject(new Error('Internal server error'))
      );

      const commits = await GithubService.getCommitsByWord('test');

      expect(commits).toEqual(null);
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.GITHUB_API_URL}search/commits?q=repo/test&&per_page=1`
      );
    });
  });

  describe('.getCommitsByRepoAndOwner', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should return commits by repo owner', async () => {
      process.env.ENV = 'development';
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve(commitsByRepoAndOwner_MockedData),
        })
      );

      const commits = await GithubService.getCommitsByRepoAndOwner('khanos.backend', 'khanos');

      expect(commits).toEqual(commitsByRepoAndOwner_MockedData);
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.GITHUB_API_URL}repos/khanos/khanos.backend/commits?per_page=1`
      );
    });

    it('should return commits by repo owner in production', async () => {
      process.env.ENV = 'production';
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve(commitsByWord_MockedData),
        })
      );

      const commits = await GithubService.getCommitsByRepoAndOwner('khanos.backend', 'khanos');

      expect(commits).toEqual(commitsByWord_MockedData);
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.GITHUB_API_URL}repos/khanos/khanos.backend/commits`
      );
    });

    it('should return null if there is an error', async () => {
      process.env.ENV = 'development';
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.reject(new Error('Internal server error'))
      );

      const commits = await GithubService.getCommitsByRepoAndOwner('khanos.backend', 'khanos');

      expect(commits).toEqual(null);
      expect(fetch).toHaveBeenCalledWith(
        `${process.env.GITHUB_API_URL}repos/khanos/khanos.backend/commits?per_page=1`
      );
    });
  });
});