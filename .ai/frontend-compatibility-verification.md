# Frontend compatibility verification

Date: 2026-10-02. Result: **not compatible with all existing frontend functionality**.

Verified backend merge `e69ac20` (`origin/main`) and frontend `3e05486`
(`origin/master`). The existing local branch trees exactly match those merged trees;
neither checkout was reset or switched. No application source, production data,
credentials, deployment, commit or remote write was changed during verification.

## Regressions exposed by the backend change

| Finding | Actual result | Source and required follow-up |
| --- | --- | --- |
| URL administration has no owner authentication in the frontend | The actual frontend service wrappers receive `401 UNAUTHORIZED` for list/create/delete. In Chromium, `/url` crashes in both English and Spanish after listing: `response.data` is undefined, then `UrlList` reads its length. | `src/services/index.ts:19-49`, `src/components/url/UrlMain.tsx:37-44`, `src/components/url/UrlList.tsx:43`. Preserve the agreed owner-only boundary and provide authenticated owner access through a trusted server boundary. A public proxy that simply inserts the token would undo that boundary; the token must never be shipped to the browser. Handle failed responses without assigning undefined state. |
| Newly issued codes cannot redirect through the frontend | The backend resolves a seeded valid 15-digit code with HTTP 200. The actual Astro route redirects that same code to `/` without contacting the backend. | `src/pages/[urlid].astro:8` accepts exactly four digits. Accept safe numeric codes in the larger supported range while preserving existing frontend paths. |
| Zero-padded legacy links stop resolving | A stored numeric code 42 requested through `/0042` receives backend `400 INVALID_CODE`; the frontend redirects to `/`. The frontend itself still formats small codes with leading zeros. A stored code 9376 resolves and redirects correctly. | `src/utils/index.ts:11`, `src/components/url/UrlList.tsx:51-54`, `src/pages/[urlid].astro:11`, `src/services/index.ts:12`. Normalize the padded frontend code before backend lookup without changing the issued code or public link. |
| List pagination is not consumed | An authorized real-database request returns 25 of 32 seeded records and a valid next cursor. The frontend wrapper requests only the first page and its types/UI have no pagination contract. This remains a problem after authentication is added. | `src/services/index.ts:19`, `src/types/index.ts:89`, `src/components/url/UrlMain.tsx:37`. Implement bounded page navigation/load-more using the returned cursor. |

The owner-only access policy was explicitly chosen during implementation. Restoring
anonymous URL administration would be a new product/security decision; it is not an
appropriate silent compatibility fix. Restricting backend CORS to the frontend alone
would not supply owner authentication.

## GitHub behavior and existing frontend weaknesses

Normal public commit-message phrase searches render the expected author/repository/card
in both locales against the actual backend router/service and a local HTTP provider fixture.
The provider receives the intended quoted phrase. The success response shape is compatible.

The frontend already leaves stale cards after zero results or upstream failure, exposes no
error state, and interpolates search text into the URL without encoding. These behaviors
were reproduced in both locales: `nomatches` kept the previous card, an upstream 503 became
a safe backend 502 while the previous card remained, and `fix/parser` became a wrong route
and returned 404 without reaching the provider. They follow unchanged code in
`src/components/github/GithubSearch.tsx:17-25` and `src/services/index.ts:7`; they are not
asserted to be regressions newly introduced by PR #25. The old backend also used a single
`:word` path segment and did not provide a reliable success payload on upstream failures.

## Checks actually run

- Node **24.19.0**, pinned pnpm **9.15.9**.
- `pnpm test`: **9 tests passed**.
- `pnpm build`: passed; Astro check reported zero errors/warnings and 12 hints.
  The existing bundle-size warning remains. No dependency/lockfile changes were made.
- `pnpm test:e2e`: **19 tests passed**, covering the existing bilingual homepage,
  article/navigation links, responsive Lab carousel, theme, keyboard and touch behavior.
  This suite blocks external requests and does not cover URL API compatibility.
- A temporary compatibility harness ran the actual frontend service source (TypeScript
  transpilation), Astro redirect route and React islands against the actual backend app,
  a native loopback GitHub fixture and an isolated MongoDB **8.0.16** process with the real
  unique indexes. It used synthetic records and a synthetic owner credential, never
  configured databases. **21 checks: 6 passed, 15 failed**, including repeated locale
  checks and the pre-existing GitHub weaknesses above. Browser checks waited for completed
  requests before checking state. Servers/database were stopped and temporary DB data removed.
- Chromium **153.0.8010.12**, Playwright revision **1243**, downloaded into `/tmp` after the
  required browser was missing. Temporary harness/results are
  `/tmp/khanos-frontend-compatibility.mjs` and
  `/tmp/khanos-frontend-compatibility-results.json`.
- `git diff --check`: passed in both repositories; the frontend working tree remains clean.
- Read-only probes to the frontend's configured Heroku backend `/health/live` and
  `/health/ready` both returned **503 HTML**. Live availability and deployed-code identity
  are therefore unverified. No cause is attributed to the merge without deployment evidence.

Graph discovery used Tier 2 and checked coverage for the runtime/service/template/config
paths. Frontend generation was `2026-10-01T07:07:39Z`; backend generation was
`2026-09-08T09:21:04Z`. Changed/untracked graph evidence was checked directly against source;
current Git trees, rather than stale index metadata, establish the revisions verified here.

The compatibility gate fails. Passing build/unit/homepage tests does not establish working
URL administration or link redirects. Frontend integration work and separately authorized
deployment/configuration/index migration remain necessary before declaring compatibility.

## Follow-up implementation and passing local verification — 2026-10-02

The preceding findings describe the merged pre-fix trees. Authorized implementation now
restores owner administration through an authenticated frontend server boundary, consumes
cursor pagination, supports legacy/padded/large links, and makes GitHub empty/error/encoded
searches usable in both languages. Backend URL responses cannot be cached; the padded
representation resolves the same stored numeric code without any database rewrite.

Final Node 24 checks: backend **184 tests** and lint passed with **100% API coverage** and
the unchanged 99% gate; frontend **31 unit tests**, **29 browser tests** and build passed.
The 29 browser tests include every existing homepage check. Both repositories pass
`git diff --check`. A final actual Astro/backend/native-GitHub/disposable-MongoDB integration
check passed **8 groups**, covering authentication/CSRF, redirects, real pagination,
concurrent creation, deletion, non-2xx/encoding/timeouts, disconnected DB failures and 410
Gemini retirement. The earlier implementation also exercised browser flows against the
actual backend; deterministic committed browser tests keep those regressions covered.

The original first full browser run had one existing navigation/hydration failure while a
build ran concurrently; its isolated retry and final sequential full suite passed without
changing test thresholds. On continuation, missing temporary pnpm/browser caches caused
tooling failures before browser execution; restoring pinned tooling resolved them.
The final build's 22 browser JavaScript files contain neither the synthetic build secrets
nor server-only credential names. Secrets remain blank in the environment example.

Local compatibility now passes the exercised contracts. Production availability, secret
provisioning, existing-data/index readiness and deployed Vercel behavior remain unverified.
See the implementation status and frontend README for the separately authorized rollout.
Temporary harness paths above are historical and may no longer exist after environment
cleanup; durable regression tests are committed in the repositories.
