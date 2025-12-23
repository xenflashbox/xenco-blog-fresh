
## Cursor Admin Prompt — Site-scope Categories + Tags (schema-matched)

### Goal

Make `categories` and `tags` **site-scoped** (each Site has its own taxonomy), and make slugs **unique per-site** (not global). Also filter the Article editor pickers so you can’t accidentally attach cross-site categories/tags.

---

# A) DB migration (match existing schema)

## 1) Create migration file

Create: `src/migrations/20251215_XXXXXX_add_site_to_categories_tags.ts`

Use this exact style (same as your `sites` migration):

```ts
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1) Add site_id columns (idempotent)
  await db.execute(sql`ALTER TABLE IF EXISTS "categories" ADD COLUMN IF NOT EXISTS "site_id" integer;`)
  await db.execute(sql`ALTER TABLE IF EXISTS "tags" ADD COLUMN IF NOT EXISTS "site_id" integer;`)

  // 2) Drop GLOBAL unique constraints on slug if they exist (Payload default names)
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_key') THEN
        ALTER TABLE "categories" DROP CONSTRAINT "categories_slug_key";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_slug_key') THEN
        ALTER TABLE "tags" DROP CONSTRAINT "tags_slug_key";
      END IF;
    END $$;
  `)

  // 3) Backfill site_id from default site, if available
  await db.execute(sql`
    DO $$
    DECLARE default_site_id integer;
    BEGIN
      SELECT "id" INTO default_site_id
      FROM "sites"
      WHERE "is_default" = true
      ORDER BY "id"
      LIMIT 1;

      IF default_site_id IS NULL THEN
        RAISE NOTICE 'No default site found; skipping categories/tags site backfill';
      ELSE
        UPDATE "categories" SET "site_id" = default_site_id WHERE "site_id" IS NULL;
        UPDATE "tags" SET "site_id" = default_site_id WHERE "site_id" IS NULL;
      END IF;
    END $$;
  `)

  // 4) Add FKs (idempotent via pg_constraint)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_site_id_fkey') THEN
        ALTER TABLE "categories"
          ADD CONSTRAINT "categories_site_id_fkey"
          FOREIGN KEY ("site_id") REFERENCES "sites"("id")
          ON DELETE RESTRICT;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_site_id_fkey') THEN
        ALTER TABLE "tags"
          ADD CONSTRAINT "tags_site_id_fkey"
          FOREIGN KEY ("site_id") REFERENCES "sites"("id")
          ON DELETE RESTRICT;
      END IF;
    END $$;
  `)

  // 5) Make site_id NOT NULL only if safe (prevents bricking prod if no defaults)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM "categories" WHERE "site_id" IS NULL) THEN
        ALTER TABLE "categories" ALTER COLUMN "site_id" SET NOT NULL;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM "tags" WHERE "site_id" IS NULL) THEN
        ALTER TABLE "tags" ALTER COLUMN "site_id" SET NOT NULL;
      END IF;
    END $$;
  `)

  // 6) Add per-site unique slug indexes + helper indexes (idempotent)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "categories_site_id_slug_idx"
      ON "categories" ("site_id", "slug");
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "tags_site_id_slug_idx"
      ON "tags" ("site_id", "slug");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "categories_site_id_idx"
      ON "categories" ("site_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tags_site_id_idx"
      ON "tags" ("site_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop indexes first
  await db.execute(sql`DROP INDEX IF EXISTS "categories_site_id_slug_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tags_site_id_slug_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "categories_site_id_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tags_site_id_idx";`)

  // Drop FKs if present
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_site_id_fkey') THEN
        ALTER TABLE "categories" DROP CONSTRAINT "categories_site_id_fkey";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_site_id_fkey') THEN
        ALTER TABLE "tags" DROP CONSTRAINT "tags_site_id_fkey";
      END IF;
    END $$;
  `)

  // Drop columns
  await db.execute(sql`ALTER TABLE IF EXISTS "categories" DROP COLUMN IF EXISTS "site_id";`)
  await db.execute(sql`ALTER TABLE IF EXISTS "tags" DROP COLUMN IF EXISTS "site_id";`)

  // Re-add GLOBAL unique constraints (optional, but keeps down migration coherent)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_key') THEN
        ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_slug_key') THEN
        ALTER TABLE "tags" ADD CONSTRAINT "tags_slug_key" UNIQUE ("slug");
      END IF;
    END $$;
  `)
}
```

## 2) Register migration

* Add the migration `.json` file (same pattern you used for sites)
* Update `src/migrations/index.ts` to include the new migration

Then run locally:

* `pnpm run generate:types`
* `pnpm run build`

---

# B) Code changes — Categories + Tags become site-scoped

## 1) Add shared helper for per-site unique slugs

Create: `src/lib/uniqueSlug.ts`

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureUniqueSlugForSite(args: {
  payload: { find: (args: any) => Promise<any> }
  collection: 'categories' | 'tags'
  siteId: string
  desiredSlug: string
  currentId?: string
}): Promise<string> {
  const { payload, collection, siteId, desiredSlug, currentId } = args

  const base = desiredSlug
  let candidate = base
  let i = 2

  // loop until unique
  while (true) {
    const res = await payload.find({
      collection,
      where: {
        and: [
          { site: { equals: siteId } },
          { slug: { equals: candidate } },
          ...(currentId ? [{ id: { not_equals: currentId } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!res.docs?.length) return candidate
    candidate = `${base}-${i++}`
  }
}
```

