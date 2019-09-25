const request = require('request-promise');

module.exports = {
    searchCommitsWithWord: (word)=>{
        let options = {
            uri: process.env.GITHUB_SEARCH_COMMITS_URL+word,
            headers: {
                'User-Agent': 'request',
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
    }
}