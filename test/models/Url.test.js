// FILEPATH: /Users/khanos/workspace/khanos/backend/test/models/UrlModel.test.js

const mongoose = require('mongoose');
const chai = require('chai');
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.should();

const UrlModel = require('../../api/models/UrlModel');

describe('UrlModel', () => {
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

    describe('Model definition', () => {
        it('should have a `original_url` field of type String', () => {
            const fields = UrlModel.schema.obj;
            fields.should.have.property('original_url');
            fields.original_url.should.equal(String);
        });

        it('should have a `short_url` field of type Number', () => {
            const fields = UrlModel.schema.obj;
            fields.should.have.property('short_url');
            fields.short_url.should.equal(Number);
        });

        it('should have a `creation_date` field of type Date', () => {
            const fields = UrlModel.schema.obj;
            fields.should.have.property('creation_date');
            fields.creation_date.should.equal(Date);
        });
    });

    describe('Creating documents', () => {
        it('should create a new document with correct fields', (done) => {
            const urlDoc = new UrlModel({
                original_url: 'https://www.example.com',
                short_url: 123456789,
                creation_date: new Date()
            });

            urlDoc.save().then((doc) => {
                doc.should.have.property('original_url', 'https://www.example.com');
                doc.should.have.property('short_url', 123456789);
                doc.creation_date.should.be.instanceof(Date);
                done();
            }).catch((err) => done(err));
        });
    });
});