import { Router } from 'express';
import MainController from '../controllers/MainController.js';
import createGithubController from '../controllers/GithubController.js';
import createUrlController from '../controllers/UrlShortenerController.js';
import createBlogController from '../controllers/BlogController.js';
import ownerAuth from '../middlewares/ownerAuth.js';

/** Actual route composition; dependencies are plain services, with no import side effects. */
export default function createRouter({ githubService, urlService, ownerToken, blogService }) {
  const router = Router();
  const github = createGithubController(githubService);
  const urls = createUrlController(urlService);
  const blog = createBlogController(blogService);
  const authorize = ownerAuth(ownerToken);
  router.get('/', MainController.index);
  router.get('/github/getCommits/:word', github.getCommits);
  router.get('/github/getCommitsByRepoAndOwner/:owner/:repo', github.getCommitsByRepoAndOwner);
  router.use('/url', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.vary('Authorization');
    next();
  });
  router.get('/url', authorize, urls.index);
  router.post('/url/create', authorize, urls.create);
  router.delete('/url/delete/:short_url', authorize, urls.delete);
  router.get('/url/:short_url', urls.getUrl);
  router.use('/blog', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get('/blog', blog.index);
  router.get('/blog/admin', authorize, blog.adminIndex);
  router.get('/blog/admin/:id', authorize, blog.adminGet);
  router.get('/blog/:slug', blog.get);
  router.post('/blog', authorize, blog.create);
  router.patch('/blog/:id', authorize, blog.update);
  router.delete('/blog/:id', authorize, blog.delete);
  return router;
}
