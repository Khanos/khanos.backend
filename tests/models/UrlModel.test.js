const mongoDB = require('../../db');
const mongoose = require('mongoose');
const UrlModel = require('../../api/models/UrlModel');

beforeAll(async () => {
  await mongoDB.connect();
});
describe('UrlModel', () => {

  it('create & save url successfully', async () => {
    const inputData = {
      original_url: 'http://test.com',
      short_url: 123456,
      creation_date: new Date()
    };

    // Mock UrlModel.create
    const mockCreate = jest.spyOn(UrlModel, 'create');
    mockCreate.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      ...inputData
    });

    const savedUrl = await UrlModel.create(inputData);

    // Object Id should be defined when successfully saved to MongoDB.
    expect(savedUrl._id).toBeDefined();
    expect(savedUrl.original_url).toBe(inputData.original_url);
    expect(savedUrl.short_url).toBe(inputData.short_url);
    expect(savedUrl.creation_date).toBe(inputData.creation_date);
  });

  // Test Schema is working!!!
  // You shouldn't be able to add in any field that isn't defined in the schema
  it('insert url successfully, but the field not defined in schema should be undefined', async () => {
    const urlWithInvalidField = {
      original_url: 'http://test.com',
      short_url: 123456,
      creation_date: new Date(),
      anotherField: 'something'
    };
    const savedUrlWithInvalidField = await UrlModel.create(urlWithInvalidField);
    expect(savedUrlWithInvalidField._id).toBeDefined();
    expect(savedUrlWithInvalidField.anotherField).toBeUndefined();
  });

});
afterAll(async () => {
  jest.restoreAllMocks();
  await mongoDB.disconnect();
});