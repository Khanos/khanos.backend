# Redis cost investigation

Investigated and migrated 2026-11-01. The initial provider research below is
retained for reference; the user selected the existing memory adapter.

## Completed memory cutover

Completed at approximately 07:56 UTC on 2026-11-01:

- Confirmed Heroku formation: one Eco `web.1` dyno, `npm start`, no other process
  types. Deployed slug commit matched the inspected backend source
  `d5edd12070215ddfb311140cceb8fdea0872a628`; its start script runs `node server.js`.
- Changed only `RATE_LIMIT_STORE=memory` and `RATE_LIMIT_SINGLE_PROCESS=true`.
  The API response comparison confirmed no other configuration value changed
  during this switch. Redis remained available until verification passed.
- Verified live/readiness health and API catalog returned 200; unauthenticated
  URL administration and admission returned 401; authenticated synthetic
  admission returned 204. Public blog read returned 200 and a missing numeric
  lookup returned 404, without writing blog or URL records.
- Confirmed live throttling: 20 synthetic preview failure checks succeeded, the
  21st returned 429 with Retry-After 593 seconds. The reserved documentation IP
  isolated this temporary counter from real visitors. Health remained ready.
- Checked the frontend on its canonical `www.epilef.app` hostname: homepage 200,
  owner URL screen 401, numeric resolver 302 without following its destination.
- Confirmed `redis-curly-82529` (`heroku-redis:mini`, $3/month) was attached only to
  this app, then removed it. Final release **v94** succeeded, `web.1` was up,
  the add-on list was empty and `REDIS_URL` was absent. Health, API authorization
  and authenticated admission passed again after removal.

New Redis add-on charges have stopped accruing. Previously accrued prorated
charges remain. MongoDB, application source, proxy policy and owner/admission
credentials were not changed. The unused Heroku-specific TLS setting remains
ignored in memory mode.

This deployment must remain a single backend process. Counters reset on process
restart, deployment or Eco sleep; multiple processes would each maintain separate
counts. If scaling is needed later, configure a shared store first. Returning to
Redis after removal requires provisioning a new service and validating it; the
old Redis instance is no longer available as a rollback target.

## Finding and recommendation

Before this cutover, Redis backed temporary rate-limit counters. These
counters protect public URL lookups, owner URL operations, other API requests,
frontend admission checks, and a shared emergency ceiling. Blog posts and issued
short URL mappings use MongoDB. Replacing the counter store requires no blog or
URL database migration.

**The initial hosted recommendation was Upstash Free.** It supports
the existing native Redis client and Lua operations, preserving shared counters
across backend processes. The existing in-process memory adapter is a simpler
$0 option if production is exactly one Node process and counter resets on
restart/sleep/deploy are acceptable. Aiven Free Valkey is another credible hosted
candidate, especially if Upstash's command allowance is too small.

