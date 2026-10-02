# Backend architecture implementation

Date: 2026-10-02. Repository: `khanos.backend`. Review branch:
`fix/backend-architecture-hardening`. Implementation was validated locally before the
owner separately authorized a branch, commit and pull request. No deployment,
production-data operation or registry audit upload was performed.
The original assessment is preserved as historical evidence. Existing initialization and
Gemini-retirement changes remain; Google generation/uploads/sessions were not restored.

## Reconciliation and agreed decisions

At implementation start H1/H4/H6/H7, M1-M4/M6 and L1-L3 remained applicable and pending.
Gemini retirement had already removed the functionality underlying H2/H3/H5/M5; those
recommendations are obsolete, apart from independently applicable CSP/ignore cleanup.
The owner explicitly chose owner-only URL create/list/delete, public lookup, global exact
original-URL reuse, public GitHub commit-message search, and LGPLv3 metadata.
No account model, owner fields, generic repository or new infrastructure was introduced.
The Express/Mongoose layered monolith and existing public paths remain.

Graph-first discovery used project `home-epi-Work-khanos.backend`, Tier 2, generation
`2026-09-08T09:21:04Z`. Traces/snippets exposed the old URL flow. Exact-path coverage checks
reported changed/untracked metadata and an excluded debugger file; affected source/config,
tests and templates were read directly. Graph freshness was not treated as current-source proof.

## Recommendation status

| ID | State | Implemented result / remaining boundary |
| --- | --- | --- |
| H1 | Implemented | Route-boundary owner bearer authorization for create/list/delete; lookup/GitHub stay public. Timing-safe digest comparison, synthetic authorization tests. Deployment must provision/rotate the credential on trusted server clients over TLS. No multi-user model is needed under the agreed policy. |
| H2 | Obsolete | Generated output no longer exists. Remaining general CSP issue addressed: inline scripts are no longer allowed; local documentation scripts remain. |
| H3 | Obsolete | No SDK/Multer/upload routes or upload persistence. Legacy multipart requests return 410 before body parsing. Retained historical uploads are not deleted. |
| H4 | Implemented; migration pending | Cohesive exact-URL find-or-create operation, random numeric 47-bit codes, five allocation attempts, two declared uniqueness indexes, explicit startup index checks, preserved numeric legacy lookup. Real MongoDB collision/concurrency tests. Read-only preflight and authorized migration/rollback procedure provided. Existing production duplicates/invalid records are unknown and block migration until explicitly resolved. |
| H5 | Obsolete | No sessions/signing secret/chat history/cookies remain. No session store or paid-generation quota system was added. |
| H6 | Implemented | Safe shared JSON errors with real statuses; separate HTML docs errors; parser/size/encoding/404 handling, sanitized forwarding after headers, database absence versus failure, classified GitHub outcomes and deadlines. Success shapes retained where practical. |
| H7 | Implemented | Pure configuration parsing and one explicit dotenv load; parsed/ranged numbers, ENV/NODE_ENV agreement, explicit DB/bind/test behavior, production TEST rejection, DB/index readiness before listen, health routes, bounded signal drain plus awaited owned-connection close, safe startup/listener failures. Actual production ingress/readiness behavior still requires rollout verification. |
| M1 | Implemented | Side-effect-free app factory and plain service injection; tests exercise actual app/router. Root config/lifecycle tests, isolated HTTP upstream and an owned temporary MongoDB process test real boundaries. Coverage thresholds unchanged. |
| M2 | Implemented baseline; optional work deferred | Generated request IDs; structured allowlisted request/status/duration and correlated dependency logs. Raw URLs, search text, headers/cookies/tokens/provider bodies/private exception text excluded. Health endpoints provide initial evidence. Metrics/alerts deferred until operational requirements and measured traffic justify them; no unauthenticated metrics/admin endpoint added. |
| M3 | Implemented | Owner-only list with default 25/max 100, stable _id cursor, projection/lean, retained envelope plus pagination. Isolated DB verifies page traversal and indexed query execution. Production query plans/latency remain unmeasured. |
| M4 | Implemented baseline; caching deferred | Agreed public commit-message phrase semantics; validated/encoded query/path parameters, explicit page/per_page, checked status/payload kind, deadline/caller cancellation, at most two transient idempotent read attempts. Search object and repo array shapes retained. TTL/ETag caching needs access-pattern/freshness evidence. Two anonymous live default-GitHub probes passed; deployment-specific quotas and provider behavior still need verification. |
| M5 | Obsolete | Gemini orchestration/provider migration would undo retirement and is not applicable. |
| M6 | Implemented; hosted verification pending | GitHub read-only API verified default main, no active rulesets and main unprotected. CI covers main/master, retains job build, checks Node 24/npm 11, no-audit lock install, checksum-pinned MongoDB, lint/full tests. Env/debug setup corrected. No protection/deployment changes. Full transitive/vendored dependency audit remains deferred under the no-metadata-export constraint. |
| L1 | Implemented | Catalog/README/JSDoc agree with actual contracts; real-app test exercises every catalog method/path. Paths and Gemini 410 shape preserved. New versioned/resource aliases/OpenAPI deferred because no concrete client need justifies them. |
| L2 | Implemented targeted cleanup | Confirmed unused OpenAI and React Babel preset removed with offline lockfile update; no active consumers found in current runtime/tests/config. Generated uploads/env/OS ignore rules corrected while preserving legacy ignore rules; middleware test directory typo fixed. Existing unused fixtures, tracked OS files, uncertain uploads and graph artifacts preserved; broad fixture/feature moves deferred without a maintenance benefit. |
| L3 | Implemented | Cached repository-owned Markdown, module-relative views/static/README/config paths; restart/watch refresh policy. Package/lock license metadata aligned to owner-approved LGPL-3.0-only; LICENSE unchanged. Vendored browser-library audit remains separate. |

