import express from 'express';
import multer from 'multer';
import MainController from '../controllers/MainController.js';
import GithubController from '../controllers/GithubController.js';
import UrlShortenerController from '../controllers/UrlShortenerController.js';
import GeminiController from '../controllers/GeminiController.js';
// import OpenAiController from '../controllers/OpenAiController.js';

const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 2000000 /* 1MB */}
});
const router = express.Router();

// Site routes
router.get('/', MainController.index); // TODO - add tool to return all routes documentation

// Github routes
router.get('/github/getCommits/:word', GithubController.getCommits);
router.get('/github/getCommitsByRepoAndOwner/:owner/:repo', GithubController.getCommitsByRepoAndOwner);

// UrlShortener routes
router.get('/url', UrlShortenerController.index);
router.post('/url/create', UrlShortenerController.create); 
router.delete('/url/delete/:short_url', UrlShortenerController.delete);
router.get('/url/:short_url', UrlShortenerController.getUrl);

// Google Gemini routes
router.get('/gemini/getFromText', GeminiController.getTextFromPrompt);
router.get('/gemini/getChatFromText/:prompt', GeminiController.getTextFromChat);
router.post('/gemini/getFromImage', upload.single('image'), GeminiController.getTextFromImage);

// // OpenAI routes

export default router;