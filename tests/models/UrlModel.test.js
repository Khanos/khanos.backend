jest.mock('../../api/mocks/mongoDB');
import mongoDB from '../../api/mocks/mongoDB';
import mongoose from 'mongoose';
import UrlModel from '../../api/models/UrlModel';

beforeAll(() => {
  mongoDB.connect.mockImplementation(() => {
    return Promise.resolve();
  });

  mongoDB.disconnect.mockImplementation(() => {
    return Promise.resolve();
  });
});
describe('UrlModel', () => {

  it('create & save url successfully', async () => {
    const inputData = {
      original_url: 'http://test.com',
      short_url: 123456,
      creation_date: new Date()
    };
    const mockCreate = jest.spyOn(UrlModel, 'create');
    mockCreate.mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      ...inputData
    });
    const savedUrl = await UrlModel.create(inputData);

    expect(savedUrl._id).toBeDefined();
    expect(savedUrl.original_url).toBe(inputData.original_url);
    expect(savedUrl.short_url).toBe(inputData.short_url);
    expect(savedUrl.creation_date).toBe(inputData.creation_date);
  });

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