Security findings: S1 implemented via H1; S5 via H4 (data rollout pending); S9 via H6;
S11 via security middleware before static resources. S2/S3/S4/S6/S8/S10 are obsolete after
retirement. S7 remains conditional: wildcard non-credentialed CORS is retained for public
reads; CORS does not authorize privileged operations. Restricting allowed frontend origins,
trusted proxy hops, TLS/network/database roles, distributed rate limits or replicas requires
verified deployment requirements. Session/cost/history/worker/queue recommendations are
obsolete or unjustified; no capacity claims or speculative infrastructure were added.

## Intentional compatibility changes

- Owner authorization is now required for URL create/list/delete (401 when missing/invalid).
- Invalid inputs/JSON/path encoding return 400, oversized bodies 413, unsupported encoding 415,
  absent URL/routes 404, DB failures 503; GitHub failures no longer return 200/null or raw errors.
  Shared API errors add stable code/requestId fields; docs retain separate HTML presentation.
- URL lists are capped/cursor-paginated and retain their envelope plus pagination. Documents
  omit __v, retaining _id/original_url/short_url/creation_date. Existing safe numeric codes and
  all public paths are preserved; new codes remain numeric but use the larger random space.
- URL input is HTTP(S), typed/length bounded, without embedded credentials/whitespace/control
  bytes. Numeric code strings must be canonical. Reuse is exact, without canonicalization.
- GitHub q=repo/<word> becomes public message phrase search; explicit paging replaces implicit
  environment-dependent page size. Quote/backslash/control syntax is rejected as search text.
- Production startup now fails until configuration and required uniqueness indexes are ready.
  HOST is retired in favor of actual BIND_HOST; default wildcard bind preserves former behavior.
  Import app.js for tests; server.js is explicit bootstrap. TEST cannot start a server.

## Validation

- `npm test -- --runInBand`: **12 suites, 177 tests passed** on Node **24.19.0** /
  npm **11.19.0**, including real-router authorization/parser/status/catalog/retirement,
  owned MongoDB collision/unique-index/concurrency/pagination/index-readiness tests,
  native loopback fetch timeout/body-timeout/encoding/status tests and graceful lifecycle.
- API coverage: **100% statements/branches/functions/lines**; original 99% global gate
  and coverage scope unchanged. Configuration/lifecycle also have explicit root-level tests.
- `npm run lint` and `git diff --check`: passed with the declared Node 24 runtime.
- MongoDB **8.0.16** binary verified against its published SHA-256; tests own their
  process/loopback port/data directory and never use configured databases.
- Clean Node 24 `npm ci --ignore-scripts --no-audit --no-fund` in a disposable `/tmp`
  directory: passed (615 packages). Initial offline attempt lacked an uncached package;
  authorized package downloads succeeded without audit uploads. Install scripts were
  deliberately not executed; hosted CI's full installation/execution remains unverified.
- Lockfile declarations/license checked; Google SDK, Multer, sessions, unused OpenAI and
  React preset are absent. The original assessment and prior retirement remain intact.
- Two bounded **anonymous live GitHub** adapter reads (public message search and public
  repository commits, one item each) succeeded with the expected search-object/array
  shapes. No commit content, URL, credential or query text was logged. These probes
  establish default public-provider compatibility at this time, not production quota/SLA.
- Read-only GitHub metadata confirmed default `main`, no active rulesets, and unprotected
  main. No protection/deployment operations occurred; publishing the review branch and
  pull request was authorized separately after implementation.

The default shell initially used Node 26.7.0; final checks explicitly selected Node 24.
The sandbox denied local sockets; authorized reruns used only isolated test listeners.
No npm audit/third-party audit upload or production DB access was performed.

## Rollout and remaining verification

Follow `docs/url-integrity-migration.md` only after separate authorization: privately inspect
an authorized read-only preflight, back up and quiesce all writers, resolve any duplicate/
invalid-record policy explicitly, create the named unique indexes, then provision the owner
credential and update privileged clients/configuration before deployment. Startup never builds
indexes, removes duplicates or rewrites codes. Credential rotation replaces the secret and
restarts the process; update trusted clients together, since the previous credential stops
working immediately. Preserve indexes when rolling back if possible; old hash allocation
is unsafe and can fail against the new constraints.

Remaining gaps: unknown production data/indexes/query plans and ingress/replica policy;
hosted CI execution; production GitHub origin/quotas/rate-limit behavior; measured
traffic/freshness/alerting needs; comprehensive dependency/vendored-browser review. All initial
product decisions above were answered. A specific conflict/alias decision is required only if
preflight finds duplicates; it is not asserted that production contains them. The assessment
is not declared entirely resolved or production-ready by local tests.
