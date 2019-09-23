const express = require('express');
const router = express.Router()
let MainController = require('./controllers/MainController');
let GithubController = require('./controllers/GithubController');
// Site routes
router.get('/', MainController.index);
// Github routes
router.get('/getRepos', GithubController.getRepos);
router.get('/searchCommitsWithWord/:word', GithubController.searchCommitsWithWord);

module.exports = router;