const request = require('request');

module.exports = {
    getRepos: (req, res) => {
        return res.json(req.headers);
    },
    searchCommitsWithWord: (req, res) => {
        let word = req.params.word;
        let options = {
            url: `https://api.github.com/search/commits?q=repo/${word}`,
            headers: {
                'User-Agent': 'request',
                'Accept': 'application/vnd.github.cloak-preview'
            }
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                let info = JSON.parse(body);
                let data = info.items.reduce((arr, curr) => {
                    if (curr.author !== null){
                        let info = {
                            author: {
                                login: curr.author.login,
                                avatar: curr.author.avatar_url
                            },
                            commit: {
                                message: curr.commit.message,
                                url: curr.commit.url,
                                date: curr.commit.committer.date
                            },
                            repo: {
                                name: curr.repository.name,
                                description: curr.repository.description
                            }
                        }
                        arr.push(info);
                    }
                    return arr;
                }, []);
                return res.json(data);
            } else {
                return res.json(error)
            }
        }

        request(options, callback);
    }
};