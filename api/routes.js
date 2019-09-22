const express = require('express');
const router = express.Router()

let SiteController = require('./controllers/SiteController');
let GithubController = require('./controllers/GithubController');

// Site routes
router.get('/', SiteController.index);
// Github routes
router.get('/getRepos', GithubController.getRepos);
router.get('/searchCommitsWithWord/:word', GithubController.searchCommitsWithWord);

module.exports = router;