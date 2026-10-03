# AGENTS.md

This file contains guidelines for AI coding agents working in this repository.

## Project Context and Discovery

- This is a JavaScript Express 5/Mongoose backend for GitHub commit queries
  URL shortening and bilingual blog storage, with EJS documentation pages.
- Use npm and preserve `package-lock.json`. `package.json` specifies Node 24.x
  and npm 11.x. There is no build script; the server runs JavaScript directly.
- Start with the parent workspace guidance and `../questlog/INDEX.md` for related
  handoffs. Preserve existing architecture and keep changes scoped to the task.
- Graph project: `home-epi-Work-khanos.backend`. Confirm it with `list_projects`
  or `index_status`; prefer `search_graph`, `trace_path`, and `get_code_snippet`
  for structural discovery. Check coverage for every relied-on path and read
  source directly for partial, stale, excluded, or untracked paths, including EJS
  templates. Graph coverage is best-effort, not proof of completeness.
- Use `rg` for literals, configuration, non-code files, and graph gaps.

## Build / Lint / Test Commands

- **Install dependencies from the lockfile**: `npm ci`
- **Start server**: `npm start`
- **Development server** (with auto-reload): `npm run dev`
- **Run all tests** (with coverage): `npm test`
- **Run a single test file**: `npm test -- path/to/test.test.js`
- **Run a single test by name**: `npm test -- -t "test name"`
- **Run tests in watch mode**: `npm run test:watch`
- **Lint entire codebase**: `npm run lint`
- **Lint a specific file**: `./node_modules/eslint/bin/eslint.js path/to/file.js`

**Note**: The environment variable `TEST=true` is set automatically when running `npm test`.

For focused iteration without applying the full-suite coverage threshold:

```sh
TEST=true NODE_OPTIONS=--experimental-vm-modules ./node_modules/.bin/jest --runTestsByPath tests/controllers/MainController.test.js --runInBand --coverage=false
```

Resources and configuration use module-relative paths. Run npm commands from the repository root. For code changes,
run relevant tests, then `npm run lint` and `npm test` before claiming full
validation. Documentation-only changes normally need `git diff --check`.

## Environment Variables

- `server.js` calls `loadConfig` once; app factories/tests use pure `parseConfig` objects.
- `NODE_ENV` is authoritative; optional legacy `ENV` must agree. Production selects
  `DB_NAME`; development selects `TEST_DB_NAME`, without fallback. `CONNECTION_URL`
  must use MongoDB's URI scheme. No credentials or environment values go in logs.
- Required `OWNER_API_TOKEN` protects URL create/list/delete and blog POST/PATCH/DELETE at the route boundary.
  Lookup and GitHub reads remain public. Global reuse compares the exact original URL.
  Keep the random token in deployment secrets/trusted server clients, never the frontend.
- `BIND_HOST` (default `0.0.0.0`) is passed to listen. `HOST` is retired. `PORT` defaults
  to 3000. Numeric rate/deadline configuration is parsed and range checked.
- `GITHUB_API_URL` must be an HTTPS base URL ending in `/`; no embedded credentials,
  query or fragment. `GITHUB_TIMEOUT_MS` bounds retries/body consumption together.
- `TEST=true` disables the limiter in app-factory tests. Production test mode is
  forbidden; `npm start` refuses TEST bypass rather than opening a test listener.
- Start from `.env.example`. Startup verifies required unique URL and blog-slug indexes but does not
  create them. Read `docs/url-integrity-migration.md` for URL changes and `docs/blog.md` for the
  explicit blog import/rollout. Import the blog index before restarting this release.

## Project Structure

```
├── api/
│   ├── controllers/    # Express route handlers (thin, delegate to services)
│   ├── middlewares/     # Custom Express middleware (error handling, auth, etc.)
│   ├── mocks/          # Mock data for testing
│   ├── models/         # Mongoose schemas and models
│   ├── routes/         # Express router definitions
│   ├── services/       # Business logic and external API calls
│   └── utils/          # Helper functions
├── tests/              # Jest test suites (mirrors api/ structure)
├── views/              # EJS templates (for server-rendered pages)
├── public/             # Static assets (CSS, JS, images)
├── app.js              # Side-effect-free app composition
├── config.js           # Pure parsing and explicit dotenv loading
├── lifecycle.js        # Readiness, listen and bounded shutdown
├── db.js               # MongoDB connection/index-readiness checks
├── server.js           # Explicit production bootstrap
└── package.json        # Dependencies and scripts
```

## Runtime and API Documentation

- Import `createApp` from `app.js` for HTTP tests. It never connects or listens; Supertest
  owns its test listener. `server.js` is the explicit production entry point.
- `api/routes/index.js` composes the actual router from plain service objects; tests use
  this wiring through the app factory rather than duplicating registrations.
- `api/routes/docs.js` is passive metadata shared by HTML and `GET /api/`. Keep metadata,
  route JSDoc, README and real-router contracts consistent. README rendering is cached
  per process; restart/Node watch refreshes it.
- Express 5 forwards rejected async controller promises. Known application failures use
  `ApiError`; the shared boundary returns safe JSON `{ error, code, requestId }` for API
  paths and separate HTML for documentation paths. Never forward/log private exceptions.
- Success shapes stay feature-specific. Listing is owner-only and cursor-paginated;
  projections retain `_id`, `original_url`, `short_url`, `creation_date` and omit `__v`.
- Google Gemini remains retired: `/api/gemini` and descendants return 410 JSON before
  body parsing, and are absent from the active catalog. No SDK, uploads or sessions.
- OpenAI remains unexposed; its confirmed unused dependency was removed.

## Code Style Guidelines

