/**
 * API Routes Documentation
 * ------------------------------------------------------------------
 * Single source of truth for every endpoint exposed by this service.
 * The root page (views/index.ejs) and the JSON served at /api/ are both
 * rendered from this metadata, so any change here is reflected everywhere.
 *
 * Each entry describes one HTTP route: method, path, a short summary, a
 * longer description, path/query parameters, and the possible responses
 * (status code + human description + example payload).
 */

/** @typedef {Object} ApiResponse - A single documented response variant */
/** @typedef {{name:string,type:string,required:boolean,description:string}} ApiParam - One path parameter */

/**
 * Documented response for an endpoint.
 * @property {number|string} status HTTP status code (or string alias).
 * @property {string} description Human-readable meaning of the response.
 * @property {Object|Array|null} example Representative JSON payload.
 */

/**
 * A single documented endpoint.
 * @property {'GET'|'POST'|'PUT'|'DELETE'} method HTTP verb.
 * @property {string} path Route path, including `:param` placeholders.
 * @property {string} summary One-line description of what the route does.
 * @property {string} description Longer explanation, shown in the body.
 * @property {ApiParam[]} params Path parameters (query/body are inline).
 * @property {Array<Object>} responses Possible status codes and payloads.
 */

/**
 * A group of endpoints sharing a service/feature area.
 * @property {string} label Group heading shown above its endpoints.
 * @property {Array<Object>} endpoints Documented routes in this group.
 */

