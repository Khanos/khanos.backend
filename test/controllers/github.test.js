const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../../app');
chai.use(chaiHttp);
chai.should();

describe('GithubControlle', () => {

	describe('#getRepos()', function () {
		it('Should return an Array', (done) => {
			chai.request(app)
				.get('/api/v1/searchCommitsWithWord/fuck')
				.end((err, res) => {
					if(err){
						console.log(err);
					}
					res.should.have.status(200);
					res.body.should.be.a('array');
					done();
				});
		});
	});

});