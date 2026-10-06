# URL security operations

This release preserves public lookup and owner-only create/list/delete, exact original-string
reuse, existing numeric codes (including `0000` and `0042`), and the existing database/index
contracts. It does not migrate, rewrite, revoke or delete mappings. Short links and resolved
destinations are public. Code randomness is not authorization or confidentiality. Any private
data inventory or revocation needs separate authorization and must avoid printing destinations.
Destination HTTP(S) compatibility remains unchanged; private-address/cycle restrictions,
dedicated relay tokens, sessions and public DTO changes are deferred policy decisions.

## Quotas and identity

These are staging starting points, not measured production capacity. All limits are finite;
use aggregate status/class counts and latency to tune them without logging sensitive URLs.

| Class | Default | Identity and configuration |
| --- | --- | --- |
| Anonymous URL requests, including invalid authorization and malformed owner requests | 60/minute | Authoritative `req.ip`, IPv6 /56 grouping; `URL_RATE_LIMIT_ANONYMOUS_MAX` |
| Verified bearer public GET/HEAD lookup relay | 300/minute | Verified owner principal shared by all trusted server relays; `URL_RATE_LIMIT_RELAY_MAX` |
| Verified owner URL list/create/delete | 60/minute | Same principal in a separate bucket; `URL_RATE_LIMIT_OWNER_MAX` |
| Unrelated API/docs/assets | 50/5 minutes | Authoritative client IP; existing `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` |
| Emergency aggregate | 5000/minute | All non-health requests together; `RATE_LIMIT_SAFETY_MAX` |

URL classes and the emergency ceiling use `URL_RATE_LIMIT_WINDOW_MS` (default 60000).
The emergency ceiling intentionally can limit all clients during an incident. Below that ceiling,
one client exhausting its URL budget does not consume another client's or the owner's budget.
Malformed and denied requests consume bounded budgets before body parsing. Health endpoints
remain reachable during quota exhaustion or store failure. Shared blog authorization is unchanged;
blog requests use the unrelated API budget.

Missing/invalid optional bearer credentials on public lookup never select the relay quota and
do not require owner authorization. Verification uses the same timing-safe digest comparison as
required owner authentication. The frontend resolver uses `OWNER_API_TOKEN` only from trusted
server code. Client Basic/cookies/forwarding headers must never be relayed as identity. The frontend
must enforce its own distributed visitor and failed-authentication limits before this finite relay.

## Required store configuration before rollout

Outside app-factory tests, `RATE_LIMIT_STORE` must be explicit. No process/replica count is inferred.

- `memory` requires `RATE_LIMIT_SINGLE_PROCESS=true` and exactly one process/replica. Counters
  reset on restart and are not shared. The map is bounded to 50000 active keys; expiry is checked
  on reads and swept at most once a second. Capacity exhaustion fails closed with 503.
- `redis` requires a valid `REDIS_URL` using `redis://` or `rediss://`. Heroku Key-Value Store
  supplies this config var automatically; consume it directly, never copy credentials to source,
  another env var, or logs. All dynos use the same add-on/database. The official `redis` client
  uses one atomic EVAL: INCR, first-request PEXPIRE and PTTL. It returns `{ count, resetMs }`.
  Windows expire automatically, independently of process restarts and without touching MongoDB.
  There is no REST adapter or separate token.