The supplied bill shows `heroku-redis:mini` at $3/month for 0.830273 months:
$3 × 0.830273 = $2.490819, rounded to $2.49. This is a provisioned add-on fee,
not a fee for the Redis JavaScript dependency. Heroku confirms Mini costs $3/month
and fixed-price add-ons are prorated to the second. Changing code or connection
settings does not remove the paid resource. Removing that resource after cutover
stops future accrual; already accrued charges remain. Sources:
[Heroku pricing](https://www.heroku.com/pricing/),
[add-on billing](https://devcenter.heroku.com/articles/add-ons).

## Current source evidence

The workspace checkout is on `feat/blog-admin-api` at `6de2956`, with pre-existing
AGENTS.md and handoff edits. It predates Redis. I preserved it and inspected a
downloaded, tracked GitHub source snapshot instead:

- Backend `main`: `d5edd12070215ddfb311140cceb8fdea0872a628`, checked live through
  GitHub's API; latest commit dated 2026-10-22.
- Frontend `master`: `31fa2cd0284d56c714d68375b4b4dcedf9baeaa6`, checked live through
  GitHub's API; latest commit dated 2026-10-29.
- During the initial investigation, Heroku CLI login was unavailable, so these
  repository revisions alone did not establish deployed state. After the user
  logged in, the cutover checks above confirmed the backend revision, formation,
  configuration and add-on attachment.

| Source | Observed responsibility |
| --- | --- |
| [rateLimitStore.js](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/rateLimitStore.js) | Existing memory and Redis adapters; Redis atomically runs INCR, first-increment PEXPIRE and PTTL in one EVAL. Keys are hashed and expire. |
| [urlRateLimit.js](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/api/middlewares/urlRateLimit.js) | Emergency counter plus separate anonymous, relay, owner or unrelated API counter. Allowed ordinary requests consume two counters. Store failures return 503. |
| [admission.js](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/api/middlewares/admission.js) | Authenticated frontend checks for aggregate, owner, failed authentication and resolver policies. Windows are 1 minute, or 10 minutes for failures. |
| [frontend rateLimit.ts](https://github.com/Khanos/khanos.frontend/blob/31fa2cd0284d56c714d68375b4b4dcedf9baeaa6/src/server/rateLimit.ts) | Frontend calls backend admission over HTTPS; it does not need Redis credentials. Unavailable admission returns 503. |
| [config.js](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/config.js), [redisConnection.js](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/redisConnection.js), [lifecycle.js](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/lifecycle.js) | Explicit memory/redis selection, one native client per process, TLS settings, bounded startup/recovery/shutdown. Redis failure does not silently select memory. |
| [db.js](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/db.js), [URL model](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/api/models/UrlModel.js), [blog model](https://github.com/Khanos/khanos.backend/blob/d5edd12070215ddfb311140cceb8fdea0872a628/api/models/BlogPostModel.js) | MongoDB owns persistent short URL mappings and blog content. |

Code graph discovery and coverage checks found stale backend generation
2026-09-08 and frontend generation 2026-10-01; relevant files were missing,
changed or untracked relative to those indexes. Conclusions above use direct
source inspection of current GitHub files, not absence of graph matches.

## Free options

| Option | Cost and fit | Material limits |
| --- | --- | --- |
| Existing memory adapter | $0 additional infrastructure; no provider or code rewrite | Exactly one backend Node process. Counters reset on process replacement. Separate processes have separate counts. Bound of 50,000 active entries; capacity errors fail closed. |
| Upstash Free | $0; native TCP/TLS and required Lua/expiry commands | One Free DB, about 250 MB, 500,000 commands/month, 10 GB monthly bandwidth. Free-service inactivity policy applies. |
| Aiven Free Valkey | $0 indefinitely without a card; Redis-compatible protocol and TLS | Single node, 1 CPU, 1 GB RAM with maxmemory at 50%; no SLA. Location/configuration can change and inactive services may be powered off. |
| Redis Cloud Free | Not recommended for this public Heroku connection | Its specific TLS documentation explicitly excludes Free Essentials. |

Provider sources: [Upstash pricing](https://upstash.com/pricing/redis),
[Upstash compatibility](https://upstash.com/docs/redis/overall/compatibility),
[EVAL](https://upstash.com/docs/redis/commands/scripting/eval),
[PEXPIRE](https://upstash.com/docs/redis/commands/generic/pexpire),
[PTTL](https://upstash.com/docs/redis/commands/generic/pttl),
[Aiven Free](https://aiven.io/docs/products/valkey/concepts/valkey-free-tier),
[Aiven compatibility](https://aiven.io/docs/products/valkey),
[Valkey Lua](https://valkey.io/topics/eval-intro/),
[Redis Cloud TLS](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/).

### Upstash details that affect this application

- Preserve the native `redis` dependency. Use the account-owned database's native
  `rediss://` endpoint, not its HTTPS REST URL. Native clients and always-on TLS
  are documented in [connection examples](https://upstash.com/kb/express-redis-cache-add-upstash-redis-to-any-nodejs-app)
  and [security](https://upstash.com/docs/redis/features/security).
- Keep certificate verification enabled. The current Heroku-specific
  `REDIS_TLS_REJECT_UNAUTHORIZED=false` exception should not carry over.
- Keep eviction disabled, its default. Early eviction would reset live quotas.
  [Eviction behavior](https://upstash.com/docs/redis/features/eviction).
- **500K commands do not mean 500K visits.** Upstash counts EVAL and commands
  inside scripts. Applying its published accounting to this exact script implies
  3 commands per counter increment, or 4 when expiry is first set. Two increments
  per allowed ordinary backend request imply roughly 6–8 counted commands,
  excluding other activity. Frontend admission introduces more backend requests.
  This is a source-based estimate, not measured provider usage.
  [Command accounting](https://upstash.com/docs/redis/sdks/ratelimit-ts/costs).
- Monthly quota exhaustion returns an error, which this application converts to
  503. Measure traffic and include static assets, invalid requests and frontend
  checks before deciding the Free allowance is sufficient.
  [Quota errors](https://upstash.com/docs/redis/troubleshooting/max_requests_limit).
- Keep the database on Free for strictly $0 usage. The pricing FAQ says adding a
  card upgrades to pay-as-you-go; paid plans do not retain the Free allowance.
  The same pricing page lists 250 MB in the card/FAQ and 256 MB in its comparison.
- Official inactivity sources differ: the [FAQ](https://upstash.com/docs/redis/help/faq)
  says archival after a minimum 30 days; [Terms section I.5](https://upstash.com/static/trust/terms.pdf)
  reserves removal after a week. Confirm account terms before relying on an idle
  service. Avoid unclaimed, three-day scratch databases.

### Aiven details

Aiven defaults to `noeviction`; preserve it and verify the actual Free service
configuration. Its general memory page describes 70% maxmemory, while the
Free-specific page specifies 50%; the Free-specific limit is used above.
[Memory policy](https://aiven.io/docs/products/valkey/concepts/memory-usage).

TLS is enabled by default. New certificates can be publicly trusted, while older
services may require the project's CA. Aiven's `valkeys://` URI must be adapted
to the `rediss://` scheme accepted by this backend, preserving connection details
and certificate validation. [TLS guidance](https://aiven.io/docs/products/valkey/howto/manage-ssl-connectivity),
[node-redis configuration](https://github.com/redis/node-redis/blob/master/docs/client-configuration.md).

No monthly command allowance or Free throughput/client guarantee was established
from the reviewed pages; this does not establish unlimited capacity. Region
availability and latency require checking: current pricing restricts Free cloud
and region choice. [Aiven pricing](https://aiven.io/pricing/valkey).

## Concrete replacement paths

**For memory:** first verify one dyno AND one Node process, with no parallel
replica, and accept restart resets. The current code already supports
`RATE_LIMIT_STORE=memory` plus `RATE_LIMIT_SINGLE_PROCESS=true`. Frontend requests
still share that single backend's counters. Verify health, API limits and
frontend admission before removing Redis. Eco sleep makes reset behavior
particularly relevant if this is still the deployed dyno type.

**For hosted Redis:** after choosing a Free service, validate native TLS, the
exact Lua script, concurrency, TTL, no eviction, provider quotas, latency and
fail-closed recovery on an isolated database/namespace. Then configure Heroku's
existing `REDIS_URL` privately, retain `RATE_LIMIT_STORE=redis`, and enable TLS
verification. No Redis credential needs to move to Vercel. Preserve proxy policy,
owner/admission secrets, MongoDB and quota settings.

For either path, use a coordinated cutover rather than running old and new stores
in parallel; changing stores starts new rate-limit windows. Verify readiness,
public lookup, owner access, frontend admission and expiry. Keep the old add-on
briefly for rollback, accounting for its continued prorated cost. Remove it only
after successful verification and confirming it has no other consumers. Add-on
removal can remove managed config vars: recheck the final `REDIS_URL`/store
configuration and any resulting dyno restart. Preserve URL mappings and indexes.

## Verification performed and remaining boundaries

A small synthetic probe executed the existing memory adapter from the downloaded
backend snapshot. It verified incrementing, expiry, capacity rejection and
independent store isolation. No new application tests were added.

No alternative hosted provider connection was tested. The subsequent memory
cutover and its bounded live verification are recorded at the top of this file.
No blog or URL data migration, application code change, or credential change was
needed. Browser login as the owner and successful operations on an existing
short-link record were not tested; the checks covered public routes, authorization,
admission and synthetic throttling without creating, modifying or deleting records.
