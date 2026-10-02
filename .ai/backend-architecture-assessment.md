# Backend Architecture Assessment

## Executive Summary

Assessment date: 2026-10-02. Repository: `/home/epi/Work/khanos.backend`, branch `main`, commit `2c40d6f`. This is the backend discussed in the preceding indexing and initialization work; the parent working directory contains several independent repositories.

**Subsequent implementation update (2026-10-02):** At the owner's request, Google
Gemini generation was retired after this assessment. The SDK, Gemini controllers/services,
multipart middleware, and chat sessions were removed; legacy `/api/gemini` paths now return
410 JSON and are absent from the active route catalog. Gemini/upload/session findings
below describe the assessed snapshot and no longer describe active runtime functionality.
The remaining GitHub, URL-integrity, lifecycle, and general API findings still need their
own review and implementation. The original assessment is retained as historical evidence.

The backend is a small, synchronous-request-oriented **layered Express monolith with MVC documentation pages**. Routes call controller object methods; controllers call service objects; the URL service calls a Mongoose model directly. GitHub services wrap `fetch`; Gemini services only construct SDK model objects, leaving generation, file handling, and conversation orchestration in the controller. It is not Clean Architecture, hexagonal architecture, or a full repository pattern implementation.

The organization is understandable and proportionate to three feature areas. There are useful foundations: explicit routes, recognizable controller/service/model boundaries, a shared documentation catalog, EJS escaping, security middleware, a dependency lockfile, and unit/API tests. A rewrite, microservices, CQRS, or a general-purpose dependency injection framework would not address the main risks.

The API pattern is **structurally similar but behaviorally inconsistent**. Services return raw provider JSON, nullable values, SDK objects, or `{ error, message, data }` envelopes. Controllers return raw database documents, envelopes, HTML-interpreted strings, and differing error shapes. Some failures are indistinguishable from success at the HTTP layer.

Highest-value work, in order of urgency:

1. Establish an explicit access policy for public reads, URL mutation, and paid Gemini operations. Currently no application-level identity or permission check exists.
2. Return generated content as plain text or JSON. Gemini strings are currently served as HTML with an inline-script-permitting CSP.
3. Upgrade and constrain the multipart boundary. The locked Multer version is affected by a current maintainer-confirmed denial-of-service advisory; application upload cleanup is also incomplete.
4. Repair short-code integrity. Two different valid URLs can share a code and creation can return the wrong original URL. Uniqueness and concurrent creation are not enforced.
5. Fix actual HTTP error statuses, provider failure handling, session storage/bounds, and startup/shutdown behavior.
6. Add tests at the real router and database boundaries, then improve logs, bounded queries, configuration, and CI.

**Evidence and limits.** This is an assessment, not a penetration test or production audit. All first-party application modules, test suites, route metadata, templates, and relevant configuration were inspected. Dependency versions were read from `package-lock.json` and compared with installed direct dependencies; they matched. Vendored browser assets were identified from their headers rather than exhaustively audited. Generated graph binaries, Git history, local secret files, dependency internals, and production infrastructure were not exhaustively reviewed. No live MongoDB, GitHub, or Gemini calls were made.

Graph verification used project `home-epi-Work-khanos.backend`, generation `2026-09-08T09:21:04Z`, with scoped coverage checks, complete API-symbol results, import relationships, and representative inbound/outbound call traces. No recorded skipped or partially parsed files were reported. Templates, lockfile, debugger configuration, and other untracked/excluded graph paths were read directly. Some destructured service calls resolve heuristically to controller-local symbols, so exact source, not a missing graph edge, establishes those dependencies. Negative claims below are bounded to the reviewed application and tracked configuration, not deployment systems.

Validation performed without changing application code:

- `npm run lint`: passed.
- Existing suite in an isolated `/tmp` copy: **10 suites, 58 tests passed**, with the configured coverage gate satisfied. Instrumented statements, branches, and functions each measured 100%; coverage is restricted to `api/`, with mocks excluded.
- Tests used installed dependencies and local **Node v26.7.0**, not the declared Node 24 runtime. The initial sandbox run could not open a local listener; the permitted rerun succeeded. This is not evidence that declared-runtime CI works.
- Bounded HTTP probes used the real server/router in the disposable copy, synthetic uploads, placeholder credentials, and mocked database/provider methods. They confirmed routing, response, middleware, and cleanup behavior, not real database persistence or provider availability.
- Registry-backed `npm audit` could not be completed: automatic approval review rejected the network action because it would export lockfile dependency metadata to npm. Public maintainer advisories were checked instead. There is no complete transitive vulnerability result.
- The existing `AGENTS.md` modification predates this assessment. This phase adds only this report; no implementation, dependency, or migration changes are proposed as already completed.

## Technology Overview

| Area | Current implementation | Evidence |
| --- | --- | --- |
| Runtime | JavaScript ES modules; declared Node 24.x/npm 11.x | `package.json:2,50` |
| HTTP | Express 5.2.1 | `package-lock.json`; `server.js` |
| Persistence | Mongoose 8.24.4 and MongoDB; one application model | `db.js`; `api/models/UrlModel.js` |
| HTTP middleware | compression 1.8.1, helmet 7.1.0, cors 2.8.5, express-rate-limit 8.7.0 | `server.js:24-52`; lockfile |
| Session state | express-session 1.19.0, default in-process store | `server.js:48-52` |
| AI | `@google/generative-ai` 0.2.1, hardcoded `gemini-pro` and `gemini-pro-vision` | `api/services/GeminiService.js:6-14` |
| GitHub | Native `fetch` against configured base URL | `api/services/GithubService.js` |
| Uploads | Multer 1.4.5-lts.1, disk storage under `uploads/` | `api/routes/index.js:9-12` |
| Rendering | EJS 3.1.10, markdown-it 14.3.1, local Bootstrap/jQuery/Popper assets | `MainController.js`; `views/`; `public/` |
| Configuration | Repeated `dotenv.config()` and direct `process.env` reads | `server.js`, `db.js`, provider services |
| Testing | Jest 29/Babel transformation, Supertest, mocks and JSON/PNG fixtures | `jest.config.js`; `tests/` |
| Tooling | ESLint 8/Babel parser; npm lockfile; GitHub Actions | `.eslintrc.cjs`; `.github/workflows/node.js.yml` |
| Hosting intent | README advertises Heroku; `app.json` declares `heroku-26` | Hosting configuration and live deployment not verified |

There is no build step. `npm start` runs `server.js`; `npm run dev` uses Node's `--watch`. `openai` remains a dependency, but application routes do not expose OpenAI and no active first-party module imports it. A React Babel preset is installed although the application contains no React implementation. These are cleanup candidates, not evidence of a runtime vulnerability by themselves.

