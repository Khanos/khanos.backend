import GithubService from '../services/GithubService.js';

const GithubController = {
  getCommits: async (req, res) => {
    const word = req.params.word;
    const commits = await GithubService.getCommits(word);
    res.json(commits);
  }
};

export default GithubController;