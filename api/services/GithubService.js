require('dotenv').config();

const GithubService = {
  getCommitsByWord: async (word) => {
    try {
      const url = process.env.GITHUB_API_URL+`search/commits?q=repo/${word}${process.env.ENV === 'development' ? '&&per_page=1' : ''}`;
      const response = await fetch(url);
      const commits = await response.json();
      return commits;
    } catch (error) {
      return null;
    }
  },
  getCommitsByRepoAndOwner: async (repo, owner) => {
    try {
      const url = process.env.GITHUB_API_URL+`repos/${owner}/${repo}/commits${process.env.ENV === 'development' ? '?per_page=1' : ''}`;
      const response = await fetch(url);
      const commits = await response.json();
      return commits;
    } catch (error) {
      return null;
    }
  }
};

module.exports = GithubService;