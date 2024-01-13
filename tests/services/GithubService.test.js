require('dotenv').config();
const GithubService = require('../../api/services/GithubService');
const commitsByWord_MockedData = require('../../api/mocks/commitsByWord.json');
const commitsByRepoAndOwner_MockedData = require('../../api/mocks/commitsByRepoOwner.json');

describe('GithubService', () => {
  describe('.getCommitsByWord', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should return commits by a given word', async () => {
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
    it('should return commits by repo owner', async () => {
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
  });
});