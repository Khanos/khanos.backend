import { Router } from 'express';
import MainController from '../controllers/MainController.js';
import createGithubController from '../controllers/GithubController.js';
import createUrlController from '../controllers/UrlShortenerController.js';
import ownerAuth from '../middlewares/ownerAuth.js';

/** Actual route composition; dependencies are plain services, with no import side effects. */
export default function createRouter({ githubService, urlService, ownerToken }) {
  const router = Router();
  const github = createGithubController(githubService);
  const urls = createUrlController(urlService);
  const authorize = ownerAuth(ownerToken);
  router.get('/', MainController.index);
  router.get('/github/getCommits/:word', github.getCommits);
  router.get('/github/getCommitsByRepoAndOwner/:owner/:repo', github.getCommitsByRepoAndOwner);
  router.get('/url', authorize, urls.index);
  router.post('/url/create', authorize, urls.create);
  router.delete('/url/delete/:short_url', authorize, urls.delete);
  router.get('/url/:short_url', urls.getUrl);
  return router;
}
