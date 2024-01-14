const GithubService = require('../services/GithubService');

const GithubController = {
  getCommits: async (req, res) => {
    try {
      const word = req.params.word;
      const commits = await GithubService.getCommitsByWord(word);
      res.json(commits);
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
};

module.exports = GithubController;