### Module System
- Use ES modules (`import`/`export`) for application code; `.cjs` tool configs use CommonJS.
- Application file extensions are `.js`; preserve existing `.cjs` tool configs.
- Import order: third-party modules first, then local modules (separated by a blank line).

### Formatting
- No formatter is configured; follow the existing code style.
- Use 2 spaces for indentation.
- Use single quotes for strings.
- Place opening braces on the same line as the statement.
- Add a space after keywords (`if (`, `catch (`).
- Use semicolons at the end of statements (optional but consistent).

### Naming Conventions
- **Variables, functions, parameters**: `camelCase`
- **Classes, models, components**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **File names**: `PascalCase.js` for controllers, services, models; `camelCase.js` for utilities.
- **Test files**: `*.test.js` placed in a parallel `tests/` directory.

### Types
- No TypeScript; use JSDoc comments for complex objects when needed.
- Use descriptive variable names; avoid abbreviations.

### Error Handling
- Thin async controllers delegate failures to Express 5 and the centralized boundary.
- Services classify dependency failures with safe application errors.
- Preserve documented success shapes; document intentional status/contract changes.
- Do not expose credentials or provider details through error messages or logs.

### Imports
- Use default exports for main module (controller, service, model).
- Use named imports for utilities (e.g., `{ Router }` from `'express'`).
- Avoid wildcard imports.

### API Design
- RESTful routes; keep controllers thin.
- Validate request parameters early in the controller.
- Use middleware for cross‑cutting concerns (auth, logging, etc.).

### Testing

- Use Jest/Supertest against the actual app/router. Native ESM is retained; npm scripts
  set `NODE_OPTIONS=--experimental-vm-modules` for Jest 29, and mock-using tests import
  `jest` from `@jest/globals`. Babel preserves ESM.
- Restore spies/global/environment changes. Use synthetic credentials and safe fixtures.
- Coverage remains 99% globally for statements, branches, functions and lines over
  `api/**/*.js`, excluding the pre-existing mocks. Do not lower or bypass the full gate.
- Database tests require MongoDB 8 (`mongod` in PATH or `MONGOD_BIN`). They launch their
  own loopback process and temporary directory, never configured production/test DBs.
  Missing MongoDB is a failure, not a silently skipped constraint test.
- Tests cover real routing/status/content types, owner boundaries, collision/concurrent
  creation with real indexes, pagination, GitHub failure/cancellation/encoding, lifecycle,
  and continued Gemini retirement. Root configuration/lifecycle are tested explicitly
  even though the historical coverage scope remains API-only.
- Local mocked/isolated verification does not prove live GitHub, production data or
  ingress behavior, or hosted CI. State these boundaries accurately.

### Database
- Use Mongoose for MongoDB interactions.
- Define schemas in `api/models/` and use async/await.
- URL uniqueness is mandatory, with auto-index/auto-create disabled. Startup only checks
  indexes; any index/data migration needs separate authorization and a read-only preflight.
- Never silently delete duplicates or rewrite issued codes.

### Blog
- Blog follows controller → service factory → Mongoose model, matching existing URL layers.
- `blogposts` stores Markdown source, language-prefixed unique slug, explicit status and UTC dates.
- Public reads expose only published, non-future posts; full bodies are excluded from lists.
- Input allowlists reject Mongo operators/server-owned fields. Writes reuse owner bearer auth.
- `npm run blog:check` validates 12 preserved originals; `npm run blog:import` defaults to
  read-only preflight. `--apply` uses explicit migration target env vars. No overwrite/delete.
- Original MDX is converted by a restricted snapshot converter, never evaluated. Frontend
  sanitizes the portable Markdown/HTML. Assets live in `public/blog-assets/images`.
- Keep route metadata, docs and frontend `src/types/blog.ts` response contract consistent.
- Tests use owned disposable MongoDB, never configured databases. Production rollout is separate.

### Security
- Never commit secrets; use `.env` files and load them via `dotenv`.
- Use `helmet` and `cors` middleware in production.
- Use `express-rate-limit` to protect against brute‑force attacks (disabled when `TEST=true`).
- Validate and sanitize user input to prevent injection attacks.
- Rate limiting configuration via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` environment variables.

### Debugging
- Use the structured allowlisted logger and request IDs. Never log raw URLs, headers,
  original URLs, search text, tokens, exception messages or provider bodies.

### Linting
- The project uses ESLint with `eslint:recommended` and `plugin:jest/recommended`.
- Linting runs automatically in CI; ensure no errors before committing.
- CI targets verified default `main` and retained `master`, checks Node 24/npm 11,
  runs `npm ci --no-audit`, verifies a pinned disposable MongoDB binary, then lint/tests.
  Job name `build` is retained. No deployment/protection changes are authorized.
- Use `npm run lint` to check the entire codebase.
- The parser is `@babel/eslint-parser` with Babel preset for ES modules.
- No custom rules are configured; rely on ESLint defaults.

### Commit Conventions
- Write clear, concise commit messages.
- Use imperative mood (e.g., "Add feature" not "Added feature").
- Reference issue numbers when relevant (e.g., "Fix #123").
- Keep commits focused on a single change.

## Additional Notes
- Use the declared Node 24.x/npm 11.x engines rather than assuming a machine's exact versions.
- Babel is used for Jest transformations (see `jest.config.js`).
- When adding new dependencies, ensure they are compatible with ES modules.
- Keep controllers thin; move business logic to services.
- Use the existing middleware pattern for new cross‑cutting concerns.
- `TEST=true` applies only to app factories; production bootstrap rejects it.
- Test files are placed in a parallel `tests/` directory mirroring the `api/` structure.
- Mock providers for deterministic failure cases; separately prove database constraints
  in the disposable MongoDB suite and native fetch behavior with a loopback upstream.
