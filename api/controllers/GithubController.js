const GithubService = require('api/services/GithubService');

module.exports = {
    getRepos: (req, res) => {
        console.log('this is a test');
        return res.json(req.headers);
    },
    searchCommitsWithWord: async(req, res) => {
        const word = req.params.word;
        let data = await GithubService.searchCommitsWithWord(word);
        console.log('this is data:', data);
        console.log('this is data.items:', data.items);
        let commits = data.items.reduce((arr, curr) => {
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
        return res.send(commits);
    }
};