const express = require('express');
const router = express.Router()
const MainController = require('./controllers/MainController');
const GithubController = require('./controllers/GithubController');
const OpenAiController = require('./controllers/OpenAiController');

// Site routes
router.get('/', MainController.index);

// Github routes
router.get('/github/getCommits/:word', GithubController.getCommits);

// OpenAI routes
router.get('/openai/getResponse/:text', OpenAiController.getResponse);
router.get('/openai/getImage/:text', OpenAiController.getImage);

// mocked routes
router.get('/mocked/openai/getResponse/:text', OpenAiController.getMockedResponse);

module.exports = router;