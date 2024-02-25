const express = require('express');
const multer  = require('multer')
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 2000000 /* 1MB */}
});
const router = express.Router();
const MainController = require('../controllers/MainController');
const GithubController = require('../controllers/GithubController');
const UrlShortenerController = require('../controllers/UrlShortenerController');
const GeminiController = require('../controllers/GeminiController');
// const OpenAiController = require('./controllers/OpenAiController');

// Site routes
router.get('/', MainController.index); // TODO - add tool to return all routes documentation

// Github routes
router.get('/github/getCommits/:word', GithubController.getCommits);
router.get('/github/getCommitsByRepoAndOwner/:owner/:repo', GithubController.getCommitsByRepoAndOwner);

// UrlShortener routes
router.get('/url/:slug', UrlShortenerController.index);

// Google Gemini routes
router.get('/gemini/getFromText', GeminiController.getTextFromPrompt);
router.post('/gemini/getFromImage', upload.single('image'), GeminiController.getTextFromImage);

// // OpenAI routes
// router.get('/openai/getResponse/:text', OpenAiController.getResponse);
// router.get('/openai/getImage/:text', OpenAiController.getImage);

// // mocked routes
// router.get('/mocked/openai/getResponse/:text', OpenAiController.getMockedResponse);
// router.get('/mocked/openai/getImage/:text', OpenAiController.getMockedImage);

module.exports = router;