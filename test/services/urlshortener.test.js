require('dotenv').config();
const UrlShortenerService = require('../../api/services/UrlShortenerService');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();
chai.use(require('chai-things'));
const mongoose = require('mongoose');
mongoose.connect(process.env.CONNECTION_URL, {
    dbName: 'test',
    useNewUrlParser: true,
    useUnifiedTopology: true
}).catch(err => console.log('Something goes wrong with mongoose', err));


describe('UrlShortenerService', () => {
    describe('#createNewShortUrl()', () => {
        it('Should fail with error invalid Url (malformed URL)', (done) => {
            UrlShortenerService.createNewShortUrl('htttttttttp://www.google.com', (err, response) => {
                if(err){
                    err.should.be.an.instanceOf(Error);
                    err.message.should.equal('invalid URL');
                    done();
                }
            })
        });
        it('Should fail with error invalid Url (Site doesn\'t exist)', (done) => {
            let original_url = 'https://www.KhanosThisSiteDoesNotExist.com', host;
            if (original_url.indexOf('http://www') !== -1) {
                host = original_url.substring(11, original_url.length);
            } else if (original_url.indexOf('https://www') !== -1) {
                host = original_url.substring(12, original_url.length);
            }
            UrlShortenerService.createNewShortUrl(original_url, (err, response) => {
                if(err){
                    err.should.be.an.instanceOf(Error);
                    err.message.should.equal("getaddrinfo ENOTFOUND "+host);
                    done();
                }
            });
        });
        it('Should return the short url from the database', (done) => {
            let original_url = 'https://www.stackoverflow.com';
            UrlShortenerService.createNewShortUrl(original_url, (err, response) => {
                if(!err){
                    response.should.have.property("original_url", "https://www.stackoverflow.com");
                    response.should.have.property("short_url", 123123123);
                    response.creation_date.should.be.instanceof(Date);
                    done();
                } else {
                    done(err);
                }
            });
        });
        it('Should create a new short url for facebook', (done) => {
            let original_url = 'https://www.facebook.com';
            UrlShortenerService.createNewShortUrl(original_url, (err, response) => {
                if(!err) {
                    response.should.have.property("original_url", "https://www.facebook.com");
                    response.should.have.property("short_url", 1721158175);
                    response.creation_date.should.be.instanceof(Date);
                    done();
                } else {
                    done(err);
                }
            });
        });
    });

    describe('#deleteShortUrl', () => {
        it('Should delete the facebook url created in the previous test', (done) => {
            let short_url = 1721158175;
            UrlShortenerService.deleteShortUrl(short_url, (err, response) => {
                if(!err) {
                    response.should.have.property('deletedCount');
                    response.deletedCount.should.be.equal(1);
                    response.ok.should.be.equal(1);
                    done();
                } else {
                    done(err);
                }
            });
        });
    });
});