const { getUrlList, getUrl, getShortUrl, createNewShortUrl, deleteShortUrl } = require('../../api/services/UrlShortenerService');
const UrlModel = require('../../api/models/UrlModel');
const { hashCode } = require('../../api/utils');

UrlModel.find = jest.fn();
UrlModel.findOne = jest.fn();
UrlModel.findOneAndDelete = jest.fn();
UrlModel.create = jest.fn();

describe('UrlShortenerService', () => {
  describe('getUrlList', () => {
    it('should return an error if the database throws an error', async () => {
      UrlModel.find.mockRejectedValue(new Error('Database error'));
      const result = await getUrlList();
      expect(result.error).toBe(true);
      expect(result.message).toBe('Database error');
      expect(result.data).toBeNull();
    });

    it('should return the list of URLs if the database returns them', async () => {
      const urls = [
        new UrlModel({
          original_url: 'https://www.example.com',
          short_url: 12345,
          creation_date: new Date()
        }),
        new UrlModel({
          original_url: 'https://www.example2.com',
          short_url: 67890,
          creation_date: new Date()
        })
      ];
      UrlModel.find.mockResolvedValue(urls);
      const result = await getUrlList();
      expect(result.error).toBe(false);
      expect(result.message).toBe('URLs found');
      expect(result.data).toEqual(urls);
    });

    it('should return an empty list if the database returns no URLs', async () => {
      UrlModel.find.mockResolvedValue([]);
      const result = await getUrlList();
      expect(result.error).toBe(false);
      expect(result.message).toBe('URLs found');
      expect(result.data).toEqual([]);
    });
  });

  describe('getUrl', () => {
    it('should return an error if the database throws an error', async () => {
      UrlModel.findOne.mockRejectedValue(new Error('Database error'));
      const result = await getUrl(12345);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Database error');
      expect(result.data).toBeNull();
    });

    it('should return an error if the URL does not exist in the database', async () => {
      const hash = 12345;
      UrlModel.findOne.mockResolvedValue(null);
      const result = await getUrl(hash);
      expect(result.error).toBe(true);
      expect(result.message).toBe('URL not found');
      expect(result.data).toBeNull();
    });

    it('should return the URL if it exists in the database', async () => {
      const hash = 12345;
      const url = new UrlModel({
        original_url: 'https://www.example.com',
        short_url: hash,
        creation_date: new Date()
      });
      UrlModel.findOne.mockResolvedValue(url);
      const result = await getUrl(hash);
      expect(result.error).toBe(false);
      expect(result.message).toBe('URL found');
      expect(result.data).toEqual(url);
    });
  });

  describe('getShortUrl', () => {
    it('should return an error if the database throws an error', async () => {
      UrlModel.findOne.mockRejectedValue(new Error('Database error'));
      const result = await getShortUrl('https://www.example.com');
      expect(result.error).toBe(true);
      expect(result.message).toBe('Database error');
      expect(result.data).toBeNull();
    });

    it('should return an error if the URL does not exist in the database', async () => {
      const url = 'https://www.example.com';
      UrlModel.findOne.mockResolvedValue(null);
      const result = await getShortUrl(url);
      expect(result.error).toBe(true);
      expect(result.message).toBe('URL not found');
      expect(result.data).toBeNull();
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
      expect(result.error).toBe(false);
      expect(result.message).toBe('URL found');
      expect(result.data).toEqual(urlModel);
    });
  });

  describe('createNewShortUrl', () => {
    it('should return an error if the database throws an error', async () => {
      UrlModel.create.mockRejectedValue(new Error('Database error'));
      const result = await createNewShortUrl('https://www.example.com');
      expect(result.error).toBe(true);
      expect(result.message).toBe('Database error');
      expect(result.data).toBeNull();
    });

    it('should return the URL if it was created successfully', async () => {
      const url = 'https://www.example.com';
      const hash = hashCode(url);
      const urlModel = new UrlModel({
        original_url: url,
        short_url: hash,
        creation_date: new Date()
      });
      UrlModel.create.mockResolvedValue(urlModel);
      const result = await createNewShortUrl(url);
      expect(result.error).toBe(false);
      expect(result.message).toBe('URL shortened successfully');
      expect(result.data).toEqual(urlModel);
    });
  });

  describe('deleteShortUrl', () => {
    it('should return an error if the database throws an error', async () => {
      UrlModel.findOneAndDelete.mockRejectedValue(new Error('Database error'));
      const result = await deleteShortUrl(12345);
      expect(result.error).toBe(true);
      expect(result.message).toBe('Database error');
      expect(result.data).toBeNull();
    });

    it('should return the URL if it was deleted successfully', async () => {
      const hash = 12345;
      const url = new UrlModel({
        original_url: 'https://www.example.com',
        short_url: hash,
        creation_date: new Date()
      });
      UrlModel.findOneAndDelete.mockResolvedValue(url);
      const result = await deleteShortUrl(hash);
      expect(result.error).toBe(false);
      expect(result.message).toBe('URL deleted successfully');
      expect(result.data).toEqual(url);
    });
  });
});