(We’re querying `site` at the Payload level — Payload will map that to `"site_id"` in SQL.)

---

## 2) Update `src/collections/Categories.ts`

Implement:

* Add a required `site` relationship field
* Remove `unique: true` from slug
* Add `beforeChange` to:

  * Auto-assign site using `resolveSiteForRequest(req.payload, req.headers)`
  * Auto-slugify from title if missing
  * Ensure per-site unique slug using `ensureUniqueSlugForSite`

Example:

```ts
import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { resolveSiteForRequest } from '../lib/site'
import { ensureUniqueSlugForSite } from '../lib/uniqueSlug'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  // site assignment on create
  if (operation === 'create' && !data.site) {
    const site = await resolveSiteForRequest(req.payload, req.headers)
    if (!site?.id) throw new Error('No default site found. Create a Site with isDefault=true.')
    data.site = site.id
  }

  // slug from title if missing
  if (typeof data.title === 'string' && (!data.slug || typeof data.slug !== 'string')) {
    data.slug = slugify(data.title)
  }

  const siteId =
    typeof data.site === 'string' || typeof data.site === 'number'
      ? String(data.site)
      : (data.site as any)?.id ? String((data.site as any).id) : null

  if (!siteId) throw new Error('Category.site is required.')

  // unique per-site slug
  if (typeof data.slug === 'string' && data.slug.trim()) {
    data.slug = await ensureUniqueSlugForSite({
      payload: req.payload,
      collection: 'categories',
      siteId,
      desiredSlug: data.slug,
      currentId: originalDoc?.id ? String((originalDoc as any).id) : undefined,
    })
  }

  return data
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: { useAsTitle: 'title' },
  access: { read: () => true, create: () => true, update: () => true, delete: () => true },
  hooks: { beforeChange: [beforeChange] },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true }, // removed unique:true
    { name: 'description', type: 'textarea' },

    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      admin: { position: 'sidebar' },
    },
  ],
}
```

---

## 3) Update `src/collections/Tags.ts`

Same idea, but slugify from `name`:

* Add `site` relationship required
* Remove `unique: true` from slug
* `beforeChange`:

  * auto-assign site on create
  * auto-slug from `name` if missing
  * ensure unique per-site slug using `ensureUniqueSlugForSite({ collection: 'tags' })`

---

# C) Article editor: only show categories/tags for the article’s site

In `src/collections/Articles.ts`, update relationship fields:

