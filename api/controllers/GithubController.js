let GithubService = require('../services/GithubService');

module.exports = {
    getRepos: (req, res) => {
        return res.json(req.headers);
    },
    searchCommitsWithWord: async(req, res) => {
        let word = req.params.word;
        let commits = await GithubService.getCommitsByWord(word);
        return res.send(commits);
    }
};