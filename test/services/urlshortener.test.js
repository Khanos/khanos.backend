require('dotenv').config();
const GithubService = require('../../api/services/UrlShortenerService');
const UrlModel = require('../../api/models/UrlModel');
const chai = require('chai');
const mongoose = require('mongoose');
mongoose.connect(process.env.CONNECTION_URL, {
    dbName: 'test',
    useNewUrlParser: true,
    useUnifiedTopology: true
}).catch(err => console.log('Something goes wrong with mongoose', err));
chai.should();
chai.use(require('chai-things'));

describe('UrlShortenerService', () => {
    describe('#createNewShortUrl()', () => {
        it('Should fail with error invalid Url (malformed URL)', (done) => {
            GithubService.createNewShortUrl('htttttttttp://www.google.com').should.throw(Error, "invalid URL");
            done();
        });
        it('Should fail with error invalid Url (Site doesn\'t exist)', (done) => {
            let original_url = 'https://www.KhanosThisSiteDoesNotExist.com', host;
            if (original_url.indexOf('http://www') !== -1) {
                host = original_url.substring(11, original_url.length);
            } else if (original_url.indexOf('https://www') !== -1) {
                host = original_url.substring(12, original_url.length);
            }
            GithubService.createNewShortUrl(original_url).should.throw(Error, "getaddrinfo ENOTFOUND "+host);
        })
    })
});