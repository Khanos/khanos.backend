# URL integrity rollout and rollback

This procedure is **not executed by startup**. It requires separate deployment/database
authorization. Tests use disposable databases; separately authorized production preflight
findings are recorded in `.ai/backend-architecture-implementation.md`.
The application never calls `syncIndexes`, builds indexes automatically, deletes duplicate
records, or rewrites issued codes. Schema index declarations are used only by disposable tests
and an operator-approved migration.

## Read-only preflight

Run with an explicitly authorized target and a read-only database identity. The script ignores
`.env`, `CONNECTION_URL`, `DB_NAME`, and `TEST_DB_NAME`; it has no default target. Enter the URI
locally rather than putting credentials in chat, a command argument, shell history, or Git.

```bash
read -rsp 'Authorized MongoDB URI: ' PREFLIGHT_MONGODB_URI
export PREFLIGHT_MONGODB_URI
read -rp 'Authorized database name: ' PREFLIGHT_DB_NAME
export PREFLIGHT_DB_NAME
node scripts/url-preflight.js
unset PREFLIGHT_MONGODB_URI PREFLIGHT_DB_NAME
```

The validity check covers ObjectId identifiers, stored HTTP(S) URLs, safe numeric codes and
creation dates. Output contains only record/invalid-record counts, duplicate code/original groups, and
`requiredIndexesPresent`. Exit 0 means the data checks found no conflict (indexes may still
need installation); exit 2 means data conflicts; exit 1 means the preflight failed.
The read scans the collection and groups keys using simple binary collation. Each database
query has a 30-second server budget. Large collections may need an operator-planned longer
maintenance window or reviewed batching; the script does not silently relax the budget.

Any invalid record or duplicate group blocks rollout. An authorized operator can inspect
conflicting record IDs privately in database tooling; do not paste original URLs into logs or
reports. Same-code/different-original mappings are ambiguous and require an owner decision.
Repeated original URLs with multiple issued codes also need an explicit alias/retention policy
before a unique original index is possible. **Do not silently delete records or change codes
to make an index build succeed.** Preserving such aliases would require a separately reviewed
canonical reuse mapping; this implementation intentionally does not invent that migration.

## Explicit operator command

After separate migration authorization, a recoverable backup and quiescing every writer,
the operator command can perform the narrowly scoped index installation below. It is
read-only by default and requires explicit migration environment variables; it ignores
`.env` and application DB settings. Enter the authorized URI privately, using a read-only
identity for planning and an identity with index privileges only for the approved apply.

```bash
read -rsp 'Authorized MongoDB URI: ' MIGRATION_MONGODB_URI
export MIGRATION_MONGODB_URI
read -rp 'Authorized database name: ' MIGRATION_DB_NAME
export MIGRATION_DB_NAME
node scripts/url-index-migration.js          # Read-only plan and conflict counts
node scripts/url-index-migration.js --apply  # Only after backup/writer checks and authorization
unset MIGRATION_MONGODB_URI MIGRATION_DB_NAME
```

The JSON report contains counts, approved pending/created index names and a safe conflict
code, never URLs, codes, record IDs or credentials. Invalid/duplicate records, incompatible
single-field indexes or conflicting reserved names block every index write. The command
never drops an index, modifies a record, repairs conflicts or changes an issued code.
Already equivalent indexes are retained, making retries idempotent. Each index build has
a 30-second server budget. A failed second build retains the first and reports its name;
inspect state and rerun preflight before an authorized retry, rather than undoing it blindly.
Dry-run exits 2 on conflicts and 0 on a clean plan, even when indexes still need creation.
Connection/build/argument failures exit 1; successful apply requires index readiness.

The application's `URL_INDEXES_MISSING` startup code distinguishes this rollout requirement
from other database startup failures. No listener is opened until the constraints exist.

## Authorized migration

1. Confirm the target/collection (`urlmodels`), client transition, owner credential, and a
   recoverable database backup outside this repository. Test restoring it in an isolated DB.
2. Stop/drain **all** writers, including older application instances and out-of-band jobs.
   Run the preflight against the final quiesced state. Do not proceed with conflicts.
3. In an authenticated operator `mongosh` session, select the authorized database privately.
   Inspect existing indexes. If equivalent non-unique indexes already exist, coordinate their
   replacement explicitly; do not use a blanket index synchronization/drop operation.
4. Create these indexes explicitly:

```javascript
db.getCollection('urlmodels').createIndex(
  { short_url: 1 }, { unique: true, name: 'unique_short_code', collation: { locale: 'simple' } }
)
db.getCollection('urlmodels').createIndex(
  { original_url: 1 },
  { unique: true, name: 'unique_original_url', collation: { locale: 'simple' } }
)
```

5. Rerun preflight. Require `requiredIndexesPresent: true` and no data conflicts. The app
   accepts equivalent single-field ascending unique indexes with simple collation; sparse, partial,
   compound or case-insensitive indexes do not satisfy its contract. `_id` already provides
   the stable pagination index. Check actual query plans/latency for the deployment dataset.
6. Configure a strong random `OWNER_API_TOKEN` through deployment secrets, matching
   `NODE_ENV`/`ENV`, the appropriate DB name, and an explicit `BIND_HOST`. Keep the token on
   trusted server clients; never bundle it in the public frontend. Switch privileged clients
   to `Authorization: Bearer …` over TLS and cursor pagination. Choose bind/proxy/TLS/CORS
   settings appropriate to the actual ingress; the app does not trust proxy headers by default.
7. Deploy only after separate authorization. Startup requires DB and both uniqueness indexes
   before listening. Verify `/health/live`, `/health/ready`, public legacy lookup, authorized
   create/reuse/list/delete and unauthorized rejection. GitHub is optional for readiness.

New codes are numeric integers in `[2^47, 2^48)`, allocated with `crypto.randomInt`, and remain
exactly representable by JavaScript clients. Allocation has five bounded attempts; uniqueness
is enforced in MongoDB. An insert acknowledgment/network failure can be ambiguous, so a client
may safely repeat exact-URL creation after recovery; the unique original index returns the
winner. Codes are identifiers, not credentials or permission checks. Existing nonnegative
safe integer codes retain lookup support; no existing code is regenerated.

## Rollback

Keep the backup and old deployment artifact. Stop/drain writers before any rollback. Prefer
rolling back code while retaining the protective indexes. Old code is unsafe: hash allocation
can collide or fail against these indexes; reverting code is not a way to restore safe creation.
Do not drop constraints while multiple writers are active. An authorized index rollback must
name only indexes introduced by this migration, restore any deliberately replaced indexes,
and account for writes/new codes since the backup. A data restore can lose new links; do not
perform one implicitly. Preserve issued codes and document any client-impacting resolution.
A partial index-build failure leaves startup unready; inspect the state rather than deleting
data or assuming both builds completed.

MongoDB documents that unique indexes cannot be created over conflicting existing records:
[unique index guidance](https://www.mongodb.com/docs/manual/core/index-unique/).
