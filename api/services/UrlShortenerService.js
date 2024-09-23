import UrlModel from '../models/UrlModel.js';
import { hashCode } from '../utils/index.js';

const UrlShortenerService = {
  getUrlList: async () => {
    try {
      const urls = await UrlModel.find();
      return {
        error: false,
        message: 'URLs found',
        data: urls,
      };
    } catch (error) {
      return {
        error: true,
        message: error.message,
        data: null,
      };
    }
  },
  getUrl: async (short_url) => {
    try {
      let url = await UrlModel.findOne({ short_url });
      if (!url) {
        throw new Error('URL not found');
      }
      return {
        error: false,
        message: 'URL found',
        data: url,
      };
    } catch (error) {
      return {
        error: true,
        message: error.message,
        data: null,
      };
    }
  },
  getShortUrl: async (original_url) => {
    try {
      const hash = hashCode(original_url);
      let url = await UrlModel.findOne({ short_url: hash });
      if (!url) {
        throw new Error('URL not found');
      }
      return {
        error: false,
        message: 'URL found',
        data: url,
      }; 
    } catch (error) {
      return {
        error: true,
        message: error.message,
        data: null,
      };
    }
  },
  createNewShortUrl: async (original_url) => {
    try {
      const hash = hashCode(original_url);
      const shortUrl = await UrlModel.create({
        original_url,
        short_url: hash,
        creation_date: new Date()
      });
      return {
        error: false,
        message: 'URL shortened successfully',
        data: shortUrl,
      };
    } catch (error) {
      return {
        error: true,
        message: error.message,
        data: null,
      };
    }
  },
  deleteShortUrl: async (short_url) => {
    try {
      const deletedUrl = await UrlModel.findOneAndDelete({ short_url });
      return {
        error: false,
        message: 'URL deleted successfully',
        data: deletedUrl,
      };  
    } catch (error) {
      return {
        error: true,
        message: error.message,
        data: null,
      };
    }
  },
};

export default UrlShortenerService;