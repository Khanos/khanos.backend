import GithubService from '../services/GithubService.js';

/**
 * GitHub controller — search public commit history via the GitHub API.
 */
const GithubController = {
  /**
   * Search recent commits that contain a given keyword.
   * @route GET /api/github/getCommits/:word
   * @param {import('express').Request} req Express request object (`req.params.word`).
   * @param {import('express').Response} res Express response object.
   * @returns {Promise<void>} Resolves once the commits are returned or an error is sent.
   */
  getCommits: async (req, res) => {
    try {
      const word = req.params.word;
      const commits = await GithubService.getCommitsByWord(word);
      res.json(commits);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  /**
   * Search recent commits for a specific repository by owner and name.
   * @route GET /api/github/getCommitsByRepoAndOwner/:owner/:repo
   * @param {import('express').Request} req Express request object (`req.params.owner`, `req.params.repo`).
   * @param {import('express').Response} res Express response object.
   * @returns {Promise<void>} Resolves once the commits are returned or an error is sent.
   */
  getCommitsByRepoAndOwner: async (req, res) => {
    try {
      const owner = req.params.owner;
      const repo = req.params.repo;
      const commits = await GithubService.getCommitsByRepoAndOwner(repo, owner);
      res.json(commits);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
};

export default GithubController;
