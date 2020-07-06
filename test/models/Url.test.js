require('dotenv').config();
const UrlModel = require('../../api/models/UrlModel');
const chai = require('chai');
const mongoose = require('mongoose');
mongoose.connect(process.env.CONNECTION_URL, {
    dbName: 'khanos',
    useNewUrlParser: true,
    useUnifiedTopology: true
}).catch(err => console.log('Something goes wrong with mongoose', err));
chai.should();
chai.use(require('chai-things'));

describe('CRUD test for UrlModel', () => {
    
    describe('------------------Create------------------', () => {
        it('Should creates a short url document', (done) => {
            const shortUrl = (
                {
                    original_url: 'https://mongoosejs.com',
                    short_url: 1234567890,
                    creation_date: new Date()
                }
            );
            UrlModel.create(shortUrl)
                .then((response) => {
                    response.should.have.property('_id');
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        });
    });

    describe('------------------Read------------------', () => {
        it('Should read a short url document', (done) => {
            const query = {
                short_url: 1234567890
            }
            UrlModel.findOne(query)
                .then((response) => {
                    response.original_url.should.be.equal('https://mongoosejs.com');
                    response.short_url.should.be.equal(1234567890);
                    response.should.have.property('creation_date');
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        })
    });

    describe('------------------Update------------------', () => {
        it('Should update a short url document', (done) => {
            const query = {
                short_url: 1234567890
            }
            UrlModel.updateOne(query, {original_url: 'https://mongoosejs.com/docs'})
                .then((response) => {
                    response.should.have.property('nModified', 1);
                    response.ok.should.be.equal(1);
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        })
    });

    describe('------------------Delete------------------', () => {
        it('Should delete a short url document', (done) => {
            const query = {
                short_url: 1234567890
            }
            UrlModel.deleteOne(query)
                .then((response) => {
                    response.ok.should.be.equal(1);
                    done();
                })
                .catch((err) => {
                    done(err);
                });
        })
    });

});
