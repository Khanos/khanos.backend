require('dotenv').config();
const UrlShortenerService = require('../../api/services/UrlShortenerService');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();
chai.use(require('chai-things'));
const mongoose = require('mongoose');

describe('UrlShortenerService', () => {
    before((done) => {
        mongoose.connect(process.env.CONNECTION_URL, {
            dbName: 'test',
            useNewUrlParser: true,
            useUnifiedTopology: true,
        }).then(() => done()).catch((err) => done(err));
    });

    after((done) => {
        mongoose.connection.close().then(() => done()).catch((err) => done(err));
    });

    describe('#getShortUrlByShortUrl()', () => {
        it('Should return the short url from the database', (done) => {
            let short_url = 123123123;
            UrlShortenerService.getShortUrlByShortUrl(short_url, (err, response) => {
                if(!err){
                    response.should.have.property("original_url", "https://www.stackoverflow.com");
                    response.should.have.property("short_url", 123123123);
                    response.creation_date.should.be.instanceof(Date);
                    done();
                } else {
                    done(err);
                }
            }
            );
        });
        it('Should fail with error short url not found', (done) => {
            let short_url = 1111;
            UrlShortenerService.getShortUrlByShortUrl(short_url, (err, response) => {
                if(err){
                    err.should.be.an.instanceOf(Error);
                    err.message.should.equal('Short url not found');
                    done();
                }
            }
            );
        });
    });

    describe('#createNewShortUrl()', () => {
        it('Should fail with error invalid Url (malformed URL)', (done) => {
            UrlShortenerService.createNewShortUrl('htttttttttp://www.google.com', (err, response) => {
                if(err){
                    err.should.be.an.instanceOf(Error);
                    done();
                }
            })
        });
        it('Should fail with error invalid Url (Site doesn\'t exist)', (done) => {
            let original_url = 'https://www.KhanosThisSiteDoesNotExist.com';
            UrlShortenerService.createNewShortUrl(original_url, (err, response) => {
                if(err){
                    err.should.be.an.instanceOf(Error);
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
                    done();
                } else {
                    done(err);
                }
            });
        });
    });
});