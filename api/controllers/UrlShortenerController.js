import UrlShortenerService from '../services/UrlShortenerService.js';
import { validateUrl } from '../utils/index.js';
const { getUrlList, getUrl, getShortUrl, deleteShortUrl, createNewShortUrl } = UrlShortenerService;

/**
 * URL shortener controller — Mongoose-backed short URL CRUD.
 */
const UrlShortenerController = {
  /**
   * List every stored URL.
   * @route GET /api/url
   * @param {import('express').Request} req Express request object.
   * @param {import('express').Response} res Express response object.
   * @returns {Promise<void>} Resolves once the URLs are returned or an error is sent.
   */
  index: async (req, res) => {
    try {
      const urls = await getUrlList();
      res.json(urls);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  /**
   * Create a short URL for the provided original URL. Returns an existing
   * short URL when one is found, otherwise creates and returns a new one.
   * @route POST /api/url/create
   * @param {import('express').Request} req Express request object (`req.body.original_url`).
   * @param {import('express').Response} res Express response object.
   * @returns {Promise<void>} Resolves once the short URL is returned or an error is sent.
   */
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

  /**
   * Delete a stored URL by its short code.
   * @route DELETE /api/url/delete/:short_url
   * @param {import('express').Request} req Express request object (`req.params.short_url`).
   * @param {import('express').Response} res Express response object.
   * @returns {Promise<void>} Resolves once the URL is returned or an error is sent.
   */
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

  /**
   * Fetch a single stored URL by its short code.
   * @route GET /api/url/:short_url
   * @param {import('express').Request} req Express request object (`req.params.short_url`).
   * @param {import('express').Response} res Express response object.
   * @returns {Promise<void>} Resolves once the URL is returned or an error is sent.
   */
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
  },
};

export default UrlShortenerController;
