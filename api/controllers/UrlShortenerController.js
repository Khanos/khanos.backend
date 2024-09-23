import UrlShortenerService from '../services/UrlShortenerService.js';
import { validateUrl } from '../utils/index.js';
const { getUrlList, getUrl, getShortUrl, deleteShortUrl, createNewShortUrl } = UrlShortenerService;

const UrlShortenerController = {
  index: async (req, res) => {
    try {
      const urls = await getUrlList();
      res.json(urls);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  create: async (req, res) => {
    try {
      const { original_url } = req.body;
      const hostname = validateUrl(original_url);
      if (!hostname) {
        throw new Error('Invalid URL');
      }
      const url = await getShortUrl(original_url);
      if(!url.error) {
        res.json(url.data);
        return;
      }
      const newUrl = await createNewShortUrl(original_url);
      if(newUrl.error) {
        throw new Error(newUrl.message);
      }
      res.json(newUrl.data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  delete: async (req, res) => {
    try {
      const { short_url } = req.params;
      const url = await deleteShortUrl(short_url);
      if(url.error) {
        throw new Error(url.message);
      }
      res.json(url.data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  getUrl: async (req, res) => {
    try {
      const { short_url } = req.params;
      const url = await getUrl(short_url);
      if(url.error) {
        throw new Error(url.message);
      }
      res.json(url.data);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

export default UrlShortenerController;