```ts
{
  name: 'categories',
  type: 'relationship',
  relationTo: 'categories',
  hasMany: true,
  admin: { position: 'sidebar' },
  filterOptions: ({ data }) => {
    const site = (data as any)?.site
    const siteId =
      typeof site === 'string' || typeof site === 'number'
        ? String(site)
        : site?.id ? String(site.id) : null
    if (!siteId) return true
    return { site: { equals: siteId } }
  },
},
{
  name: 'tags',
  type: 'relationship',
  relationTo: 'tags',
  hasMany: true,
  admin: { position: 'sidebar' },
  filterOptions: ({ data }) => {
    const site = (data as any)?.site
    const siteId =
      typeof site === 'string' || typeof site === 'number'
        ? String(site)
        : site?.id ? String(site.id) : null
    if (!siteId) return true
    return { site: { equals: siteId } }
  },
},
```

This prevents cross-site taxonomy selection in the CMS UI.

---

# Prompt for Cursor Admin — Site-scoped Categories + Tags + Search Override

Implement site-scoped taxonomies for Payload multi-site.

## 1) Add `site` relationship to Categories and Tags (required)

### Files:

* `src/collections/Categories.ts`
* `src/collections/Tags.ts`

### Changes:

* Add a required relationship field:

  * `name: 'site'`
  * `type: 'relationship'`
  * `relationTo: 'sites'`
  * `required: true`
  * `admin.position = 'sidebar'`

* Add a `beforeChange` hook:

  * If `data.site` is missing:

    * Resolve the site from request headers using the existing shared helper (`resolveSiteForRequest(req.payload, req.headers)`), fall back to default site.
    * If still none, throw: `"Missing default site. Create a Site with isDefault=true."`
  * Normalize/slugify logic for category/tag slug if you have a slug field.

## 2) Enforce per-site slug uniqueness for Categories/Tags

If Categories/Tags have a `slug` field:

* Remove global `unique: true` on slug (global uniqueness is wrong for multi-site)
* Add a helper `ensureUniqueSlugForSite()` (same pattern as Articles):

  * Check for another doc where `{ site: equals siteId, slug: equals candidateSlug, id: not_equals currentId }`
  * If exists, append `-2`, `-3`, etc.

## 3) Filter Articles admin UI so categories/tags shown match the article’s site

### File:

* `src/collections/Articles.ts`

Update relationship fields:

* `categories` relationship: add `filterOptions` to only show categories where `site = data.site`
* `tags` relationship: add `filterOptions` to only show tags where `site = data.site`

Implementation detail:

* If `data.site` is empty (creating article), return `true` (no filter) OR return only default-site items — prefer returning `true` to avoid blocking creation.
* Once the site is set, the pickers should be restricted.

## 4) Migration: add `site_id` columns to categories/tags tables + indexes

### Create migration:

* Add `site_id` (uuid) to Categories and Tags tables (or whatever Payload created them as).
* Add FK to `sites(id)`.
* Backfill existing categories/tags to default site (same approach as article backfill).
* If you enforce per-site slug uniqueness, create unique index `(site_id, slug)` for each table.

Make migration idempotent (IF NOT EXISTS guards) like the previous one.

## 5) Fix the Vercel testing problem permanently: allow explicit site selection for search

### File:

* `src/endpoints/searchArticles.ts`

Add support for:

* Query param `siteSlug` (or `siteId`)
* Header `x-site-slug` (optional)

Resolution order:

1. If `siteSlug` present → lookup `sites` by slug
2. else if `x-site-slug` present → lookup by slug
3. else fallback to `resolveSiteForRequest(req.payload, req.headers)`

This lets frontends call:
`https://cms.xencolabs.com/api/search?q=foo&siteSlug=resumecoach`
without needing Host overrides.

## 6) Build + validation

Run:

* `pnpm run generate:types`
* `pnpm run generate:importmap`
* `pnpm run build`

Then deploy.

---
Perfect — that response proves the whole chain is working correctly:

* **Routing works** (Vercel accepted the request because you didn’t override `Host`)
* **Site resolution works** (`x-forwarded-host: resumecoach.me` resolved to `siteId: "1"`)
* **Meili indexing + filtering works** (you got exactly the one published article for that site)
* **Your endpoint contract is stable** (`results`, pagination fields, etc.)

