# khanos.backend 😍

The Express API behind my site. Two small services that each solve a real problem I had, kept
behind a shared middleware stack and covered by tests.

> Live: **[khanos-backend.herokuapp.com](https://khanos-backend.herokuapp.com)**

## What it does

All endpoints below are mounted under `/api/` (see `app.js` and `api/routes/index.js`). The JSON route catalog is served at `GET /api/`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/github/getCommits/:word` | Search public commit messages by phrase |
| `GET /api/github/getCommitsByRepoAndOwner/:owner/:repo` | Commits for a specific repository |
| `GET /api/url` · `POST /api/url/create` · `GET /api/url/:short_url` · `DELETE /api/url/delete/:short_url` | Mongoose-backed URL shortener |

The Google Gemini API has been retired. Legacy `/api/gemini` and `/api/gemini/*`
endpoints now respond with HTTP **410 Gone** and `{ "error": "Google Gemini API has been retired." }`.
The backend no longer calls Google, accepts image uploads, or stores chat sessions.

API requests use `helmet`, CORS, `compression`, and `express-rate-limit`, with a shared
error-handling middleware for errors that escape controllers. Controllers, services and models
stay in separate layers: controllers handle HTTP, services own the outbound calls, models own the data.

## Getting Started

To get started with the project, clone the repository and install the dependencies:

```sh
git clone https://github.com/Khanos/khanos.backend.git
cd khanos.backend
npm ci --no-audit --no-fund
```

## Configuration and startup

Use Node **24.x** and npm **11.x**. Copy `.env.example` to `.env`, supply a random owner
credential locally, and configure the intended MongoDB database. Never store the owner
credential in browser code, logs, chat, examples or Git. For example, generate random bytes
in a local terminal and put the result directly into your secret manager or untracked `.env`.
`OWNER_API_TOKEN` must have 32-256 non-whitespace ASCII characters; use at least 32 random bytes.

`NODE_ENV` is authoritative; `ENV` is an optional legacy alias that must agree when both are
present. Production uses `DB_NAME`; development uses `TEST_DB_NAME`. No fallback between them
is allowed. `BIND_HOST` is the actual bind address (default `0.0.0.0`, preserving the former
wildcard listener); the old log-only `HOST` variable is retired. `PORT` defaults to 3000.
GitHub uses an HTTPS base URL ending in `/`, a total 5-second request deadline, and at most two
attempts for network failures or upstream 502/503/504. It does not retry rate limits, other
HTTP failures, bad JSON or cancellation. No GitHub credentials or cache are configured.

Before running against existing data, follow the separately authorized
[read-only preflight and index migration](docs/url-integrity-migration.md). Startup awaits
MongoDB and verifies uniqueness indexes before accepting traffic; it never creates them.

```sh
npm start
npm run dev   # Node watch; restarting also refreshes cached documentation
```

`app.js` exports `createApp` without configuration loading, database or listener side effects.
`server.js` explicitly loads configuration and starts the lifecycle. `TEST=true` is only an
app-factory testing option: it disables the limiter but **cannot start a server**. Production
rejects test mode. Numeric configuration is parsed and range checked. Signals drain requests,
then await disconnect within `SHUTDOWN_TIMEOUT_MS` (default 10 seconds); failed bounded cleanup
logs a safe outcome and exits nonzero. HTTP headers/requests also have bounded timeouts.

## API contracts and access

- URL create/list/delete require the owner bearer credential in `Authorization`. Public lookup
  remains at `GET /api/url/:short_url`. No cookies, sessions, uploads or generation are enabled.
- Successful create/reuse, lookup and delete remain HTTP 200 document responses. Internal
  `__v` is omitted. Existing numeric codes stay valid; new codes have a random 47-bit space.
  Original URL reuse is global and exact, with no case/path/query normalization.
- URL input must be a string of at most 2048 characters: absolute HTTP(S), no embedded userinfo,
  whitespace or control characters. Codes must be canonical nonnegative safe integer strings.
- Listing retains `{ error: false, message: "URLs found", data: [...] }` and adds
  `pagination: { limit, next }`. Default `limit=25`, maximum 100; send `after=<next>` to continue.
  Ordering uses immutable `_id`. This is live cursor pagination, not a frozen snapshot.
- GitHub search now searches **public commit messages** instead of the former `q=repo/<word>`.
  Trimmed text is quoted as a phrase; quotes/backslashes/control characters are rejected.
  Search keeps the GitHub `{ total_count, incomplete_results, items, ... }` object; repository
  commits keep the array shape. Both accept `page` (1-1000) and `per_page` (1-100, default 30).
  Search is additionally subject to GitHub's own result limits. Clients request further pages
  explicitly; no upstream pagination links/headers or private-repository authentication are
  exposed. See [GitHub commit search](https://docs.github.com/en/search-github/searching-on-github/searching-commits).
- Shared JSON API errors use `{ error: <safe message>, code, requestId }`: invalid input or JSON
  is 400, missing records/routes 404, oversized bodies 413, unsupported encoding 415, rate limits
  429, unexpected failure 500, DB unavailability 503, and classified GitHub failures 404/502/503/504.
  The retired Gemini 410 shape is unchanged. Documentation errors use HTML with correct status.
  These status corrections replace earlier 200/null and validation-as-500 behavior intentionally.

Every request gets a generated `X-Request-ID`. Structured logs allow only request IDs, route
**templates**, methods, status/duration and safe dependency operation/outcomes. They exclude
raw URLs, search text, original URLs, headers, cookies, credentials and exception/provider bodies.
`GET /health/live` reports process liveness; `GET /health/ready` reports database/drain readiness.
Neither exposes configuration; neither includes optional GitHub availability. Health is exempt
from the global IP limiter (default 50 requests per 5 minutes). No metrics endpoint is exposed;
status/duration/dependency logs provide the initial operational evidence. Deployment alerting,
trusted proxy hops, TLS termination and restrictive CORS require actual ingress requirements.

## Testing

```sh
# MongoDB 8 must be installed, or MONGOD_BIN must identify a local mongod binary.
# Tests create their own process, loopback port and temporary directory.
npm test -- --runInBand
npm run test:integration
npm run lint
git diff --check
```

The database suite never reads `.env`, `CONNECTION_URL`, `DB_NAME` or `TEST_DB_NAME` and never
uses a configured production/test database. A missing `mongod` fails the suite instead of
silently skipping real constraints. It owns and removes only its disposable instance.
Tests use native ESM (Jest 29 needs Node's experimental VM modules flag, set by npm scripts),
real app/router contracts, synthetic credentials, mocked provider failures, and an isolated
HTTP upstream for native fetch timeout/status/encoding tests. Coverage thresholds remain 99%.
A focused no-coverage run uses `TEST=true NODE_OPTIONS=--experimental-vm-modules` with Jest;
`npm run test:watch` supports normal watch iteration.

CI targets verified default branch `main` and retains `master` compatibility, installs from
lockfile without audit metadata upload, checks declared engines, verifies a pinned MongoDB
binary checksum, and runs lint/full tests. No deployment or GitHub protection changes are made.
Passing this suite proves local contracts and disposable database invariants, not production
data cleanliness, ingress policy, provider quotas or hosted CI success. The implementation
status file records separately performed live public GitHub checks.

## Project Structure
The project has the following structure:

- **api/:** Contains the controllers, middlewares, models, routes, and services for the application.
- **public/:** Contains the static files served by the application.
- **tests/:** Contains the test files for the application.
- **views/:** Contains the view templates for the application.

### Controllers
- **MainController.js:** Handles the main routes of the application.
- **GithubController.js:** Handles the GitHub-related routes of the application.
- **UrlShortenerController.js:** Handles the URL shortening related routes of the application.

### Services
- **GithubService.js:** Service to interact with the GitHub API.
- **UrlShortenerService.js:** Short-code generation and lookup for the URL shortener.

### Middlewares
- **errorHandler.js:** Central error handler; every route delegates its failures here.

### Models
- **UrlModel.js:** Model for URL data.

### License
Licensed under the [GNU Lesser General Public License v3.0](LICENSE).
