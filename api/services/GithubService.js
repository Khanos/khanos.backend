require('dotenv').config();

const GithubService = {
  getCommitsByWord: async (word = null) => {
    if (!word) throw new Error('Missing word parameter');
    try {
      const url = process.env.GITHUB_API_URL+`search/commits?q=repo/${word}${process.env.ENV === 'development' ? '&&per_page=1' : ''}`;
      const response = await fetch(url);
      const commits = await response.json();
      return commits;
    } catch (error) {
      console.error(`Error: ${error}`);
      return null;
    }
  },
  getCommitsByRepoAndOwner: async (repo = null, owner = null) => {
    if (!repo || !owner) throw new Error('Missing repo or owner parameter');
    try {
      const url = process.env.GITHUB_API_URL+`repos/${owner}/${repo}/commits${process.env.ENV === 'development' ? '?per_page=1' : ''}`;
      const response = await fetch(url);
      const commits = await response.json();
      return commits;
    } catch (error) {
      console.error(`Error: ${error}`);
      return null;
    }
  }
};

module.exports = GithubService;