Two things jump out from the payload:

## 1) Your `contentText` has massive repetition

That’s coming from your Lexical walker: it’s traversing nested objects in a way that can “re-walk” the same tree via multiple paths (`root`, `children`, and then iterating `Object.values` which includes `root` and `children` again). That’s why you see the same phrases repeated dozens of times.

**Fix:** add a `WeakSet` (or Set) of visited object references, and don’t recursively walk known keys twice. I’d do this soon because it affects:

* relevance scoring
* snippet quality
* index size and speed

## 2) Categories/tags are not site-scoped yet

You called it: since your backend is multi-site, **categories and tags must be multi-site** too. Otherwise you’ll leak taxonomy across sites in the admin UI and in search facets later.

---

# Next prompt for Cursor Admin (do this next, in order)

### Goal

1. Site-scope Categories + Tags (DB + Payload collections + admin UI filtering)
2. Fix `contentText` duplication (single best fix; no A/B)
3. Add search results shaping so the frontend doesn’t receive giant `contentText`

---

## A) Fix Lexical extraction duplication in `src/lib/meili.ts`

Update `extractTextFromLexical()`:

1. Add `const seen = new WeakSet<object>()`
2. In `walk(node)`:

   * If `typeof node === 'object'` and node not null:

     * if `seen.has(node as object)` return
     * `seen.add(node as object)`
3. Stop walking `Object.values(obj)` blindly. Only walk:

   * `obj.root`
   * `obj.children`
   * and for “permissive” recursion, walk `obj.fields` and `obj.value` **only** if present
4. Keep collecting `obj.text` when it’s a string.
5. Return normalized text as you already do.

This should eliminate the repeated paragraphs immediately.

---

## B) Make Categories + Tags site-scoped

### 1) Payload collection updates

Files:

* `src/collections/Categories.ts`
* `src/collections/Tags.ts`

Add:

* `site` relationship field (required) to `sites`, sidebar.

Hooks:

* `beforeChange`: if no `data.site`, assign it using the same logic as Articles:

  * Try to resolve from request headers using `resolveSiteForRequest(req.payload, req.headers)`
  * else fallback to default site
  * if none, throw (clear error)

Uniqueness:

* If category/tag `slug` is currently globally unique, remove `unique: true`.
* Implement per-site uniqueness (same approach as Articles):

  * `ensureUniqueSlugForSite({ payload, collection, siteId, slug, currentId })`
  * create slug, then if conflict in same site, append `-2`, `-3`, etc.

### 2) Admin UI filtering in Articles

File:

* `src/collections/Articles.ts`

For `categories` and `tags` relationship fields:

* Add `filterOptions` so only categories/tags for the article’s `site` show up.
* If `data.site` isn’t set yet, return `true` (don’t block creation UI).

This prevents cross-site taxonomy leakage in the editor.

---

## C) Migration: add site_id columns + indexes for categories/tags

Create a new migration:

* Add `site_id` column to the categories and tags tables
* Backfill existing category/tag rows to the default site
* Add FK constraints to `sites(id)`
* Add unique indexes:

  * `(site_id, slug)` for categories
  * `(site_id, slug)` for tags

Make it idempotent like the Sites migration (guards for already-exists).

---

## D) Search endpoint response shaping (recommended)

Right now, `/api/search` returns full `contentText` which can get huge.

Update `searchArticlesEndpoint` to:

* Return a trimmed `contentTextSnippet` (first ~300–500 chars) OR exclude `contentText` entirely.
* Keep `title`, `excerpt`, `slug`, `publishedAt`, and maybe `categories/tags` ids.

This keeps response fast and avoids shipping massive text to the UI.

---

# What you should test after that PR lands

1. Create a second site and confirm:

   * Creating a category/tag assigns to that site automatically (or forces you to pick)
   * Article editor only shows categories/tags for its site
2. Reindex and run:

```bash
curl "https://cms.xencolabs.com/api/search?q=career&limit=10" \
  -H "x-forwarded-host: resumecoach.me"
```

Confirm `contentText` is no longer duplicated.

---
