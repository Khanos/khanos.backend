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
- `redis` requires `RATE_LIMIT_REDIS_REST_URL` (HTTPS origin without userinfo, query, fragment,
  or path) and a separate `RATE_LIMIT_REDIS_REST_TOKEN` kept in deployment secrets. The adapter
  uses the Upstash Redis REST POST command format with one atomic EVAL: INCR, first-request
  PEXPIRE and PTTL. Fixed windows expire without touching MongoDB. No dependency or store is
  provisioned automatically. A generic Redis TCP URL is not supported.

The adapter follows [Upstash's REST command-in-body contract](https://upstash.com/docs/redis/features/restapi#post-command-in-body)
and [Redis EVAL's script/key/argument ordering](https://redis.io/docs/latest/commands/eval/).

All backend replicas must use the same Redis database, `RATE_LIMIT_PREFIX`, windows and quotas.
Keep the prefix stable across deployments and distinct from frontend or unrelated applications.
Do not rotate it to clear an incident's quota. Counter keys hash class/identity; no raw IP, bearer
value or destination is sent as a key. The store still sees server egress and request timing.
Grant only the provider permissions required for these counters and retain TLS credentials privately.

`RATE_LIMIT_STORE_TIMEOUT_MS` bounds each command (default 1000, maximum 5000 ms); each
request uses emergency and operation counters sequentially. Responses are bounded to 4 KiB.
An exhausted emergency ceiling rejects before allocating or incrementing an operation key.
Redirects, invalid media type/JSON/count/TTL, network errors and timeout fail closed. There is no
automatic failover to local memory or unthrottled traffic. Counter failure returns uncached
503 `RATE_LIMIT_UNAVAILABLE` without private provider details or guessed retry timing. Recovery
resumes the remaining store quota; an uncertain successful increment is deliberately not refunded.

429 uses `{ error, code: "RATE_LIMITED", requestId }`, `Cache-Control: no-store` and a
`Retry-After` delta bounded to 1–3600 seconds from the actual remaining window. URL failures vary
on Authorization. Logs report only safe class (`anonymous`, `relay`, `owner`, `api`, `safety`)
and outcome (`limited`, `unavailable`) with the existing request correlation context.

## Ingress and staged verification

`TRUSTED_PROXY_CIDRS` defaults empty (`trust proxy=false`). Only explicitly verified proxy
IP addresses or CIDRs are accepted; wildcard ranges, hop counts and aliases are rejected. Do not
set broad ranges merely because the deployment is behind a router. Express evaluates the chain
from the socket outward; an untrusted peer terminates it. Deployment routing must strip or append
forwarding headers consistently and prevent bypass via an alternate ingress.

Read-only Heroku metadata on 2026-10-05 showed one `Eco web.1` and no addons. This establishes
neither authoritative client-IP topology nor working shared counters. A separately authorized
rollout must configure the verified single-process opt-in or provision/test shared Redis before
restart; scaling requires changing to shared counters first. Leave proxy trust disabled until the
actual reachable hops and header policy are verified. Shared egress can pool anonymous direct calls;
server relays avoid the anonymous bucket only after their bearer is verified.

Before merging/deploying, establish ingress TLS/hops, alternate access paths, replica count,
store capabilities/cost and legitimate traffic. Stage backend configuration and anonymous lookup
compatibility first, then frontend visitor/auth limits and server relay. On an owned staging ingress,
verify two-client quota isolation, forged XFF/Forwarded rejection, invalid bearer not gaining relay
quota, relay/owner separation, multi-replica shared exhaustion/expiry, store outage/recovery,
uncached 429/503 and health reachability. Local HTTP protocol fixtures prove application behavior,
not the actual provider's ACL, deployed Redis atomicity, proxy authority or regional routing.

Local regression gates are Node 24/npm 11 `npm run lint`, `npm test -- --runInBand` (99% API
coverage retained; disposable MongoDB 8 only) and `git diff --check`. Existing MongoDB concurrency,
collision and required-index tests remain mandatory. No live DB or ingress mutation is part of tests.

## Rollback and rotation

Merge, deployment, provider provisioning, secret changes and production writes require separate
authorization. Roll back focused code/config together, accounting for the frontend relay and old
backend shared-IP limit. Keep protective MongoDB indexes and all issued mappings. Never delete
records or reset the namespace implicitly. Coordinate bearer rotation between backend and trusted
frontend server secrets; never expose either bearer or Redis token in browser assets or logs.
