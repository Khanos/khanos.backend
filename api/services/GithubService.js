const request = require('request-promise');

module.exports = {
    searchCommitsWithWord: (word)=>{
        let options = {
            uri: process.env.GITHUB_API_URL+`search/commits?q=repo/${word}`,
            headers: {
                'User-Agent': 'khanos super api',
                'Accept': 'application/vnd.github.cloak-preview'
            },
            json: true
        };
        let response = request(options)
            .then(function (info) {
                return info;
            })
            .catch(function (err) {
                return err;
            });;
        return response;
    },
    getCommitsByRepoAndOwner: (owner, repoName) => {
        let options = {
            uri: process.env.GITHUB_API_URL+`repos/${owner}/${repoName}/commits`,
            headers: {
                'User-Agent': 'khanos super api'
            },
            json: true
        };
        let response = request(options)
            .then(function (info) {
                return info;
            })
            .catch(function (err) {
                return err;
            });;
        return response;
    },
    getReposByWord: (word) => {
        let options = {
            uri: process.env.GITHUB_API_URL+`search/repositories?q=${repoName}+language:javascript&sort=stars&order=desc`,
            headers: {
                'User-Agent': 'khanos super api',
                'Accept': 'application/vnd.github.mercy-preview+json'
            },
            json: true
        };
        let response = request(options)
            .then(function (info) {
                return info;
            })
            .catch(function (err) {
                return err;
            });;
        return response;
    },
    getReposByWordAndLanguage: (word, language) => {
        let options = {
            uri: process.env.GITHUB_API_URL+`search/repositories?q=${repoName}+language:${repoName}&sort=stars&order=desc`,
            headers: {
                'User-Agent': 'khanos super api',
                'Accept': 'application/vnd.github.mercy-preview+json'
            },
            json: true
        };
        let response = request(options)
            .then(function (info) {
                return info;
            })
            .catch(function (err) {
                return err;
            });;
        return response;
    }
}