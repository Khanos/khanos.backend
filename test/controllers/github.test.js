const chai = require('chai');
const chaiHttp = require('chai-http');
const app = require('../../app');
chai.use(chaiHttp);
chai.should();

describe('GithubControlle', () => {

	describe('#getRepos()', function () {
		it('Should return a json', (done) => {
			chai.request(app)
				.get('/api/v1/getRepos')
				.end((err, res) => {
					if(err){
						console.log(err);
					}
					res.should.have.status(200);
					res.body.should.be.a('object');
					done();
				});
		});
	});

});