const { getShortUrl, createNewShortUrl, deleteShortUrl } = require('../../api/services/UrlShortenerService');
const UrlModel = require('../../api/models/UrlModel');
const { hashCode } = require('../../api/utils');

UrlModel.findOne = jest.fn();
UrlModel.findOneAndDelete = jest.fn();
UrlModel.create = jest.fn();

describe('UrlShortenerService', () => {
  describe('getShortUrl', () => {
    it('should return null for an invalid URL', async () => {
      const url = 'not a url';
      const result = await getShortUrl(url);
      expect(result).toBeNull();
    });

    it('should return null if the URL does not exist in the database', async () => {
      const url = 'https://www.example.com';
      UrlModel.findOne.mockResolvedValue(null);
      const result = await getShortUrl(url);
      expect(result).toBeNull();
    });

    it('should return the URL if it exists in the database', async () => {
      const url = 'https://www.example.com';
      const hash = hashCode(url);
      const urlModel = new UrlModel({
        original_url: url,
        short_url: hash,
        creation_date: new Date()
      });
      UrlModel.findOne.mockResolvedValue(urlModel);
      const result = await getShortUrl(url);
      expect(result).toEqual(urlModel);
    });
  });

  describe('createNewShortUrl', () => {
    it('should return null for an invalid URL', async () => {
      const url = 'not a url';
      const result = await createNewShortUrl(url);
      expect(result).toBeNull();
    });

    it('should return the URL if it exists in the database', async () => {
      const url = 'https://www.example.com';
      const hash = hashCode(url);
      const urlModel = new UrlModel({
        original_url: url,
        short_url: hash,
        creation_date: new Date()
      });
      UrlModel.findOne.mockResolvedValue(urlModel);
      const result = await createNewShortUrl(url);
      expect(result).toEqual(urlModel);
    });

    it('should return the URL if it does not exist in the database', async () => {
      const url = 'https://www.example.com';
      const hash = hashCode(url);
      const urlModel = new UrlModel({
        original_url: url,
        short_url: hash,
        creation_date: new Date()
      });
      UrlModel.findOne.mockResolvedValue(null);
      UrlModel.create.mockResolvedValue(urlModel);
      const result = await createNewShortUrl(url);
      expect(result).toEqual(urlModel);
    });
  });

  describe('deleteShortUrl', () => {
    it('should return null if the URL does not exist in the database', async () => {
      const url = 'https://www.example.com';
      UrlModel.findOneAndDelete.mockResolvedValue(null);
      const result = await deleteShortUrl(url);
      expect(result).toBeNull();
    });

    it('should return the URL if it exists in the database', async () => {
      const url = 'https://www.example.com';
      const hash = hashCode(url);
      const urlModel = new UrlModel({
        original_url: url,
        short_url: hash,
        creation_date: new Date()
      });
      UrlModel.findOneAndDelete.mockResolvedValue(urlModel);
      const result = await deleteShortUrl(url);
      expect(result).toEqual(urlModel);
    });
  });
});