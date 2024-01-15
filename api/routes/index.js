const express = require('express');
const router = express.Router();
const MainController = require('../controllers/MainController');
const GithubController = require('../controllers/GithubController');
const UrlShortenerController = require('../controllers/UrlShortenerController');
// const OpenAiController = require('./controllers/OpenAiController');

// Site routes
router.get('/', MainController.index); // TODO - add tool to return all routes documentation

// Github routes
router.get('/github/getCommits/:word', GithubController.getCommits);
router.get('/github/getCommitsByRepoAndOwner/:owner/:repo', GithubController.getCommitsByRepoAndOwner);

// UrlShortener routes
router.get('/url/:slug', UrlShortenerController.index);

// // OpenAI routes
// router.get('/openai/getResponse/:text', OpenAiController.getResponse);
// router.get('/openai/getImage/:text', OpenAiController.getImage);

// // mocked routes
// router.get('/mocked/openai/getResponse/:text', OpenAiController.getMockedResponse);
// router.get('/mocked/openai/getImage/:text', OpenAiController.getMockedImage);

module.exports = router;