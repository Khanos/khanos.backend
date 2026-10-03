# Blog storage and API

MongoDB is the runtime source of truth for blog posts. Express routes compose
`BlogController` → `BlogService` → `BlogPostModel`, matching the existing URL
service pattern. There is no separate repository abstraction or CMS.

The frontend is Astro server output with the Vercel adapter. It reads summaries
for the index/homepage, fetches full articles for `/blog/[lang]/[slug]`, and
renders Markdown with an HTML allowlist. A dynamic `blog-sitemap.xml` retains
article discovery after moving away from build-time static paths. Content is never evaluated as MDX or
JavaScript. The backend does not need frontend code to run.

## Storage and contract

Collection: `blogposts`. IDs are MongoDB ObjectIds serialized as `id` strings.
Mongoose owns `createdAt` and `updatedAt` (UTC ISO strings in JSON). Legacy
posts have import-time creation/update timestamps; original dates remain in
`publishedAt` and `displayDate`.

```ts
type BlogPostSummary = {
  id: string;
  slug: string; // en/6-state-of-devs-2026-ai-workflow
  language: 'en' | 'es';
  title: string;
  author: string;
  anonymous: boolean;
  excerpt: string;
  coverImage: string;
  categories: string[];
  status: 'draft' | 'published';
  publishedAt?: string;
  displayDate?: string; // preserves legacy DD/MM/YYYY bylines
  readingMinutes: number;
  createdAt: string;
  updatedAt: string;
};
type BlogPost = BlogPostSummary & { content: string };
type BlogPage = {
  data: BlogPostSummary[];
  pagination: { page: number; limit: number; total: number; pages: number };
};
```

`slug` is globally unique, includes the language prefix, and permits lowercase
letters, digits and hyphens after `en/` or `es/`. This preserves bilingual URLs
without collisions. `unique_blog_slug` uses binary collation. `blog_publication`
indexes `{ status: 1, publishedAt: -1, slug: 1 }`. Auto-creation/indexing is disabled.
Startup verifies slug uniqueness is indexed and never modifies the database.

Excerpts (400 characters by default) and reading minutes (200 words/minute) are
derived on writes if not provided. Lists never include article content. The
legacy main list sorts by slug; homepage writing sorts by publication date.

## Endpoints

- `GET /api/blog`: public summaries; only published posts with `publishedAt <= now`.
- `GET /api/blog/:slug`: public article; URL-encode the complete slug, for example
  `/api/blog/en%2F6-state-of-devs-2026-ai-workflow`.
- `POST /api/blog`: owner only; returns 201 with the full post.
- `PATCH /api/blog/:id`: owner only; returns the full updated post.
- `DELETE /api/blog/:id`: owner only; returns `{ id }`.

List queries: `language=en|es`, exact `category`, `page=1..1000`, `limit=1..100`
(default 25), `sort=slug|publishedAt`, optional `status=published`. Unknown,
repeated, structured or invalid query values return 400. Draft queries are
rejected, and draft/future slug reads return 404 even for authenticated owners.
There is no administrative listing/preview interface in this feature. Save the
ID from create/update responses when managing drafts.

Create requires `slug`, `language`, `title` (1–300 chars), `content` (1–80,000),
and `coverImage`. Optional fields: `author` (0–200), `anonymous` (boolean),
`excerpt` (0–1,000; empty regenerates it), `categories` (up to 20 distinct
nonempty strings, 80 chars each), `status` (defaults to draft), `publishedAt`
(ISO UTC date/timestamp), and `displayDate` (1–40). Images use absolute HTTPS
URLs without credentials or `/blog-assets/...` paths. IDs/timestamps/derived
reading time and MongoDB operators cannot be written. Existing global 100 KiB
body and rate limits also apply. Duplicate slugs return 409; shared API errors
use `{ error, code, requestId }`.

Example create body (send using a trusted HTTPS client with the existing bearer
credential in the Authorization header; never put that credential in browser
code, URLs, command history, or committed files):

```json
{
  "slug": "en/my-next-post",
  "language": "en",
  "title": "My next post",
  "content": "## Hello\n\nArticle source in **Markdown**.",
  "coverImage": "https://example.com/cover.jpg",
  "status": "draft"
}
```

