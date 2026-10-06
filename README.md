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

API requests use `helmet`, CORS, `compression`, and scoped rate limits with IPv6 client
normalization from `express-rate-limit`, with a shared
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

Rate limiting requires explicit deployment configuration before restarting this release.
Use `RATE_LIMIT_STORE=memory` with `RATE_LIMIT_SINGLE_PROCESS=true` only for a verified
single-process deployment; Heroku deployments with multiple dynos use `RATE_LIMIT_STORE=redis`
and the native `redis` client consuming the add-on's `REDIS_URL` directly. Do not copy that
credential into source or another config var. Missing/unsafe settings or failed Redis connection
fail startup. Heroku KVS self-signed TLS requires explicit `REDIS_TLS_REJECT_UNAUTHORIZED=false`;
TLS encryption remains enabled. `RATE_LIMIT_PROXY_MODE=heroku` selects the router-appended
rightmost client IP, conditional on verified router-only ingress. Read
[URL security and limiter operations](docs/url-security.md) for quotas, proxy trust, staging
checks, failure behavior and rollback. No counter service is provisioned by this code.

Before running against existing data, follow the separately authorized
[read-only preflight and index migration](docs/url-integrity-migration.md). Startup awaits
MongoDB and verifies uniqueness indexes before accepting traffic; it never creates them.
Missing required indexes are reported as the safe startup code `URL_INDEXES_MISSING`.
The explicit operator command `node scripts/url-index-migration.js` is read-only by
default; `--apply` creates only missing approved indexes after another preflight.
It requires a separately authorized target, backup and quiesced writers as documented
in the migration procedure; startup never runs the command.

```sh
npm start
npm run dev   # Node watch; restarting also refreshes cached documentation
```

`app.js` exports `createApp` without configuration loading, database or listener side effects.
`server.js` explicitly loads configuration and starts the lifecycle. `TEST=true` is only an
app-factory testing option: it disables the limiter but **cannot start a server**. Production
rejects test mode. Numeric configuration is parsed and range checked. Signals drain requests,
then close MongoDB and the one shared Redis connection within `SHUTDOWN_TIMEOUT_MS`
(default 10 seconds); failed bounded cleanup
logs a safe outcome and exits nonzero. HTTP headers/requests also have bounded timeouts.

## Frontend admission without a Vercel plan upgrade

`POST /api/admission` uses the existing shared counter/Redis connection for the
frontend's aggregate owner (5000/minute), per-IP owner (120/minute), failed owner
(20/10 minutes), and public resolver (60/minute) buckets. Configure an independent
server-only `RATE_LIMIT_SECRET` matching Vercel; it grants admission access only,
never owner operations. An unset secret leaves the endpoint disabled with 503.
The authenticated frontend asserts only Vercel's validated ingress IP, never
arbitrary visitor forwarding headers. IPv6 /56 grouping and hashed keys remain.
Authenticated admission pays the emergency ceiling and its frontend bucket;
it bypasses the unrelated per-egress-IP API quota. See
[operations and backend-first rollout](docs/url-security.md#frontend-admission).
No additional Redis service, Vercel Firewall rule or Vercel plan change is required.

## API contracts and access

- URL create/list/delete require the owner bearer credential in `Authorization`. Public lookup
  remains at `GET /api/url/:short_url`. No cookies, sessions, uploads or generation are enabled.
- Successful create/reuse, lookup and delete remain HTTP 200 document responses. Internal
  `__v` is omitted. Existing numeric codes stay valid; new codes have a random 47-bit space.
  Original URL reuse is global and exact, with no case/path/query normalization.
- URL input must be a string of at most 2048 characters: absolute HTTP(S), no embedded userinfo,
  whitespace or control characters. Codes accept canonical nonnegative safe integer strings
  and the original frontend's four-digit zero padding (for example, `0042` resolves code 42).
  Other noncanonical formats remain invalid. URL responses, including authorization failures,
  use `Cache-Control: no-store` and vary on `Authorization`.
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
- Throttling returns uncached 429 with a bounded delta-seconds `Retry-After`. Counter store
  failures return safe, uncached 503 `RATE_LIMIT_UNAVAILABLE`; no unlimited or local fallback
  replaces shared counters. Verified relay lookups and owner URL operations have separate,
  finite quotas. A missing/invalid optional bearer on public lookup keeps anonymous access.
- Short links and their destinations are public, including existing four-digit codes. Random
  codes and non-indexing do not provide confidential access. Never store a destination whose
  access depends on keeping its short code secret.

Every request gets a generated `X-Request-ID`. Structured logs allow only request IDs, route
**templates**, methods, status/duration and safe dependency operation/outcomes. They exclude
raw URLs, search text, original URLs, headers, cookies, credentials and exception/provider bodies.
`GET /health/live` reports process liveness; `GET /health/ready` reports database/Redis/drain readiness.
Neither exposes configuration; neither includes optional GitHub availability. Health is exempt
from all rate limits, including counter failures. Unrelated routes retain 50 requests per
5 minutes per client; URL anonymous lookup, authenticated relay and verified owner operations
have independent budgets and a documented emergency ceiling. No metrics endpoint is exposed;
status/duration/dependency logs provide the initial operational evidence. Deployment alerting,
trusted proxy hops, TLS termination and restrictive CORS require actual ingress requirements.

`khanos.frontend` is the application consumer. Its public browser reads omit credentials;
its same-origin administration API authenticates the owner separately and forwards this
backend's bearer token from server secrets only. The backend continues to enforce its own
owner boundary, regardless of frontend login or CORS. Deploy both compatibility changes
after provisioning frontend secrets and completing the existing database/index readiness
procedure. No index, data or issued-code migration is added by the padding compatibility fix.
The frontend numeric resolver also sends the existing bearer server-side to select the
finite relay quota. Browsers still need no credentials to resolve public links; frontend
visitor limits must operate before relay traffic reaches this backend.

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

## Blog

Published blog posts are stored in MongoDB and served by `/api/blog`. Owner-only
`GET /api/blog/admin` and `GET /api/blog/admin/:id` include drafts and scheduled
posts for administration. Admin reads, create, patch and delete reuse owner bearer
authentication and return `Cache-Control: no-store`. See
[blog architecture, API contract and explicit import/rollout instructions](docs/blog.md)
before starting this release: the blog uniqueness index must be imported first.
