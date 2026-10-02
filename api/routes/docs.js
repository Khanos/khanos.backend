/** Passive endpoint catalog shared by GET /api/ and the HTML documentation. */
const errors = [
  { status: 400, description: 'Invalid input, code, path encoding or pagination.' },
  { status: 413, description: 'Body exceeds 100 KiB or form has over 100 parameters.' },
  { status: 415, description: 'Unsupported request encoding.' },
  { status: 429, description: 'Rate limit exceeded.' },
  { status: 500, description: 'Unexpected internal failure; details are masked.' },
];
const authorization = { status: 401, description: 'Owner bearer authorization required.' };
const database = { status: 503, description: 'Database unavailable or bounded code allocation exhausted.' };
const notFound = { status: 404, description: 'URL not found.' };
const githubErrors = [
  { status: 404, description: 'GitHub resource not found.' },
  { status: 502, description: 'GitHub network, HTTP or response-contract failure.' },
  { status: 503, description: 'GitHub denied access or rate limited the request.' },
  { status: 504, description: 'GitHub deadline exceeded or request cancelled.' },
];
const codeParam = { name: 'short_url', type: 'number', required: true, description: 'Nonnegative safe integer: canonical digits or legacy four-digit zero padding. Existing issued codes remain supported.' };
const githubPagination = [
  { name: 'page (query)', type: 'number', required: false, description: 'Page 1-1000; default 1. Search is also subject to GitHub result limits.' },
  { name: 'per_page (query)', type: 'number', required: false, description: 'Page size 1-100; default 30.' },
];
export const routes = [
  { label: 'Main', endpoints: [
    { method: 'GET', path: '/', summary: 'API documentation page', description: 'Cached repository-owned Markdown plus endpoint metadata; restart/watch to refresh.', params: [], responses: [{ status: 200, description: 'HTML documentation.' }] },
    { method: 'GET', path: '/api/', summary: 'API documentation (JSON)', description: 'Returns this endpoint catalog. Shared API failures use { error, code, requestId } with an X-Request-ID header.', params: [], responses: [{ status: 200, description: 'Array of endpoint groups.' }] },
    { method: 'GET', path: '/health/live', summary: 'Liveness', description: 'Process is responding; does not probe optional providers.', params: [], responses: [{ status: 200, description: '{ status: "ok" }' }] },
    { method: 'GET', path: '/health/ready', summary: 'Readiness', description: 'Traffic is accepted only after database/index readiness. Readiness becomes false on draining or loss of DB connection.', params: [], responses: [{ status: 200, description: '{ status: "ready" }' }, { status: 503, description: '{ status: "not_ready" }' }] },
  ] },
  { label: 'GitHub', endpoints: [
    { method: 'GET', path: '/api/github/getCommits/:word', summary: 'Search public commit messages', description: 'Public GitHub commit-message phrase search. The trimmed input is quoted; quotes, backslashes and control characters are rejected. No owner/repo restriction, credentials or cache.',
      params: [{ name: 'word', type: 'string', required: true, description: 'Message phrase, 1-200 characters.' }, ...githubPagination],
      responses: [{ status: 200, description: 'GitHub search object with total_count, incomplete_results and items; extra upstream fields are retained.' }, ...errors, ...githubErrors] },
    { method: 'GET', path: '/api/github/getCommitsByRepoAndOwner/:owner/:repo', summary: 'List repository commits', description: 'Public commit list for a validated owner/repository. Upstream pagination is explicit; native GitHub array shape is retained.',
      params: [{ name: 'owner', type: 'string', required: true, description: 'Account/organization name, 1-39 characters.' }, { name: 'repo', type: 'string', required: true, description: 'Repository name, 1-100 letters, digits, dots, underscores or hyphens.' }, ...githubPagination],
      responses: [{ status: 200, description: 'GitHub commit array for the requested page.' }, ...errors, ...githubErrors] },
  ] },
  { label: 'URL Shortener', endpoints: [
    { method: 'GET', path: '/api/url', summary: 'List a page of stored URLs (owner)', description: 'Owner bearer authorization required. Ascending immutable _id order, projected fields and an opaque next cursor.',
      params: [{ name: 'limit (query)', type: 'number', required: false, description: '1-100; default 25.' }, { name: 'after (query)', type: 'string', required: false, description: '24 lowercase hexadecimal characters; use pagination.next from the previous response.' }],
      responses: [{ status: 200, description: '{ error: false, message: "URLs found", data: [...], pagination: { limit, next } }. next is null at the end.' }, authorization, ...errors, database] },
    { method: 'POST', path: '/api/url/create', summary: 'Create or reuse a short URL (owner)', description: 'Owner bearer authorization required. Global exact original-URL reuse without canonicalization. New numeric codes use a cryptographically random 47-bit allocation space, with unique indexes and five bounded attempts.',
      params: [{ name: 'original_url (body)', type: 'string', required: true, description: 'Absolute HTTP(S) URL, at most 2048 characters, no embedded credentials, whitespace or control characters.' }],
      responses: [{ status: 200, description: 'Projected document { _id, original_url, short_url, creation_date }, created or reused.' }, authorization, ...errors, database] },
    { method: 'GET', path: '/api/url/:short_url', summary: 'Get a stored URL (public)', description: 'Public lookup by issued numeric short code; no redirect and no list access.', params: [codeParam],
      responses: [{ status: 200, description: 'Projected URL document { _id, original_url, short_url, creation_date }.' }, ...errors, notFound, database] },
    { method: 'DELETE', path: '/api/url/delete/:short_url', summary: 'Delete a short URL (owner)', description: 'Owner bearer authorization required. Deletes the stored mapping; a missing mapping returns 404.', params: [codeParam],
      responses: [{ status: 200, description: 'Projected deleted URL document.' }, authorization, ...errors, notFound, database] },
  ] },
];
