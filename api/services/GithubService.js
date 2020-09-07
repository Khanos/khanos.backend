const axios = require('axios');

module.exports = {
    searchCommitsByWord: async (word)=>{
        let options = {
            method: 'get',
            url: process.env.GITHUB_API_URL+`search/commits?q=repo/${word}`,
            headers: {
                'User-Agent': 'khanos super api',
                'Accept': 'application/vnd.github.cloak-preview'
            },
            responseType: 'json'
        };
        let response = await axios(options);
        return response.data;
    },
    getCommitsByRepoAndOwner: async (owner, repoName) => {
        let options = {
            method: 'get',
            url: process.env.GITHUB_API_URL+`repos/${owner}/${repoName}/commits`,
            headers: {
                'User-Agent': 'khanos super api'
            },
            responseType: 'json'
        };
        let response = await axios(options);
        return response.data;
    },
    getReposByWord: async (word) => {
        let options = {
            method: 'get',
            url: process.env.GITHUB_API_URL+`search/repositories?q=${repoName}+language:javascript&sort=stars&order=desc`,
            headers: {
                'User-Agent': 'khanos super api',
                'Accept': 'application/vnd.github.mercy-preview+json'
            },
            responseType: 'json'
        };
        let response = await axios(options);
        return response.data;
    },
    getReposByWordAndLanguage: async (word, language) => {
        let options = {
            method: 'get',
            url: process.env.GITHUB_API_URL+`search/repositories?q=${repoName}+language:${repoName}&sort=stars&order=desc`,
            headers: {
                'User-Agent': 'khanos super api',
                'Accept': 'application/vnd.github.mercy-preview+json'
            },
            responseType: 'json'
        };
        let response = await axios(options);
        return response.data;
    }
}