TLS certificate verification defaults on. Heroku KVS requires TLS and uses self-signed certificates;
its [Node.js connection guidance](https://devcenter.heroku.com/articles/connecting-heroku-redis#connecting-in-node-js)
disables certificate verification. Explicitly set `REDIS_TLS_REJECT_UNAUTHORIZED=false` only for
that managed service. `rediss://` still encrypts transport, but this opt-in does not authenticate the
server certificate: it relies on Heroku's managed endpoint/network and protected config vars.
Other Redis services should retain verification. `redis://` is intended for trusted local testing.

Startup connects MongoDB/checks indexes, connects Redis with a bounded deadline, injects the
counter into `createApp()`, then opens HTTP. Failure cleans up both dependencies before exit.
`createApp()` does not connect; Redis mode requires an injected counter. Every request reuses the
startup client. Errors have a safe event handler. Offline command queuing is disabled, the pending
queue is bounded, and the lifecycle owns one reconnect loop with capped exponential backoff
and jitter (native automatic retries are disabled). A command reply
deadline closes a stalled connection and schedules one reconnect of the same client in the
background. There is no per-request connect or automatic retry of an uncertain increment.
These recovery handshakes also have a deadline and a single capped, jittered retry schedule.
SIGTERM/SIGINT stop HTTP acceptance, drain in-flight requests, then close MongoDB and Redis
concurrently within the existing shutdown budget. Redis close has its own deadline and forced
cleanup; the overall shutdown deadline also destroys Redis. Readiness includes Redis when required;
liveness stays available during an outage. No idle Redis socket deadline causes reconnect churn.

All backend replicas must use the same Redis database, `RATE_LIMIT_PREFIX`, windows and quotas.
Keep the prefix stable across deployments and distinct from frontend or unrelated applications.
Do not rotate it to clear an incident's quota. Counter keys hash class/identity; no raw IP, bearer
value or destination is sent as a key. The store still sees server egress and request timing.
Grant only the provider permissions required for these counters and retain TLS credentials privately.
Keep the add-on's `noeviction` memory policy: evicting live keys would reset quotas before expiry.
Capacity errors must fail closed. The Mini plan has no persistence; a Redis service restart can
reset active windows, although application dyno restarts continue sharing existing counters.

`RATE_LIMIT_STORE_TIMEOUT_MS` bounds each command (default 1000, maximum 5000 ms); each
request uses emergency and operation counters sequentially (at most two command deadlines).
An exhausted emergency ceiling rejects before allocating or incrementing an operation key.
Invalid counter/TTL results, native Redis errors, disconnection and timeout fail closed. There is no
automatic failover to local memory or unthrottled traffic. Counter failure returns uncached
503 `RATE_LIMIT_UNAVAILABLE` without private provider details or guessed retry timing. Recovery
resumes the remaining store quota; an uncertain successful increment is deliberately not refunded.

429 uses `{ error, code: "RATE_LIMITED", requestId }`, `Cache-Control: no-store` and a
`Retry-After` delta bounded to 1–3600 seconds from the actual remaining window. URL failures vary
on Authorization. Logs report only safe class (`anonymous`, `relay`, `owner`, `api`, `safety`)
and outcome (`limited`, `unavailable`) with the existing request correlation context.

## Ingress and staged verification

`RATE_LIMIT_PROXY_MODE=cidr` is the default. `TRUSTED_PROXY_CIDRS` defaults empty
(`trust proxy=false`). Only verified proxy IPs/CIDRs are accepted; wildcard /0 ranges, arbitrary
hop counts and aliases are rejected. Express walks from the socket outward until an untrusted
peer. This default ignores spoofed forwarding headers, but on Heroku would group visitors by
router socket address rather than visitor IP. Do not guess static Heroku router CIDRs.

For a Heroku app whose dyno HTTP ingress is **exclusively through the Heroku router**, explicitly
set `RATE_LIMIT_PROXY_MODE=heroku` and leave `TRUSTED_PROXY_CIDRS` unset/empty. This trusts
exactly the socket hop (`trust proxy=1`), never the complete chain or `trust proxy=true`.
[Heroku documents](https://devcenter.heroku.com/articles/http-routing#heroku-headers) that the
router appends the IP of its connecting client to the right of any existing X-Forwarded-For.
Express therefore selects that rightmost address; changing earlier attacker-supplied entries,
Forwarded or X-Real-IP does not change the quota identity. Missing XFF or a malformed selected
IP fails closed with 503 before counters. IPv4 and IPv6 still use `ipKeyGenerator`, including
IPv6 /56 grouping. Verified relay/owner credentials continue to use their separate principal quotas.

This mode is a deployment assertion, not an ingress authenticator: XFF alone cannot prove that
a socket peer is Heroku. Never enable it where direct dyno access (including internal/private
network callers) or another proxy can reach the listener without Heroku's append. An upstream
CDN/proxy's egress is the connecting client; this mode cannot safely recover the visitor behind
that proxy from earlier headers. Additional ingress must be restricted or independently verified
with a header-sanitizing gateway and explicit CIDRs. Do not increase hop count to obtain a desired
address. If topology/header handling cannot be verified, retain CIDR/no-trust mode and accept
pooled client quotas until ingress can be secured. Health exemptions cannot authenticate ingress.

## Manual Heroku setup after merge

These are operator examples only; the PR does not provision services, scale, deploy, or modify
production config. Confirm the plan's availability/cost and choose the shared add-on before
using multiple dynos/processes:

```sh
# Only if the app does not already have the intended shared KVS add-on.
heroku addons:create heroku-redis:mini -a <app-name>
# Heroku supplies REDIS_URL. Do not manually copy it into any file or config var.
# If a nonempty CIDR setting exists, remove it before selecting Heroku mode.
heroku config:unset TRUSTED_PROXY_CIDRS -a <app-name>
# Apply only after verifying the router-only ingress assumptions above.
heroku config:set RATE_LIMIT_STORE=redis REDIS_TLS_REJECT_UNAUTHORIZED=false RATE_LIMIT_PROXY_MODE=heroku -a <app-name>
# Leave TRUSTED_PROXY_CIDRS unset/empty in Heroku mode.
# Optional cleanup if these obsolete settings are present:
heroku config:unset RATE_LIMIT_REDIS_REST_URL RATE_LIMIT_REDIS_REST_TOKEN RATE_LIMIT_SINGLE_PROCESS -a <app-name>
```

Quota defaults, `RATE_LIMIT_STORE_TIMEOUT_MS=1000` and
`RATE_LIMIT_PREFIX=khanos:backend:limits:v1` do not need explicit overrides. All processes must
share them. Preserve MongoDB/owner config, use `NODE_ENV=production`, and leave `TEST` unset/false.
For a verified singleton instead (one dyno **and one Node process**, with no other replica):

```sh
heroku config:set RATE_LIMIT_STORE=memory RATE_LIMIT_SINGLE_PROCESS=true RATE_LIMIT_PROXY_MODE=heroku -a <app-name>
```

Memory needs no Redis service; its restart/replica limitations still apply. Changing config restarts
dynos, so coordinate settings with rollout. Stage native Redis before scaling. A mixed REST/native
rollout shares counters only if both genuinely target the same database and namespace; moving to
a different store starts new windows. Quiesce traffic or use a maintenance rollout to avoid splitting
quotas across old/new stores. Rolling back this adapter requires compatible old store configuration;
do not delete URL data, drop uniqueness indexes or reset namespaces.

On an owned staging ingress verify two actual clients separately, then repeat each request with
forged XFF prefixes/Forwarded/X-Real-IP and confirm the same identity/quota. Confirm both custom
and herokuapp hostnames and any internal paths have the assumed ingress policy. Verify invalid
bearer classification, relay/owner separation, multi-dyno shared exhaustion, automatic expiry,
Redis outage/deadline/recovery, uncached 429/503, healthy liveness and failing Redis readiness.
Local owned RESP fixtures exercise the real native client and app replicas, with deterministic
concurrency/expiry/failure cases; they model the script contract, not a Lua interpreter. They do
not prove deployed ACLs, certificates, Heroku routing or capacity. Perform staging checks before
production rollout, without recording credentials, raw IP chains or destinations in logs.

Local regression gates are Node 24/npm 11 `npm run lint`, `npm test -- --runInBand` (99% API
coverage retained; disposable MongoDB 8 only) and `git diff --check`. Existing MongoDB concurrency,
collision and required-index tests remain mandatory. No live DB or ingress mutation is part of tests.
`npm run test:integration` runs the existing URL integration suite explicitly. Optional
`REDIS_SERVER_BIN=/path/to/redis-server npm run test:redis` owns an isolated loopback Redis
process/directory and executes the production Lua script. It verifies shared app quotas,
100 concurrent increments, expiry without extension, hashed keys, command timeout and recovery.
It also uses OpenSSL to create an ephemeral self-signed TLS fixture, testing verified rejection
and the explicit Heroku TLS opt-in with the real client.
The normal `npm test` suite does not require an installed or external Redis service.

## Rollback and rotation

Merge, deployment, provider provisioning, secret changes and production writes require separate
authorization. Roll back focused code/config together, accounting for the frontend relay and old
backend shared-IP limit. Keep protective MongoDB indexes and all issued mappings. Never delete
records or reset the namespace implicitly. Coordinate bearer rotation between backend and trusted
frontend server secrets; never expose either bearer or Redis credentials in browser assets or logs.
