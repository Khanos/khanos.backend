import path from 'path';
import fs from 'fs';
import markdownit from 'markdown-it';
import { routes } from '../routes/docs.js';

const md = markdownit();

/**
 * Main controller — site and meta endpoints.
 */
const MainController = {
  /**
   * Returns the API documentation metadata as JSON (served at /api/).
   * @param {import('express').Request} req Express request object.
   * @param {import('express').Response} res Express response object.
   * @returns {Promise<void>} Resolves once the response is sent.
   */
  index: (req, res) => {
    res.json(routes);
  },

  /**
   * Renders the root documentation page from README markdown plus the
   * structured endpoint metadata in views/index.ejs.
   * @param {import('express').Request} req Express request object.
   * @param {import('express').Response} res Express response object.
   * @returns {Promise<void>} Resolves once the view is rendered.
   */
  render: async (req, res) => {
    const textReadme = fs.readFileSync(path.join('README.md'), 'utf-8');
    return res.render('index.ejs', { md: md.render(textReadme), routes });
  },
};

export default MainController;
