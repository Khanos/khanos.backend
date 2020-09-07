const GithubService = require('api/services/GithubService');

module.exports = {
    getCommits: async(req, res) => {
        try {
            const word = req.params.word;
            let data = await GithubService.searchCommitsByWord(word);
            let commits;
            if(!data.error){
                commits = data.items.map((item) => {
                    let info = {
                        id: item.node_id,
                        queryWord: word,
                        author: {
                            login: item.author ? item.author.login : item.commit.author.name,
                            avatar: item.author ? item.author.avatar_url : `https://www.fillmurray.com/${Math.floor(Math.random() * 200) + 200}/${Math.floor(Math.random() * 200) + 200}`
                        },
                        commit: {
                            message: item.commit.message,
                            url: item.commit.url,
                            date: item.commit.author.date
                        },
                        repo: {
                            name: item.repository.name,
                            description: item.repository.description || item.repository.full_name
                        }
                    }
                    return info;
                });
            } else {
                commits = {error: true, message: data.message};
            }
            return res.send(commits);
        } catch (error) {
            throw(error);
        }
    }
};