Publish via PATCH `{ "status": "published" }`; a missing publication date is
set to the current UTC time. Future dates schedule public visibility. Patch
`content` without `excerpt` regenerates the summary. Changing a slug changes
its URL: retain existing slugs to preserve external links.

## Import and rollout

Original frontend files now live in `content/posts/{en,es}`. Their bytes and
frontmatter are preserved. Images and chart source assets live in
`public/blog-assets/images`. The importer resolves the two known MDX articles'
restricted numeric expressions from the retained survey snapshot and converts
charts to non-executable HTML inside Markdown. It does not evaluate arbitrary
expressions. New content should use Markdown or the protected API.

```sh
npm ci
npm run blog:check
# Explicit target supplied privately through the environment; no dotenv/fallback.
# MIGRATION_MONGODB_URI=<selected MongoDB connection>
# MIGRATION_DB_NAME=<selected database name>
npm run blog:import             # read-only preflight
npm run blog:import -- --apply  # explicit index creation and insertion
npm run blog:import             # verification: 0 pending posts, no conflicts
```

The preflight validates all sources, reports missing posts/indexes and conflicts,
and does not create a missing collection. Apply only inserts missing slugs with
`$setOnInsert`, builds declared indexes, and verifies each imported field. It
never overwrites or deletes existing posts. Exact retries preserve IDs/content/
timestamps; a conflicting existing post (including an intentional owner edit)
blocks further import rather than resetting it. Partial failure leaves completed
inserts intact and can be retried after inspection. Do not use this importer as
a synchronization tool after editorial changes; use the API.

Roll out in this order:

1. Back up the selected database privately and inspect the dry-run report.
   Quiesce blog writers during import. Existing URL data/indexes are untouched.
2. Run the explicit import with the release's source, then verify 12 posts,
   six English/Spanish pairs, 0 pending/conflicting posts, and the indexes.
3. Release the backend and verify public article/list responses, owner writes,
   and static images. Startup requires the blog index; import before restart.
4. Release the frontend with the correct `PUBLIC_BACKEND_API_URL` in build and
   runtime environments. Verify `/blog?lang=en`, `/blog?lang=es`, both article
   languages and homepage writing before retiring the old release.

Rollback by restoring the previous frontend/backend releases; the previous
frontend still contains its local blog. Leave the additive `blogposts`
collection/indexes in place. Removing imported data is a separate operation.
No production database/import/deployment is performed by automated tests.

## Security, caching and configuration

Existing `OWNER_API_TOKEN` protects every write at the route boundary. Public
reads never forward credentials. No additional authentication system or frontend
admin UI is introduced. Draft/future reads remain private. Public backend assets explicitly allow embedding
from the separately hosted frontend and cache for one hour (with ETags). Successful API reads
and blog HTML allow a 60-second shared cache; errors and mutations use no-store.
Publication/edit/delete visibility may therefore lag by up to 60 seconds in an
active cache. No persistent frontend content fallback or process memory cache
can mask database failure. Blog outages return 503, not a false empty list/404.

Astro/Sharp cover resizing and WebP output are retained. The image optimizer
authorizes only `/blog-assets/**` on the configured backend origin. Vite (already
used by Astro) is declared directly for loading the same environment configuration.

Frontend: existing `PUBLIC_BACKEND_API_URL` (HTTPS base ending in `/api/`;
loopback HTTP only in development). Backend: existing `CONNECTION_URL`,
`DB_NAME`/`TEST_DB_NAME`, `OWNER_API_TOKEN`, runtime/rate/deadline settings.
Import: explicit `MIGRATION_MONGODB_URI` and `MIGRATION_DB_NAME` only.

The frontend adds `markdown-it` and `sanitize-html` for source rendering and XSS
protection. Sanitization retains tables/details/chart presentation, allows only
chart CSS classes and numeric percentage widths, and removes executable tags,
event handlers, unsafe URLs and arbitrary styles. The author remains responsible
for article text/links; HTML is always sanitized before `set:html`.

Tests: backend `npm run lint` and `npm test` (MongoDB 8 in PATH or `MONGOD_BIN`);
frontend `pnpm test`, `pnpm build`, `pnpm test:e2e`. Database tests import the
real 12 articles into owned disposable databases. Frontend browser tests use
synthetic contract fixtures, with no production credentials/content fallback.
