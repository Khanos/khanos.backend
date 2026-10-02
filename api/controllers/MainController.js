import fs from 'node:fs';
import path from 'node:path';
import markdownit from 'markdown-it';
import { ROOT } from '../../config.js';
import { routes } from '../routes/docs.js';

const md = markdownit();
let renderedReadme;
/** Repository-owned documentation is cached per process; restart/watch to refresh. */
const MainController = {
  index(req, res) { res.json(routes); },
  render(req, res) {
    if (renderedReadme === undefined) renderedReadme = md.render(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'));
    return res.render('index.ejs', { md: renderedReadme, routes });
  },
};
export default MainController;