Google identifies the old JavaScript SDK family as deprecated and no longer actively maintained. A provider adapter migration is warranted, but actual account/model availability still needs a live, authorized check; this assessment does not assert a production outage or nominate an unverified replacement model. [Google's library guidance](https://ai.google.dev/gemini-api/docs/libraries).

## Repository Structure

```text
server.js                     application composition + listener + lifecycle
db.js                         global Mongoose connect/disconnect
api/
  routes/index.js             all API registrations and upload middleware
  routes/docs.js              grouped endpoint documentation metadata
  controllers/                Main, Github, Gemini, UrlShortener
  services/                   Github, Gemini, UrlShortener
  models/UrlModel.js           sole database schema/model
  middlewares/errorHandler.js HTML error presentation
  utils/index.js              URL validation + short-code hash
  mocks/                      test-only database mock and data fixtures
tests/
  controllers/                HTTP tests, mostly independent Express apps
  services/                   provider/database method mocks
  models/                     mocked model operations
  midleware/                  error-rendering tests (directory typo)
  utils/                      pure function tests
  fixtures/                   image fixture
views/                        EJS documentation and error pages
public/                       local browser libraries and CSS
.github/workflows/            lint/test workflow
.vscode/launch.json           stale Mocha/nodemon debugger instructions
package.json / lockfile       scripts, engines, reproducible dependency graph
.env.example                  incomplete configuration example
app.json                      hosting metadata
.codebase-memory/             committed graph tooling artifacts
AGENTS.md / README.md         contributor guidance / user-facing documentation
```

This is organization by technical layer, with feature names repeated across layers. GitHub, URL shortening, Gemini, and documentation are recognizable boundaries; none calls another feature's service. Shared utilities contain only two functions and are not a god module. The largest first-party *operational responsibility* concentration is GeminiController: HTTP, file conversion/deletion, provider orchestration, output formatting, and chat history all live there despite its modest line count.

Adding a feature requires edits across routes/controllers/services and potentially models/tests/docs. That is acceptable at this scale, although copying the current code also copies inconsistent error behavior. `routes/docs.js` is longer because it carries documentation data, not because it contains excessive domain logic. A 4,197,330-byte base64 fixture in `api/mocks/b64jsonImage.js`, test fixtures under application folders, tracked `.DS_Store` files, and stale debugger launch settings create avoidable navigation noise.

No application background worker, scheduler, message queue, cron registration, event bus, or separate job process was found in the reviewed source/configuration. Express middleware and the server's `close` event are not a background-job architecture.

## Architecture Map

```text
Client
  |
  v
server.js: Express + shared middleware
  |-- /public assets --> express.static (before the security middleware)
  |-- GET / --> MainController.render --> README + routes/docs.js --> EJS
  |
  `-- /api --> routes/index.js
                 |-- MainController.index --> routes/docs.js --> JSON
                 |
                 |-- GithubController
                 |     `--> GithubService --> fetch --> GitHub API
                 |
                 |-- UrlShortenerController --> validateUrl
                 |     `--> UrlShortenerService --> hashCode
                 |              `--> UrlModel --> Mongoose --> MongoDB
                 |
                 `-- GeminiController <--> req.session.chatHistory
                       |--> GeminiService --> SDK model object
                       |--> SDK generation/chat --> Gemini API
                       `--> synchronous local file read + upload deletion

Escaping controller/middleware failures --> errorHandler --> EJS error page
Lifecycle: server.js --> db.js --> global Mongoose connection
```

There is **no dedicated repository layer** between the URL service and model. External providers and persistence share the broad `services/` label but serve different roles. Shared session and limiter state reside in this process, making the application more stateful than its small REST surface suggests.

## API Request Lifecycle

### Normal request

`server.js:24-52` registers static assets, JSON parsing, extended URL-encoded parsing, compression, Helmet, unrestricted CORS, an optional global limiter, and sessions. It then mounts the router at `/api/`. The limiter defaults to 50 requests per 300,000 ms and is disabled when `TEST=true`. Static success responses finish before the later middleware; CORS preflight can also finish before the limiter. None of these components authenticates a caller.

### URL creation

`POST /api/url/create` → `UrlShortenerController.create` (`:33`) → `validateUrl` → `getShortUrl(original_url)` → `UrlModel.findOne({ short_url: hash })`. A found record is returned immediately. Otherwise `createNewShortUrl` issues a second operation, `UrlModel.create`, and returns the document.

This splits HTTP handling from Mongoose operations, but keeps find-or-create policy in the controller and mistakes any service error for a missing record. It is a sequential lookup plus write, not an atomic idempotent operation. The hash lookup does not verify the record's original URL.

### GitHub query

`GET /api/github/getCommitsByRepoAndOwner/:owner/:repo` → thin controller → service builds an interpolated URL → `fetch` → `response.json()` → controller forwards provider JSON. There is no `response.ok` check or application timeout. Network/JSON exceptions become `null`, usually returned as HTTP 200; upstream non-success JSON is also forwarded under 200.

### Gemini image generation

`POST /api/gemini/getFromImage` → Multer writes a disk file → controller checks truthiness of prompt/file → synchronously reads/base64-encodes the file → obtains SDK model → calls provider → deletes file in a callback → sends generated string. Missing prompt, thrown provider errors, and other early failures bypass deletion. The deletion callback ignores its error argument.

### Error/fallback request

The GET fallback in `server.js:61-72` and `errorHandler.js:4-15` put a status value into template locals but never call `res.status`. The response is normally HTTP 200 HTML. This applies to unknown API GET paths, body-parser errors, and upload errors that reach the shared handler. Unknown non-GET paths can instead reach Express's default final handler, creating another format/status inconsistency.

## Existing Architecture Patterns

| Pattern | Finding |
| --- | --- |
| Layered architecture | Clearly present: routes → controllers → services → model/provider; folder structure encodes the layers. |
| MVC | Present for documentation/error rendering, using controllers, EJS views, and data supplied from README/catalog. |
| Service layer | Present but uneven: URL data operations, GitHub HTTP adapters, and Gemini model factories. |
| Repository pattern | Not explicitly implemented. UrlShortenerService also acts as a persistence wrapper while mixing hashing and error translation. |
| Dependency injection | No composition-level injection. Static imports and singleton objects are changed/spied on in tests. |
| Domain-driven/feature organization | Feature names provide informal boundaries; no aggregates, domain types, ownership model, or feature-contained packages. |
| Hexagonal/Clean Architecture | Not established. Application logic depends directly on SDK/Mongoose/fs infrastructure. |
| Event-driven/CQRS | Not present in reviewed application. Reads/writes use the same services and process. |
| Shared utilities | Small and specific; validation and hashing are reusable, although they need stronger domain rules. |

The architecture's weakness is inconsistent contracts and operational controls, not insufficient abstraction layers.

## API Conventions

### Registered surface

| Endpoint | Controller and behavior |
| --- | --- |
| `GET /api/` | MainController.index returns documentation groups. |
| `GET /api/github/getCommits/:word` | GitHub search JSON forwarded; search uses `q=repo/<word>`, not an enforced owner/repository whitelist or clearly implemented commit-message keyword filter. |
| `GET /api/github/getCommitsByRepoAndOwner/:owner/:repo` | Provider commit JSON forwarded; no caller-controlled pagination interface. |
| `GET /api/url` | Returns `{ error, message, data }` for all stored URLs, including failure envelopes under 200. |
| `POST /api/url/create` | Creates/reuses a record; always 200 on successful handling, invalid URL produces 500. |
| `GET /api/url/:short_url` | Returns a stored document, not a redirect. Missing/cast/query failures become 500 with an error string. |
| `DELETE /api/url/delete/:short_url` | Deletes a matching record; absent record becomes 200 `null`, despite documentation claiming an error. |
| `GET /api/gemini/getFromText?prompt=...` | Truthiness check, provider generation, string served as HTML. |
| `GET /api/gemini/getChatFromText/:prompt` | Mutates session history and invokes a billable generation through GET. |
| `POST /api/gemini/getFromImage` | Multipart generation; prompt is required in implementation despite optional documentation. |

The paths are predominantly action/RPC style rather than resource REST: `getCommits`, `getFromText`, `/url/create`, `/url/delete`. There is no API version namespace. This is manageable for existing clients; rename/version only alongside a deliberate compatibility plan.

Validation is ad hoc: presence/truthiness for prompts, hostname extraction for URLs, Mongoose casting for numeric short codes, and no GitHub parameter schema. No consistent type, length, scheme, range, or unknown-field policy exists. `validateUrl('ftp://example.com/file')` returns a hostname, so it is not an HTTP(S)-only validator.

Responses have no common success DTO or error contract. Raw documents may contain `_id`/`__v`; GitHub search returns an object while repository commits return an array. Generated text is not explicitly marked `text/plain`. There are no request IDs, declared sorting policies, API list pagination, transaction boundaries, or robust idempotency keys.

Documentation is partially centralized but not executable. `routes/docs.js`, route JSDoc, README, and test-only registrations can disagree. Examples: metadata says invalid URLs return 400, the controller returns 500; metadata calls URL lists arrays, the service returns an envelope; deletion of an absent record returns `null`; optional image prompt is mandatory; a missing chat path segment hits the real server's 200 HTML fallback rather than the standalone test app's 404.

## Data Access Architecture

`UrlModel` defines `original_url: String`, `short_url: Number`, and `creation_date: Date` (`api/models/UrlModel.js:5-11`). There are no schema-level required rules, URL validation, owner fields, TTL indexes, or declared secondary/unique indexes. MongoDB's normal `_id` index still exists; actual database-created indexes were not inspected.

UrlShortenerService uses `find`, `findOne`, `create`, and `findOneAndDelete` directly. Queries are simple and use fixed field names; there is no controller-direct database access. There is also no projection, `lean`, explicit sort/limit, or separation of repository errors from application outcomes.

### Confirmed short-code defect

`hashCode` returns `Math.abs(hash % 10000)` (`api/utils/index.js:13`), yielding at most 10,000 codes. Both `https://example.com/782` and `https://example.com/1000` produce `9376` in the real function. A local stubbed-model probe showed `getShortUrl(second)` returning a record whose `original_url` was the first URL. The controller treats this as successful reuse.

This is a demonstrated incorrect lookup, not proof that production records currently contain collisions. Simultaneous creates can additionally race between lookup and insert; the schema has no uniqueness constraint. Single-document writes are atomic individually, but the multi-operation creation workflow is not. No transaction is used, and a transaction alone would not supply the missing uniqueness policy.

A compatible repair should first inventory existing records/indexes, resolve ambiguous duplicates explicitly, preserve old codes, and introduce a larger allocation space plus database-enforced constraints. Decide whether reuse is global or owner-scoped before adding an `original_url` unique index. Define normalization deliberately; do not silently collapse URLs whose query/path distinctions matter.

## Authentication & Authorization

No authentication middleware, account model, JWT verification, API key check, login flow, or route permission check exists in the reviewed first-party application. `express-session` stores Gemini conversation history; it does not establish a user identity. OAuth-like variables in `.env.example` are not evidence of implemented OAuth.

URL records have no owner. Listing, creation, lookup, and deletion are globally reachable at the application layer. An unauthenticated DELETE probe reached a mocked deletion operation and received 200. Whether an external gateway prevents public access is unknown and must not be inferred from the README deployment URL.

If URL lookup is intended to be public, that does not imply public enumeration/deletion should be allowed. A short code is neither an authorization credential nor hard to enumerate with only 10,000 possibilities. Gemini operations similarly have no caller-bound quota or access policy even though they consume provider resources. Decide between owner-only administration, multi-user ownership, and a deliberately anonymous public demo before choosing an authentication mechanism.

## Security Assessment

### Confirmed implementation findings

| ID | Severity / evidence | Consequence and qualification |
| --- | --- | --- |
| S1 | **High:** unguarded URL mutation/listing and AI operations; `api/routes/index.js`; model lacks ownership | Any caller reaching the app can attempt deletion/enumeration and consume provider quota. Production ingress restrictions are unknown. |
| S2 | **High:** generated strings use `res.send(text)`; `GeminiController.js:23,49,87`; `server.js:32` allows inline scripts | Real-router probe returned model markup as `text/html`. If generated content contains executable script, a browser navigation can execute it in this origin. Unsafe output boundary is confirmed; an end-to-end browser exploit was not run. |
| S3 | **High:** locked Multer 1.4.5-lts.1; public upload route; no multipart field-count/parts policy | This version is within the affected range of GHSA-535w-7cp7-47q4, a high-severity crafted-field-name DoS. Applicability is confirmed from version/configuration; no exploit was executed. |
| S4 | **High:** `server.js:49` contains a fixed session signing secret | Secret is present in source and should be replaced/rotated. Knowing the signing secret weakens cookie authenticity; it does not itself reveal a random existing session ID or prove account compromise. Literal is deliberately omitted here. |
| S5 | **High integrity:** hash-only lookup and no uniqueness policy; URL service/model | Different URLs can resolve to the same record, with races/duplicates possible. Demonstrated collision is described above. |
| S6 | **Medium/High availability:** upload cleanup only after successful generation; `GeminiController.js:31-56` | Missing prompt probe retained a new file. Provider failures can also retain files; repeated bounded uploads can consume disk. Individual file size limit is useful but does not cap aggregate disk consumption. |
| S7 | **Medium:** open CORS; `server.js:36`; response header `Access-Control-Allow-Origin: *` | Arbitrary origins can read unauthenticated API responses. This may be acceptable for public reads; it is not access control and does not permit credentialed reads by itself. |
| S8 | **Medium:** no secure/SameSite/maxAge cookie settings; default store; `server.js:48-52` | Probe cookie had only Path and HttpOnly. Session security/retention and cross-origin chat behavior depend on deployment/browser policy. HttpOnly is present and should be retained. |
| S9 | **Medium:** raw error strings forwarded by URL handlers/service; `UrlShortenerController.js:21,51,71,91`; `UrlShortenerService.js` catches | Database validation/cast/operational details can be exposed; list failures leak the message in a 200 envelope. Gemini/GitHub controller catch messages are more conservative. |
| S10 | **Medium:** AI prompts in GET path/query; state-changing chat GET | Prompts can enter browser history, proxy/access logs, analytics, and referrers even though this app has no request logger. GET also allows accidental generation through navigation/prefetch. Actual downstream logging is unverified. |
| S11 | **Low/Medium:** static middleware precedes Helmet/CORS/limiter; `server.js:24` | Static probe had no CSP header. Header protection and rate policy do not uniformly cover every response; root/docs pages do receive later middleware. |

The [Multer maintainer advisory](https://github.com/expressjs/multer/security/advisories/GHSA-535w-7cp7-47q4) covers versions below 2.3.0 and recommends constraining array field indexes. A subsequent [disk-upload advisory](https://github.com/expressjs/multer/security/advisories/GHSA-3pph-fpjx-jg34) covers 2.2.0 through versions below 2.4.0. That later advisory is **not** attributed to the installed 1.x release; it means upgrading only to 2.3.0 is an incomplete present-day migration target. Evaluate a supported release at least 2.4.0 and test upload error/abort behavior. [Maintainer changelog](https://github.com/expressjs/multer/blob/main/CHANGELOG.md).

The default session store is in-process; Express warns that it is unsuitable for production. Its documented cookie defaults align with the local probe. [Session documentation](https://expressjs.com/en/resources/middleware/session/). CORS controls browser response access, not caller authorization. [CORS documentation](https://expressjs.com/en/resources/middleware/cors/).

### Potential risks requiring deeper investigation

- **Uploads:** MIME type is supplied by the client, with no image signature/type policy or image dimension validation. Content rejection/resource limits should be defined; code execution through uploads was not demonstrated. Files are not mounted as static content, and Multer generates server filenames, so arbitrary original-filename path traversal is not established.
- **Injection:** URL validation accepts hostname-bearing schemes and implicit coercion; GitHub parameters are concatenated into path/query strings. Encoded delimiters can change the provider request meaning. Use constrained values plus URL/path encoding. Current MongoDB queries do not directly forward request-supplied filter objects or use `$where`; a NoSQL operator-injection exploit is not established.
- **SSRF:** The shortener stores URLs and does not fetch them. GitHub's request host comes from server configuration, not directly from `original_url`. No straightforward user-controlled arbitrary-host SSRF path was found. Validate configured base origins and redirect policy if the proxy evolves; do not label stored URLs alone as SSRF.
- **CSRF:** No explicit CSRF/origin enforcement exists for session-affecting operations. GET chat mutation and public multipart generation can incur work through browser requests. Exact cross-site session behavior needs testing with the real domain, cookies, and frontend; the larger current issue is lack of authorization at all.
- **Data exposure:** Public URL listing returns all original URLs and raw documents. If callers save URLs containing credentials or private tokens, those contents would also be exposed. Presence of sensitive production records was not checked.
- **Secrets:** `.env` and credential directories are ignored; checked example secret/connection fields are empty. No local secret values were read and no history-wide secret scan was performed. The source session literal is the confirmed secret-handling defect.
- **Dependencies:** Public Multer advisories were verified; a comprehensive npm/transitive and vendored-browser audit remains outstanding. Do not infer that other dependencies are safe from passing lint/tests or recent lockfile versions.
- **Ingress:** TLS termination, WAF/gateway authentication, MongoDB network exposure, database roles, proxy hops, and production rate-limit enforcement require deployment evidence. No internal admin/metrics endpoints were found in source; the public route catalog is intentional documentation, not an internal management API.

## Performance & Scalability

| Supported issue | Evidence | Practical implication |
| --- | --- | --- |
| Unbounded database listing | `UrlShortenerService.getUrlList`: `UrlModel.find()` | Entire collection is loaded, hydrated, and serialized for each request. Add capped pagination, stable ordering, projection, then consider `lean` for reads. |
| Lookup/delete index gap | `findOne({short_url})`, `findOneAndDelete({short_url})`; no schema index | Scans are possible unless a database-side index exists. Inspect actual indexes/query plans before estimating speedup; uniqueness is also an integrity requirement. |
| Repeated create query | Lookup followed by create, repeated hashing | Two operations on the create path and a race window. Atomic allocation/reuse with proper constraints is more valuable than avoiding a small hash computation. |
| Event-loop blocking | `fs.readFileSync` in image conversion and MainController.render | Image I/O/encoding and README read/Markdown rendering happen during requests. Use async bounded file handling; cache repository-owned documentation output. |
| Unbounded chat input/history | `GeminiController.getTextFromChat:62-86` | History grows in memory and is resent per turn; output limit of 1,000 tokens does not limit history or input. Bound history bytes/tokens/turns and active sessions. |
| Provider requests lack concurrency budgets | Generation directly in handlers, no request-level semaphore | One IP window limiter is not a bound on total in-flight provider calls or cost. Add per-caller/global concurrency and spending policy. |
| Missing read cache / upstream pagination | GithubService fetches on every call and ignores pagination links | Repeated identical reads consume quota; API exposes only the provider's initial page. Bounded TTL/ETag caching and a deliberate page/cursor contract can help. |
| State tied to one process | MemoryStore sessions and default limiter store | Restarts lose history/counters; multiple replicas do not share quotas/history. Shared TTL storage is needed before relying on horizontal scaling. |

No N+1 query loop, long transaction, expensive aggregate, or custom pool churn was found. The database connection is a shared Mongoose connection, not opened per request. There is no measured throughput/latency or production query plan, so claims about saturation, pool size, or an existing bottleneck would be speculative.

Multer's cap is 2,000,000 bytes, approximately 2 MB decimal, despite the inline `1MB` comment. Base64 increases payload size and intermediate allocations, but this is not a reason to add a streaming subsystem before measuring. Default JSON/body-parser and multipart-library limits still exist; the code does not explicitly remove every limit, but it lacks a coherent end-to-end resource budget.

Keep interactive generation in the HTTP path initially with deadlines and concurrency limits. Add durable jobs only when measured request duration exceeds hosting/client deadlines or the product needs cancellation, retries, resumable work, or progress polling. A queue now would introduce storage/worker complexity without fixing unsafe output, access policy, or data integrity.

## Reliability & Observability

### Current failure behavior

- GitHub HTTP errors are not checked; transport/JSON errors become `null`. A stubbed 403 response was returned as an ordinary provider JSON object. Callers cannot distinguish outage, quota limit, missing repository, or valid empty results consistently.
- URL service errors are result envelopes. The list controller does not inspect `.error`, so a simulated database exception produced 200 `{ error: true, message: ..., data: null }`. Creation treats lookup failure like not-found, which can trigger an inappropriate write attempt.
- `deleteShortUrl` does not classify a null deleted record as not-found. A real-router probe with a stubbed null result returned 200 `null`.
- The shared handler/fallback render HTML with 200; malformed JSON and an upload above the limit reproduced this. Existing error-handler tests explicitly assert 200, so a correct status change needs deliberate test updates.
- Provider calls have no application deadline/abort handling or bounded retry policy. Native fetch/SDK internals may have defaults; absence of an application budget is the finding, not a claim of infinite library timeouts.
- No circuit breaker is implemented. First add error classification/deadlines and measure failures; a breaker is optional if recurring upstream outages create cascading load. Automatic retries of billable generation require a cost/idempotency decision.

### Startup and shutdown

`server.js:21` starts an asynchronous connect without awaiting it; `:78` begins listening independently. Requests can arrive before database readiness. `db.js:13-14,20-21` exits without reporting the cause on connect/disconnect failure. Mongoose buffering can hide readiness failures until query timeouts.

The close listener calls `mongoDB.disconnect()` without awaiting completion. There are no explicit SIGTERM/SIGINT drain handlers, readiness/liveness endpoints, or listener error handling in application source. A production platform may provide restarts/health routing, but the repository does not implement those guarantees. `HOST` is used only in logs: `app.listen(port)` does not bind to that configured hostname.

### Diagnostics

The only application logging found is the startup message/URL. There are no structured request/error logs, correlation IDs, provider outcome logs, metrics, or tracing instrumentation. A 200 response can mask an incident from status-based monitoring, and silent DB exits remove causal evidence. Generated prompts, image content, URL query tokens, and session cookies must be redacted when logging is added.

Start with request IDs, route templates, duration/status, safe dependency operation/outcome, and redacted exception context. Add readiness and counters for request failures, provider latency/timeouts, DB failures, upload cleanup failures, limiter rejects, and active generation. Full distributed tracing is lower priority for this single service unless dependency latency remains hard to diagnose.

## Testing Architecture

The baseline is **10 Jest suites and 58 passing tests**. Supertest provides useful handler-level HTTP checks; service tests exercise many catch/success branches. However, high coverage reflects mock-driven execution of a narrow instrumented scope, not production assurance.

| Test area | What it establishes | Gap |
| --- | --- | --- |
| MainController | Imports real server; checks root HTML and `/api/` catalog | Only documentation endpoints use actual full composition in the existing suite. |
| URL controllers | Standalone Express app with mocked service | DELETE test path is `/url/:short_url`, while production uses `/api/url/delete/:short_url`; tests cannot catch that drift. |
| URL services | Mongoose methods replaced by `jest.fn` | No real casting, indexes, uniqueness, concurrent creation, persistence, or query plans. |
| UrlModel | `create` is spied on and mocked | Second test reuses the earlier mocked result; its unknown-field assertion does not demonstrate actual schema stripping/database insertion. Mock DB module is separate from `db.js`. |
| GitHub service | Native fetch mocked, validates constructed strings | No non-2xx classification, pagination, timeout/abort, encoding, or provider-contract boundary tests. |
| Gemini controller | Fake model responses, standalone routes/session/upload setup | No real provider/account/model compatibility; chat continuity, budgets, unsafe content type, and failure cleanup are not meaningfully covered. |
| Gemini service | Checks model-object properties/names | Constructing a model object does not prove it exists or is usable remotely. |
| Error handler | Standalone route renders errors | Tests codify HTTP 200 for errors, not a correct API error boundary. |
| Utilities | Checks hash type/determinism and basic URL validity | No collision, scheme/type/length policy, or data-integrity invariant tests. |

`jest.config.js:4-18` covers `api/**/*.js` except mocks, omitting `server.js`, `db.js`, EJS templates, and middleware integration. The chat-initialization branch is explicitly ignored for coverage (`GeminiController.js:61`). Neither a 99% threshold nor the measured 100% ensures coverage of the uninstrumented lifecycle, absent access checks, or real-world invariants.

Testing is coupled to static singletons: URL service methods are destructured at controller import time, global fetch/model methods are monkey-patched, `clearAllMocks` does not restore implementations, and environment values are mutated without a uniform restore pattern. Tests run successfully now, but this makes isolated parallel execution/new failure tests fragile.

The Gemini suite deletes **every file in `uploads/`** during cleanup (`tests/controllers/GeminiController.test.js:61-65`). This assessment ran it only in a disposable copy. Future tests should use a per-suite temporary directory and delete only their own files; do not introduce broader cleanup into retained uploads.

Highest-value missing tests are: unauthenticated/unauthorized operations against actual routers; actual status/content-type and malformed multipart/JSON boundaries; cleanup after missing prompt/provider failure/client abort; two colliding URLs; concurrent identical creates with real indexes; not-found vs DB failure; rate limiting/proxy policy; startup readiness/shutdown; session continuity/TTL/history limits; and safe generated-content serialization. A disposable real MongoDB instance is appropriate for the database subset, isolated from configured production/test databases.

## Dependency & Module Boundaries

Verified application direction:

```text
server -> db, route composition, documentation controller, error middleware
routes -> controllers
GithubController -> GithubService -> fetch + environment
UrlShortenerController -> UrlShortenerService + utils
UrlShortenerService -> UrlModel + utils
UrlModel -> mongoose
GeminiController -> GeminiService + fs + session-bearing HTTP request
GeminiService -> Google SDK + environment
MainController -> route metadata + fs + markdown-it
```

Source import review found no first-party import cycle or cross-feature service calls. Graph call-cycle analysis also reported zero cycles, but that analysis alone is not proof about ESM imports. Dynamic framework/SDK callbacks and deployment dependencies are outside that guarantee.

Healthy boundaries: HTTP request/response objects do not appear in the URL service, database calls are not directly in controllers, GitHub transport is isolated, and features are small. Problematic boundaries:

- GeminiController performs infrastructure work and application orchestration; replacing providers or testing cleanup means touching HTTP logic.
- UrlShortenerService mixes allocation policy and persistence and communicates infrastructure errors as untyped strings/result envelopes.
- Controller-level find-or-create makes domain invariants easy to bypass through direct service calls and hard to test atomically.
- Repeated environment loading and SDK construction at import time make configuration and composition implicit.
- Documentation controller imports a routes-folder data module. This is not a harmful cycle, but metadata should remain passive data and never import runtime routing.
- `api/mocks` contains test-only code, including `jest.fn` and a CommonJS `exports` fixture in an ESM project. No active application import uses it; keep test scaffolding out of deployable application responsibilities.

A small app factory and explicit service/client/repository parameters at composition time would create useful test seams. Introduce a URL-specific repository only when extracting the corrected allocation use case; do not build generic repositories or interfaces for every simple helper.

## Inconsistencies / Technical Debt

| Issue | Evidence / consequence |
| --- | --- |
| CI branch/runtime drift | Workflow runs on `master` and Node 18.19.0; current checkout is `main`, engines specify Node 24.x/npm 11.x. A push/PR to main is not covered by those triggers. Hosted checks/branch rules were not inspected. |
| Environment split | Custom `ENV` controls DB selection/error detail; framework production behavior commonly uses `NODE_ENV`; no startup validation synchronizes them. A wrongly set ENV can select the wrong database/error detail. |
| Incomplete/stale example | `.env.example` lacks `GOOGLEAI_API_KEY`, includes unused OAuth/OpenAI fields, and supplies defaults independently from code. |
| False error status | Template status local is not transport status; controller envelopes sometimes signal errors under 200. |
| Documentation drift | URL validation/list/delete responses and image prompt policy disagree across catalog, route JSDoc, and implementation. |
| Search semantics ambiguity | `q=repo/<word>` does not encode the documented commit-message search intent or enforce a configured repo scope. Provider behavior needs a contract fixture/live confirmation. |
| Route test duplication | Test apps repeat registrations instead of exercising actual routers; deletion path differs. |
| Upload naming/limits | `uploads/` is the runtime destination, but `.gitignore` lists `.uploads/*`; generated uploads can appear as untracked files. Comments call the 2,000,000-byte cap 1 MB. |
| Working-directory coupling | Relative README/static/view/upload paths; starting from another directory can break runtime resources. |
| Stale debug setup | `.vscode/launch.json` references Mocha, nodemon, and `app.js`, unlike Jest, Node watch, and `server.js`. |
| Licensing metadata mismatch | `package.json` says ISC; LICENSE and README identify LGPLv3. Resolve intended licensing with the owner rather than guessing. |
| Optional cleanup | Unused OpenAI dependency/disabled comment, React Babel preset, tracked `.DS_Store`, typo `tests/midleware`, large apparently unused base64 fixture. |

## Existing Golden Path

There is no fully satisfactory security/reliability reference module. The strongest existing **transport/service separation** is `GET /api/github/getCommitsByRepoAndOwner/:owner/:repo`:

1. `api/routes/index.js:60` explicitly registers the endpoint.
2. `GithubController.getCommitsByRepoAndOwner` only reads parameters, delegates, and formats the result.
3. `GithubService.getCommitsByRepoAndOwner` owns the outbound transport and has no Express dependency.
4. Controller and service have separate tests, and endpoint metadata/JSDoc records the intended interface.

This is the best lightweight structural template for a new external integration. Its error swallowing, URL interpolation, lack of deadline/status checks, and raw provider response must be fixed before copying its behavior.

For **persistent business operations**, the URL module is the closest layered reference: controller → service → model. It is the right starting point for a corrected URL allocation use case, but controller-owned lookup/create and hash-only identity prevent treating it as a correctness golden path.

The strongest **documentation/test composition** reference is MainController + `routes/docs.js` + MainController tests: passive metadata serves both HTML and JSON, and tests use the real composed server. Preserve that shared metadata approach while eliminating contract drift and removing listener side effects from test composition.

Gemini is the competing pattern: its service is a model factory, while its controller does most of the work. Align it with the GitHub transport separation by moving generation/chat orchestration to an application service and SDK calls to a client adapter; keep HTTP validation/response handling in the controller and temporary-file ownership explicit.

Preferred golden path going forward: explicit route policy/validation → thin controller → feature use case returning an application result/DTO → focused provider client or repository → centralized safe error/status translation, with real-router contract tests and separate infrastructure tests. Keep the current monolith and migrate one feature at a time.

## Recommended Improvements

Effort estimates are relative implementation scope: **Small** = focused change with regression tests; **Medium** = coordinated feature/configuration work; **Large** = product identity/data migration or substantial integration rollout. They are not calendar commitments. Implementation and rollout require separately agreed scope; no changes below were made during this assessment.

### High Priority

#### H1. Define and enforce mutation and provider access policy

- **Current situation:** URL enumeration/deletion and AI requests are application-public; sessions do not authenticate.
- **Evidence:** `api/routes/index.js`; `UrlModel.js`; unauthenticated real-router delete probe.
- **Why it matters:** Data destruction/disclosure and provider-cost abuse are possible for anyone who reaches the application.
- **Recommended change:** Decide owner-admin versus multi-user versus anonymous demo policy. Protect mutation/listing and paid generation at the route boundary; enforce record ownership where applicable. Keep deliberately public lookup/read routes explicit. Add identity-based quotas and authorization tests.
- **Expected benefit:** Clear trust boundary and accountable usage without requiring a broad IAM system for a single-owner project.
- **Risk of changing it:** Existing anonymous clients may stop working; adding owner fields requires a policy for existing records. Never embed privileged credentials in the public frontend.
- **Effort:** Medium for owner-only administration; Large for a complete multi-user ownership rollout.

#### H2. Make generated-content responses safe

- **Current situation:** Gemini strings are sent as HTML; inline scripts are permitted by CSP.
- **Evidence:** `GeminiController.js:23,49,87`; `server.js:32`; content-type probe.
- **Why it matters:** Untrusted model output can cross a browser execution boundary in the backend origin.
- **Recommended change:** Explicit `text/plain` or a JSON text field; prohibit interpreting provider output as trusted HTML. Add response-type regression tests and appropriate no-store policy for sensitive generation. Remove CSP inline-script allowances if documentation assets do not need them.
- **Expected benefit:** Eliminates this unsafe HTML boundary and reduces prompt/history exposure through caching.
- **Risk of changing it:** Clients currently relying on HTML rendering must change; avoid a response-shape break by using explicit plain text initially.
- **Effort:** Small.

#### H3. Upgrade and bound multipart uploads; guarantee cleanup

- **Current situation:** Vulnerable Multer 1.x; only file byte cap explicitly configured; missing prompt/provider errors retain disk files.
- **Evidence:** Lockfile; `routes/index.js:9-12`; `GeminiController.js:31-56`; S3/S6 and upload probes.
- **Why it matters:** Crafted multipart parsing and aggregate disk consumption can affect availability.
- **Recommended change:** Review a supported Multer release at least 2.4.0 against current advisories; cap fields/parts/field bytes/array indexes, define image signature/type rules, and give each request a private temporary-file owner with cleanup in `finally`. Handle aborts and deletion errors; add admission/concurrency limits before accepting costly work.
- **Expected benefit:** Bounded upload costs, predictable errors, fewer retained files, and removal of the confirmed vulnerable-version exposure.
- **Risk of changing it:** Major-version error/stream semantics and MIME policy can reject existing clients. Cleanup must delete only request-owned paths; any orphan sweep needs a safe age/ownership policy.
- **Effort:** Medium.

#### H4. Repair URL identity and atomic creation

- **Current situation:** 10,000-code hash space, hash-only reuse, no uniqueness, lookup-then-create race.
- **Evidence:** `utils/index.js:3-14`; `UrlShortenerService.js:40-79`; `UrlModel.js`; code-9376 probe.
- **Why it matters:** Wrong URL mappings, duplicates, and incorrect deletion targets undermine data integrity.
- **Recommended change:** Separate original-URL lookup from code allocation; use a larger collision-resistant code space with bounded allocation retry and a unique code index. Decide global/owner reuse and canonicalization, enforce corresponding constraints, and distinguish not-found from DB failure. Inventory/de-duplicate before index creation; preserve legacy code lookups.
- **Expected benefit:** Reliable identity and retry/concurrency semantics with indexed access.
- **Risk of changing it:** Unique indexes fail on existing duplicates; silently rewriting issued codes breaks consumers. Explicit migration/rollback and real-DB concurrency tests are essential.
- **Effort:** Medium; Large if production data contains ambiguous mappings requiring user resolution.

#### H5. Replace source session secret and bound state/cost

- **Current situation:** Literal signing secret, default MemoryStore/cookies, unbounded chat history, process-local quotas.
- **Evidence:** `server.js:38-52`; `GeminiController.js:58-86`; cookie probe.
- **Why it matters:** Weak signing-key management, memory growth, lost conversations on restart/replicas, and inconsistent quotas.
- **Recommended change:** Validated random secret from deployment configuration and an explicit rotation/invalidation plan; secure cookie policy matched to verified TLS/proxy topology. Set session/history/input limits and TTL. Use a shared TTL session/quota store if chat continuity or multiple instances are required; reject overload before provider calls.
- **Expected benefit:** Controlled retention, cost, and state behavior. A MongoDB-backed session store may reuse existing infrastructure; Redis is not automatically required.
- **Risk of changing it:** Rotation can invalidate chats; cookie/proxy mistakes can stop sessions; shared storage adds an availability dependency. A known exposed key should not be retained merely to preserve sessions.
- **Effort:** Medium.

#### H6. Restore truthful HTTP errors and provider outcomes

- **Current situation:** Error/fallback HTML returns 200; service failures often look like success; raw error strings leak.
- **Evidence:** `server.js:61-75`; `errorHandler.js`; URL/GitHub services and controllers; boundary probes.
- **Why it matters:** Clients, caches, retries, monitoring, and incident diagnosis cannot trust transport status.
- **Recommended change:** Separate JSON API errors from HTML docs errors; explicitly set 400/404/413/429/5xx as appropriate and mask internal messages. Standardize known application errors/results, check every service outcome, handle `headersSent`, and distinguish null/not-found. Provider adapters check non-2xx responses and map safe failures with application deadlines/cancellation. Retry bounded idempotent reads selectively; do not blindly retry billable generation.
- **Expected benefit:** Correct client behavior and observable failure signals.
- **Risk of changing it:** Existing clients/tests may depend on 200/null or 500 validation behavior. Characterize and update contracts deliberately; rollout status fixes before unrelated route renaming.
- **Effort:** Medium.

#### H7. Validate configuration and make lifecycle readiness explicit

- **Current situation:** Direct env reads, connect/listen race, silent `process.exit`, no graceful drain/readiness, HOST not used for binding.
- **Evidence:** `server.js:14-21,78-86`; `db.js`; `.env.example`.
- **Why it matters:** Misconfiguration and dependency failures can produce traffic-before-readiness, wrong DB selection, silent exits, or interrupted work.
- **Recommended change:** Load/validate configuration once, parse numeric limits, define ENV/NODE_ENV and database selection, reject production TEST mode, and validate provider base origins. Await required DB readiness before accepting traffic; add safe liveness/readiness, signal-based bounded draining, listener-error handling, and awaited disconnect. Decide actual bind host separately from advertised URL.
- **Expected benefit:** Predictable deployment and failure modes with actionable diagnostics.
- **Risk of changing it:** Fail-fast validation can expose previously tolerated deployment mistakes; readiness must exclude optional providers to avoid outage amplification. Bind changes can cut off traffic.
- **Effort:** Medium.

### Medium Priority

#### M1. Create a testable composition root and verify real boundaries

- **Current situation:** Importing server starts listening; static singleton patches and duplicate test routes replace actual wiring.
- **Evidence:** `server.js:78,88`; controller tests; `UrlModel.test.js`; destructuring in URL controller.
- **Why it matters:** Good coverage currently misses route drift, unsafe content type, concurrency, and lifecycle behavior.
- **Recommended change:** Extract `createApp` without listen/connect side effects; keep production bootstrap explicit. Exercise exported real routers/app with injected fakes, restore global/env changes, isolate upload directories, and add disposable real-MongoDB tests for indexes/atomicity. Include lifecycle and production-mode limiter tests outside the TEST bypass.
- **Expected benefit:** Focused tests can assert architecture and invariants instead of reproducing implementation.
- **Risk of changing it:** Import/mock semantics and shutdown behavior can change; preserve behavior first and keep bootstrap tests.
- **Effort:** Medium.

#### M2. Add minimal structured operational visibility

- **Current situation:** Only startup console messages; catches erase dependency error context.
- **Evidence:** `server.js:80-81`; service/controller catches; `db.js`.
- **Why it matters:** It is difficult to attribute failures to inputs, dependency outages, quota limits, or database readiness.
- **Recommended change:** Request IDs, structured route/status/duration/error logs with redaction; record dependency operation/outcome and cleanup failures. Add small health/metrics surface with appropriate access restrictions, and alert on real error ratios/timeouts. Use route templates rather than prompt-bearing raw URLs in logs.
- **Expected benefit:** Faster incident diagnosis without exposing prompts, images, cookies, or token-bearing URLs.
- **Risk of changing it:** Unredacted logging can create a privacy incident; unbounded metric labels or verbose logs add cost.
- **Effort:** Small for logs/IDs; Medium for metrics/alerts and deployment integration.

#### M3. Bound database reads and expose deliberate pagination

- **Current situation:** Global unbounded URL find; raw hydrated documents; repeated short-code predicates.
- **Evidence:** `UrlShortenerService.js:5-7,21-23,81-83`; model schema.
- **Why it matters:** Collection growth increases memory/latency, and public enumeration compounds disclosure risks.
- **Recommended change:** Apply authorization scope first, then capped page/cursor/limit with stable indexed sort and DTO projection; use `lean` where document behavior is unnecessary. Inspect actual index/query plans and coordinate indexes with H4.
- **Expected benefit:** Predictable payload and database work as records grow.
- **Risk of changing it:** Existing clients expecting a complete list need a transition; unstable sorts can skip/duplicate records across pages.
- **Effort:** Small/Medium.

#### M4. Strengthen the GitHub client contract

- **Current situation:** Parameter interpolation, ambiguous search semantics, no pagination or caching, raw provider payloads.
- **Evidence:** `GithubService.js:5-23`; `routes/docs.js` GitHub group; GitHub tests.
- **Why it matters:** Search scope can diverge from product intent, and repeated identical requests consume upstream quotas.
- **Recommended change:** Define repository/keyword scope, validate owner/repo/query inputs, construct encoded URLs, handle pagination and provider status/limits, and expose a stable response contract. Consider bounded TTL/ETag caching for public commit reads after basic correctness/deadlines are fixed.
- **Expected benefit:** More predictable queries and better quota use without a new integration platform.
- **Risk of changing it:** Corrected search may return different data; caching can show stale results and must respect scope.
- **Effort:** Medium.

#### M5. Move Gemini orchestration behind a provider boundary

- **Current situation:** Controller manages SDK calls/history/file conversion; old SDK/model names are hardcoded.
- **Evidence:** `GeminiController.js`; `GeminiService.js`; Gemini tests; Google library guidance above.
- **Why it matters:** Provider migration, cancellation, budgets, and cleanup are entangled with HTTP behavior.
- **Recommended change:** Feature application service for generate/chat, focused SDK client adapter, explicit history/input/output budgets, and request-owned async file conversion. Configure model identifiers and migrate to the maintained SDK with contract tests plus a separately authorized low-cost live smoke test.
- **Expected benefit:** Easier provider changes and testing, less HTTP-layer coupling.
- **Risk of changing it:** SDK/history/model formats and generation behavior may differ; do not substitute an unverified model or change safety/cost defaults silently.
- **Effort:** Medium.

#### M6. Align CI and developer configuration with the real runtime

- **Current situation:** Workflow master/Node18 vs main/Node24; incomplete env example; stale debugger config.
- **Evidence:** `.github/workflows/node.js.yml`; `package.json`; `.env.example`; `.vscode/launch.json`.
- **Why it matters:** Declared development/production assumptions are not checked by the repository workflow.
- **Recommended change:** Verify remote default branch/check requirements, target supported declared Node/npm versions, run lockfile install/lint/tests, and fix environment/debug setup. Add a dependency review process that respects approval/privacy constraints. Confirm unused dependencies before removing them.
- **Expected benefit:** Reproducible onboarding and relevant CI evidence.
- **Risk of changing it:** Branch-check names can affect protection rules; lockfile install on declared Node may expose incompatibilities.
- **Effort:** Small/Medium.

### Low Priority

#### L1. Consolidate API contracts and evolve naming compatibly

- **Current situation:** Action routes, unversioned API, duplicated/inconsistent documentation.
- **Evidence:** `routes/index.js`, `routes/docs.js`, README, controller tests.
- **Why it matters:** Clients and contributors cannot rely on catalog status/type declarations.
- **Recommended change:** Correct the catalog now and add router/contract consistency tests. Adopt schemas/OpenAPI only if they reduce duplication. Add POST generation and resource-oriented routes alongside compatibility aliases when changing semantics; introduce versioning when a genuine breaking contract is needed.
- **Expected benefit:** Reliable documentation and less copy/paste drift.
- **Risk of changing it:** Premature renaming/versioning breaks clients; GET generation migration needs a deprecation plan.
- **Effort:** Small for documentation; Medium for compatibility API evolution.

#### L2. Reduce repository noise without moving working modules unnecessarily

- **Current situation:** Test fixtures under api, typo directory, large base64 mock, stale comments, tracked OS files, unused packages.
- **Evidence:** `api/mocks/`, `tests/midleware/`, `.DS_Store`, disabled OpenAI wiring, `.gitignore` upload mismatch.
- **Why it matters:** New contributors can confuse deployable code with fixtures and accidentally stage generated files.
- **Recommended change:** Move fixtures only after confirming consumers; fix uploads ignore, stale comments/names, debugger leftovers, and unused dependencies. Keep committed graph artifacts under their intended tooling policy. Consider feature-local folders only as the number of features grows.
- **Expected benefit:** Easier navigation and cleaner diffs without changing runtime architecture.
- **Risk of changing it:** Imports/fixture paths and lockfile churn; preserve uncertain files rather than deleting by appearance.
- **Effort:** Small.

#### L3. Cache static documentation and resolve metadata mismatches

- **Current situation:** README is synchronously read/rendered per root request; package license disagrees with LICENSE/README.
- **Evidence:** `MainController.js:29-31`; `package.json:19`; LICENSE; README.
- **Why it matters:** Small avoidable event-loop work and confusing package metadata.
- **Recommended change:** Cache repository-owned Markdown output with an explicit dev refresh policy; use module-relative resource paths. Ask the owner to settle license intent before correcting metadata; review vendored browser libraries separately.
- **Expected benefit:** More predictable documentation serving/onboarding.
- **Risk of changing it:** Stale development docs, path/deployment differences, and incorrectly changing license intent.
- **Effort:** Small.

## Suggested Target Architecture

Retain a **small layered monolith with explicit feature boundaries**. A preferred request follows:

```text
Validated configuration + bootstrap
  `--> createApp(dependencies)
         `--> shared security, request ID, resource limits
                `--> feature router: caller policy + request schema
                       `--> thin controller: HTTP -> use-case input
                              `--> feature application service
                                     |--> URL repository -> Mongoose -> MongoDB
                                     `--> provider client -> GitHub / Gemini
                              `--> stable DTO -> controller -> JSON/plain text

Typed/known application failures -> centralized JSON status/error boundary
Documentation pages             -> separate HTML presentation/error boundary
Session/history + quotas        -> bounded TTL state, shared only when needed
Logs + health + metrics          -> redacted operational context
```

The repository layer is focused on URL persistence and allocation requirements, not an obligatory generic abstraction. Services own business operations, controllers own HTTP mapping, clients own provider transport, and composition owns environment/lifecycle. Configuration and dependencies may be passed as plain JavaScript objects/functions; TypeScript adoption is optional and not a prerequisite.

Do not force every successful response into one enormous generic envelope. Define stable per-feature DTOs plus a consistent error shape/status policy; preserve legacy shapes while transitioning clients. Keep documentation metadata passive and test it against actual registration. Existing layer folders can support this target before any feature-folder migration.

No new queue, distributed tracing stack, separate microservice, CQRS layer, ORM replacement, or database replacement is justified by current evidence. Shared session/quota storage is a concrete scaling concern; additional infrastructure should follow an agreed continuity/replica requirement.

## Incremental Migration Strategy

| Stage | Scope | Acceptance evidence and rollout control |
| --- | --- | --- |
| 0. Capture contracts and policy | Confirm deployment ingress, caller types, sensitive data, URL ownership/reuse, and existing issued codes. Add characterization tests in isolated environments. | Inventory actual clients/indexes/configuration without exposing credentials. Record intentional changes rather than preserving known defects indefinitely. |
| 1. Contain exposed security boundaries | H1-H3: access policy, safe generated output, patched/bounded upload handling. Correct upload ignore/test cleanup. | Unauthorized-operation tests; generated markup remains plain data; malformed/oversized/aborted uploads cannot leave unbounded files. Coordinate client access/cookie changes. |
| 2. Separate composition and failure contracts | Extract app factory, validated configuration, truthful API errors, deadlines, minimal logs/readiness, and bounded shutdown. | Real-app route/body/error tests; startup readiness and signal drain tests; documented status changes. Small PRs, no unrelated route renames. |
| 3. Repair URL integrity | Explicit use case/repository, larger allocation, uniqueness/reuse policy, bounded listing. | Audit duplicate mappings before unique indexes; real-DB concurrent-create and collision tests; preserve issued legacy codes. Back up data and provide an index/data rollback plan. |
| 4. Bound session/provider behavior | Rotate secret, set cookie/TTL/history policies, caller/global budgets; migrate Gemini behind an adapter; strengthen GitHub client. | Continuity/expiry/concurrency/timeout tests; low-cost authorized provider smoke check. Roll out provider migration independently of URL schema changes. |
| 5. Improve ongoing delivery | Align CI/runtime/branch checks, fixtures/debug setup, contract documentation, and operational alerts. | Declared-runtime lockfile/lint/test run, complete authorized dependency review, API/catalog consistency tests. |
| 6. Scale only against evidence | Shared state if replicas/continuity are needed; caching for repeated reads; durable jobs only for measured long-running/retryable work. | Load tests and production metrics establish need, capacity, limits, and failure behavior before adding infrastructure. |

Each stage should be delivered in reviewable changes with one measurable acceptance target. Security fixes can proceed before folder restructuring; data constraints require preflight against actual data. Preserve external contracts through explicit aliases/adapters where safe, but do not preserve unsafe HTML or anonymous destructive access merely for consistency. This document authorizes no deployment or data migration.

## Open Questions

1. Is this a personal demo, owner-only administration service, or intended multi-user backend? Which routes must remain anonymous/public?
2. Does production ingress provide authentication, rate limiting, TLS, request/body deadlines, or CORS restrictions? What are the trusted proxy hops? None was verified here.
3. What is the actual production branch, deployment trigger, and required CI check set? Does deployed code match this commit/worktree?
4. How many URL records exist, what indexes exist outside the schema, and are duplicate/ambiguous short codes already present? Who owns existing data? Are codes already consumed as public links?
5. Should URL reuse be global or per owner? Are non-HTTP(S) URLs, credential-bearing URLs, or anonymous listing deliberately supported?
6. Which clients depend on current path names, 200/null errors, text/HTML responses, or GET generation? How will breaking semantics be communicated?
7. Are the configured Gemini models currently usable for the actual account? What are provider spend, safety, model lifecycle, timeout, and privacy requirements?
8. Must chat survive restart or multiple replicas? What history retention/size and deletion policy is acceptable? Are concurrent turns in one session expected?
9. What is the hosting disk lifecycle and size? Are retained uploads legitimate user data, and which paths can safely be deleted? Filesystem cleanup requires ownership-aware policy.
10. What does GitHub keyword search actually need to search, and which repositories/owners should be allowed? Is upstream authentication needed for quota?
11. What are measured request volume, p95 latency, provider durations, collection sizes, and failure rates? No performance or pool tuning recommendation should be treated as measured capacity evidence.
12. Can a complete registry-backed dependency audit be authorized, or should dependency review remain restricted to public advisories/local metadata? Transitive and vendored-browser vulnerability coverage remains incomplete.
13. Is ISC or LGPLv3 the intended project license? The repository owner should resolve the mismatch.

The immediate target is a safe, bounded, observable version of the architecture already present: thin HTTP handlers, cohesive feature operations, explicit infrastructure boundaries, and tested contracts. The evidence supports incremental correction, not a rebuild.