export const routes = [
  {
    label: 'Main',
    endpoints: [
      {
        method: 'GET',
        path: '/',
        summary: 'API documentation page',
        description:
          'Renders the human-readable API documentation for this service, including endpoint groups, parameters and response examples.',
        params: [],
        responses: [
          { status: 200, description: 'HTML documentation page' },
        ],
      },
      {
        method: 'GET',
        path: '/api/',
        summary: 'API documentation (JSON)',
        description:
          'Returns the same endpoint metadata as structured JSON. Useful for clients that want to fetch the docs programmatically.',
        params: [],
        responses: [
          { status: 200, description: 'Array of documented routes' },
        ],
      },
    ],
  },
  {
    label: 'GitHub',
    endpoints: [
      {
        method: 'GET',
        path: '/api/github/getCommits/:word',
        summary: 'Search commits by keyword',
        description:
          'Searches recent GitHub commits (main public repositories) that contain the given word.',
        params: [
          { name: 'word', type: 'string', required: true, description: 'Keyword to search for in commit messages.' },
        ],
        responses: [
          { status: 200, description: 'Array of commit objects. On upstream failure the service swallows the error and returns a JSON body of `null` (still HTTP 200).' },
        ],
      },
      {
        method: 'GET',
        path: '/api/github/getCommitsByRepoAndOwner/:owner/:repo',
        summary: 'Search commits by owner and repo',
        description:
          'Searches recent GitHub commits for a specific repository, identified by its owner and name.',
        params: [
          { name: 'owner', type: 'string', required: true, description: 'GitHub account or organization that owns the repository.' },
          { name: 'repo', type: 'string', required: true, description: 'Repository name (without the .git suffix).' },
        ],
        responses: [
          { status: 200, description: 'Array of commit objects. On upstream failure the service swallows the error and returns a JSON body of `null` (still HTTP 200).' },
        ],
      },
    ],
  },
  {
    label: 'URL Shortener',
    endpoints: [
      {
        method: 'GET',
        path: '/api/url',
        summary: 'List all stored URLs',
        description: 'Fetches every URL currently stored in the database.',
        params: [],
        responses: [
          { status: 200, description: 'Array of stored URL documents.' },
          { status: 500, description: 'Internal server error while reading from the database.' },
        ],
      },
      {
        method: 'POST',
        path: '/api/url/create',
        summary: 'Create a short URL',
        description:
          'Creates a new short URL for the provided original URL. If an existing short URL is found, it is returned; otherwise a new one is created.',
        params: [
          { name: 'original_url', type: 'string', required: true, description: 'The full URL to shorten.' },
        ],
        responses: [
          { status: 200, description: 'The shortened URL document `{ original_url, short_url, creation_date }` (created or reused).', example: { original_url: 'https://example.com/very-long-path', short_url: 12345, creation_date: '2026-01-01T00:00:00.000Z' } },
          { status: 400, description: 'The original_url is not a valid URL.' },
          { status: 500, description: 'Internal server error while creating the short URL.' },
        ],
      },
      {
        method: 'GET',
        path: '/api/url/:short_url',
        summary: 'Get a stored URL',
        description: 'Fetches a single stored URL by its short code.',
        params: [
          { name: 'short_url', type: 'string', required: true, description: 'Short code identifying the stored URL.' },
        ],
        responses: [
          { status: 200, description: 'The requested URL document `{ original_url, short_url, creation_date }`.', example: { original_url: 'https://example.com', short_url: 12345, creation_date: '2026-01-01T00:00:00.000Z' } },
          { status: 500, description: 'No URL found for the given short code; returns `{ error: \'URL not found\' }`.', example: { error: 'URL not found' } },
          { status: 500, description: 'Internal server error while reading from the database.' },
        ],
      },
      {
        method: 'DELETE',
        path: '/api/url/delete/:short_url',
        summary: 'Delete a short URL',
        description: 'Deletes a stored URL by its short code.',
        params: [
          { name: 'short_url', type: 'string', required: true, description: 'Short code of the URL to delete.' },
        ],
        responses: [
          { status: 200, description: 'The deleted URL document `{ original_url, short_url, creation_date }`.', example: { original_url: 'https://example.com', short_url: 12345, creation_date: '2026-01-01T00:00:00.000Z' } },
          { status: 500, description: 'No URL found for the given short code; returns `{ error: \'URL not found\' }`.', example: { error: 'URL not found' } },
          { status: 500, description: 'Internal server error while deleting from the database.' },
        ],
      },
    ],
  },
  {
    label: 'Gemini',
    endpoints: [
      {
        method: 'GET',
        path: '/api/gemini/getFromText',
        summary: 'Generate text from a prompt',
        description:
          'Generates text using Gemini from a text-only prompt supplied as a query parameter.',
        params: [
          { name: 'prompt', type: 'string', required: true, description: 'The prompt to send to the model.' },
        ],
        responses: [
          { status: 200, description: 'Generated text response.' },
          { status: 400, description: 'The prompt query parameter is missing.', example: { error: 'Prompt is required' } },
          { status: 503, description: 'Service temporarily unavailable; returns `{ status: 503, warning: \'This service is temporarily unavailable\' }`.', example: { status: 503, warning: 'This service is temporarily unavailable' } },
        ],
      },
      {
        method: 'GET',
        path: '/api/gemini/getChatFromText/:prompt',
        summary: 'Generate text with chat context',
        description:
          'Generates a reply using Gemini, maintaining conversation history in the session to build context.',
        params: [
          { name: 'prompt', type: 'string', required: true, description: 'The user message for this turn of the conversation.' },
        ],
        responses: [
          { status: 200, description: 'Generated reply text.' },
          { status: 404, description: 'The `:prompt` path segment is omitted; Express cannot match the route.' },
          { status: 503, description: 'Gemini service temporarily unavailable.', example: { status: 503, warning: 'This service is temporarily unavailable' } },
        ],
      },
      {
        method: 'POST',
        path: '/api/gemini/getFromImage',
        summary: 'Generate text from image and prompt',
        description:
          'Generates text using Gemini from a multimodal input of an uploaded image plus an optional prompt. The uploaded file is deleted after processing.',
        params: [
          { name: 'image', type: 'file', required: true, description: 'Uploaded image (multipart/form-data), max 2 MB.' },
          { name: 'prompt', type: 'string', required: false, description: 'Optional text prompt to accompany the image.' },
        ],
        responses: [
          { status: 200, description: 'Generated text response based on the image and prompt.' },
          { status: 400, description: 'The prompt or image field is missing.', example: { error: 'Prompt is required' } },
          { status: 503, description: 'Service temporarily unavailable; returns `{ status: 503, warning: \'This service is temporarily unavailable\' }`.', example: { status: 503, warning: 'This service is temporarily unavailable' } },
        ],
      },
    ],
  },
];
