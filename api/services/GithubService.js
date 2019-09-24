const request = require('request-promise');

module.exports = {
    getCommitsByWord: (word)=>{
        let options = {
            uri: `https://api.github.com/search/commits?q=repo/${word}`,
            headers: {
                'User-Agent': 'request',
                'Accept': 'application/vnd.github.cloak-preview'
            },
            json: true
        };
        let response = request(options)
            .then(function (info) {
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
                return data;
            })
            .catch(function (err) {
                return err;
            });;
        return response;
    }
}