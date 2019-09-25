const GithubService = require('../../api/services/GithubService');
const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('GithubService', () => {
    
    describe('#searchCommitsWithWord()', () => {
		it('Should return an object with property: total_count, incomplete_results and items', (done) => {
            GithubService.searchCommitsWithWord('fuck')
            .then((commits) => {
                commits.should.be.a("object");
                commits.should.have.property('total_count');
                commits.should.have.property('incomplete_results');
                commits.should.have.property('items');
                commits.items.should.be.a('array');
                done();
            })
            .catch((err) => {
                done(err);
            });
        });
    });
    
    describe('#getCommitsByRepoAndOwner()', () => {
		it('Should return an object with property: sha, node_id, commit, url, comments_url and author', (done) => {
            GithubService.getCommitsByRepoAndOwner('khanos', 'khanos.backend')
            .then((commits) => {
                commits.should.be.a("array");
                commits.should.include.something.that.have.property('sha');
                commits.should.include.something.that.have.property('node_id');
                commits.should.include.something.that.have.property('commit');
                commits.should.include.something.that.have.property('url');
                commits.should.include.something.that.have.property('comments_url');
                commits.should.include.something.that.have.property('author');
                done();
            })
            .catch((err) => {
                done(err);
            });
        });
	});

});