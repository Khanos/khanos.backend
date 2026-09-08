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

/**
 * Route registry for the Khanos backend.
 * Every route below is mounted under `/api/` by server.js, so the full path
 * of each endpoint is `/api/<path>`. Structured documentation (rendered to the
 * HTML page and as JSON at /api/) lives in routes/docs.js — this file's JSDoc
 * mirrors that metadata for developer readability.
 */

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Returns the structured API documentation as a JSON array of route objects.
 * @route GET /api/
 * @purpose Serve the machine-readable endpoint catalog (see routes/docs.js).
 * @params none
 * @body none
 * @responses 200 Array of documented route objects.
 */
router.get('/', MainController.index); // TODO - add tool to return all routes documentation

// ---------------------------------------------------------------------------
// GitHub — search public commit history via the GitHub API
// ---------------------------------------------------------------------------

/**
 * Search recent commits that contain a given keyword.
 * @route GET /api/github/getCommits/:word
 * @purpose Return commits (from main public repos) whose message contains `word`.
 * @params word (path, string, required) — keyword to search for in commit messages.
 * @body none
 * @responses 200 Array of commit objects; if the GitHub API fails the service swallows the error and returns a JSON body of `null` (still HTTP 200).
 */
router.get('/github/getCommits/:word', GithubController.getCommits);

/**
 * Search recent commits for a specific repository by owner and name.
 * @route GET /api/github/getCommitsByRepoAndOwner/:owner/:repo
 * @purpose Return commits from the named repository identified by its owner and repo name.
 * @params owner (path, string, required) — GitHub account or organization that owns the repository.
 * @params repo (path, string, required) — repository name (without the .git suffix).
 * @body none
 * @responses 200 Array of commit objects; if the GitHub API fails the service swallows the error and returns a JSON body of `null` (still HTTP 200).
 */
router.get('/github/getCommitsByRepoAndOwner/:owner/:repo', GithubController.getCommitsByRepoAndOwner);

// ---------------------------------------------------------------------------
// URL Shortener — Mongoose-backed short URL CRUD
// ---------------------------------------------------------------------------

/**
 * List every stored URL.
 * @route GET /api/url
 * @purpose Return all URLs currently stored in the database.
 * @params none
 * @body none
 * @responses 200 Object `{ error: false, message: 'URLs found', data: [...] }`. On failure returns HTTP 500 with `{ error: <message> }`.
 */
router.get('/url', UrlShortenerController.index);

/**
 * Create a short URL for the provided original URL. Returns an existing short
 * URL when one is already stored, otherwise creates and returns a new one.
 * @route POST /api/url/create
 * @purpose Shorten an original URL (idempotent — reuses an existing short code).
 * @params none
 * @body { original_url: string } — the full URL to shorten; must be a valid absolute URL.
 * @responses 200 The URL document `{ original_url, short_url, creation_date }` (created or reused). On invalid URL or service error returns HTTP 500 with `{ error: <message> }`.
 */
router.post('/url/create', UrlShortenerController.create); 

/**
 * Delete a stored URL by its short code.
 * @route DELETE /api/url/delete/:short_url
 * @purpose Remove a previously created short URL from the database.
 * @params short_url (path, number, required) — short code of the URL to delete.
 * @body none
 * @responses 200 The deleted URL document `{ original_url, short_url, creation_date }`. If no URL exists for the given short code returns HTTP 500 with `{ error: 'URL not found' }` (the controller converts "not found" into a server error rather than a 404).
 */
router.delete('/url/delete/:short_url', UrlShortenerController.delete);

/**
 * Fetch a single stored URL by its short code.
 * @route GET /api/url/:short_url
 * @purpose Return one stored URL document identified by its short code.
 * @params short_url (path, number, required) — short code identifying the stored URL.
 * @body none
 * @responses 200 The requested URL document `{ original_url, short_url, creation_date }`. If no URL exists for the given short code returns HTTP 500 with `{ error: 'URL not found' }` (the controller converts "not found" into a server error rather than a 404).
 */
router.get('/url/:short_url', UrlShortenerController.getUrl);

// ---------------------------------------------------------------------------
// Google Gemini — text and multimodal generation via the Gemini API
// ---------------------------------------------------------------------------

/**
 * Generate text from a text-only prompt.
 * @route GET /api/gemini/getFromText
 * @purpose Produce generated text using the `gemini-pro` model from a single prompt.
 * @params none
 * @query { prompt: string } — the prompt to send to the model (required).
 * @responses 200 Generated text as the response body. If `prompt` is missing returns HTTP 400 with `{ error: 'Prompt is required' }`; on Gemini failure returns HTTP 503 with `{ status: 503, warning: 'This service is temporarily unavailable' }`.
 */
router.get('/gemini/getFromText', GeminiController.getTextFromPrompt);

/**
 * Generate text using a running chat session to build context.
 * @route GET /api/gemini/getChatFromText/:prompt
 * @purpose Produce a reply while persisting the conversation history in the session for follow-up turns.
 * @params prompt (path, string, required) — the user message for this turn of the conversation.
 * @responses 200 Generated reply text as the response body. If the `:prompt` path segment is omitted Express cannot match the route and returns HTTP 404; on Gemini failure returns HTTP 503 with `{ status: 503, warning: 'This service is temporarily unavailable' }`.
 */
router.get('/gemini/getChatFromText/:prompt', GeminiController.getTextFromChat);

/**
 * Generate text from an uploaded image plus an optional prompt (multimodal).
 * @route POST /api/gemini/getFromImage
 * @purpose Produce generated text using the `gemini-pro-vision` model from a multimodal input of an uploaded image and an optional prompt. The uploaded file is deleted after processing.
 * @params none
 * @body { image: File, prompt?: string } — multipart/form-data; `image` (max 2 MB) is required, `prompt` is optional.
 * @responses 200 Generated text as the response body. If either field is missing returns HTTP 400 with `{ error: 'Prompt is required' }` or `{ error: 'Image is required' }`; on Gemini failure returns HTTP 503 with `{ status: 503, warning: 'This service is temporarily unavailable' }`.
 */
router.post('/gemini/getFromImage', upload.single('image'), GeminiController.getTextFromImage);

// // OpenAI routes (disabled — controller not wired up)

export default router;
