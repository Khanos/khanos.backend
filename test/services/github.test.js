const GithubService = require('../../api/services/GithubService');
const chai = require('chai');
chai.should();

describe('GithubService', () => {
    console.log('test in service');
	describe('#searchCommitsWithWord()', () => {
        console.log('debuggin')
		it('Should return an object with property: total_count, incomplete_results and items', (done) => {
            GithubService.searchCommitsWithWord('fuck')
            .then((commits) => {
                console.log('debuggin more');
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

});