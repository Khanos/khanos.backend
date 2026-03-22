# AGENTS.md

This file contains guidelines for AI coding agents working in this repository.

## Build / Lint / Test Commands

- **Start server**: `npm start`
- **Development server** (with auto-reload): `npm run dev`
- **Run all tests** (with coverage): `npm test`
- **Run a single test file**: `npm test -- path/to/test.test.js`
- **Run a single test by name**: `npm test -- -t "test name"`
- **Run tests in watch mode**: `npm run test:watch`
- **Lint entire codebase**: `npm run lint`
- **Lint a specific file**: `./node_modules/eslint/bin/eslint.js path/to/file.js`

**Note**: The environment variable `TEST=true` is set automatically when running `npm test`.

## Environment Variables

- The project uses a `.env` file (not committed) for configuration.
- Required variables: `CONNECTION_URL`, `DB_NAME`, `TEST_DB_NAME`, `PORT`, `HOST`, `ENV`.
- Optional variables: `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` (defaults to 15 minutes and 100 requests).
- For local development, copy `.env.example` to `.env` and fill in values.
- `TEST=true` triggers test mode (server listens on a random port, database connection skipped; rate limiting is disabled).

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
├── db.js               # MongoDB connection setup
├── server.js           # Express app and server startup
└── package.json        # Dependencies and scripts
```

## Code Style Guidelines

### Module System
- Use ES modules (`import`/`export`) throughout the project.
- File extensions are `.js`; no need for `.mjs` or `.cjs`.
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
- Controllers should catch errors and return appropriate HTTP status codes.
- Use try/catch blocks in async functions.
- Return generic error messages in production (status 503 with a warning).
- Log errors to the console for debugging (not implemented yet).

### Imports
- Use default exports for main module (controller, service, model).
- Use named imports for utilities (e.g., `{ Router }` from `'express'`).
- Avoid wildcard imports.

### API Design
- RESTful routes; keep controllers thin.
- Validate request parameters early in the controller.
- Use middleware for cross‑cutting concerns (auth, logging, etc.).

### Testing
- Use Jest with `supertest` for HTTP endpoint tests.
- Mock external services (e.g., GeminiService, OpenAI) using `jest.mock`.
- Clean up test artifacts (e.g., uploaded files) in `afterAll`.
- Each test should be independent; avoid shared state.
- Test coverage threshold is set to 99% (see `jest.config.js`).

### Database
- Use Mongoose for MongoDB interactions.
- Define schemas in `api/models/` and export the model.
- Use async/await for database operations.

### Security
- Never commit secrets; use `.env` files and load them via `dotenv`.
- Use `helmet` and `cors` middleware in production.
- Use `express-rate-limit` to protect against brute‑force attacks (disabled when `TEST=true`).
- Validate and sanitize user input to prevent injection attacks.
- Rate limiting configuration via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` environment variables.

### Debugging
- Use `console.log` for debugging (no logging framework configured).
- In production, errors are logged but messages are generic for security.

### Linting
- The project uses ESLint with `eslint:recommended` and `plugin:jest/recommended`.
- Linting runs automatically in CI; ensure no errors before committing.
- Use `npm run lint` to check the entire codebase.
- The parser is `@babel/eslint-parser` with Babel preset for ES modules.
- No custom rules are configured; rely on ESLint defaults.

### Commit Conventions
- Write clear, concise commit messages.
- Use imperative mood (e.g., "Add feature" not "Added feature").
- Reference issue numbers when relevant (e.g., "Fix #123").
- Keep commits focused on a single change.

## Additional Notes
- No Cursor or Copilot rules found in this repository.
- The project uses Node v24.13.0 and npm 11.6.2.
- Babel is used for Jest transformations (see `jest.config.js`).
- When adding new dependencies, ensure they are compatible with ES modules.
- Keep controllers thin; move business logic to services.
- Use the existing middleware pattern for new cross‑cutting concerns.
- The `TEST` environment variable is set to `true` during test runs, which skips database connection and uses a random port.
- Test files are placed in a parallel `tests/` directory mirroring the `api/` structure.
- Each test should mock external dependencies to isolate the unit under test.