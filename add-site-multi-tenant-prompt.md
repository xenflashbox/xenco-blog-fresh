
---

## Cursor Admin Task: Implement Multi-Site + Meili Search (Scoped by Host)

### Goal

Make the CMS support **multiple sites immediately** by introducing a real `sites` collection and linking all `articles` to a `site`. MeiliSearch indexing must include `site`, and search must only return results for the current domain/site.

---

# 0) Prep / Guardrails

1. Work on a new branch: `feat/multisite-search`.
2. Do **not** add any new “temporary site text field”. We are implementing real Sites now.
3. Do **not** create any Next `/app/api/reindex/...` routes. We are using **Payload endpoints** (like your current `reindexArticlesEndpoint`).

---

# 1) Add `Sites` collection

Create file: `src/collections/Sites.ts`

```ts
import type { CollectionConfig } from 'payload'

export const Sites: CollectionConfig = {
  slug: 'sites',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },

    {
      name: 'domains',
      type: 'array',
      fields: [{ name: 'domain', type: 'text', required: true }],
      admin: {
        description:
          'Domains that should resolve to this site (e.g. fightclubtech.com). Do NOT include protocol.',
      },
    },

    { name: 'isDefault', type: 'checkbox', defaultValue: false },
  ],
}
```

---

# 2) Register `Sites` in `payload.config.ts`

Update your `src/payload.config.ts`:

### 2.1 Add import

```ts
import { Sites } from './collections/Sites'
```

### 2.2 Update collections order

Change:

```ts
collections: [Users, Media, Articles, Categories, Tags],
```

To:

```ts
collections: [Users, Media, Sites, Articles, Categories, Tags],
```

(Keep Media before Articles; Sites can sit before Articles.)

---

# 3) Add `site` relationship to Articles + auto-assign default

Update `src/collections/Articles.ts`:

### 3.1 Add `site` field (sidebar)

Add this field near categories/tags (sidebar fields):

```ts
{
  name: 'site',
  type: 'relationship',
  relationTo: 'sites',
  admin: { position: 'sidebar' },
  required: true,
},
```

### 3.2 Update `beforeChange` hook to set default site if missing

In the existing `beforeChange` hook, after slug/publishedAt logic, add:

* A small helper cache at top of file (module scope):

```ts
let cachedDefaultSiteId: string | null = null
let cachedDefaultSiteAt = 0

async function getDefaultSiteId(req: any): Promise<string | null> {
  const now = Date.now()
  if (cachedDefaultSiteId && now - cachedDefaultSiteAt < 60_000) return cachedDefaultSiteId

  const res = await req.payload.find({
    collection: 'sites',
    where: { isDefault: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const site = res.docs?.[0]
  if (!site?.id) return null

  cachedDefaultSiteId = String(site.id)
  cachedDefaultSiteAt = now
  return cachedDefaultSiteId
}
```

* Then in `beforeChange`:

```ts
// Ensure site is set (default site)
if (!data.site) {
  const defaultSiteId = await getDefaultSiteId(req)
  if (!defaultSiteId) {
    req.payload.logger.error(
      'No default site found. Create a Sites record with isDefault=true.'
    )
    // Hard fail because site is required and search/indexing depends on it
    throw new Error('Missing default site. Create a Site with isDefault=true.')
  }
  data.site = defaultSiteId
}
```

**Important:** This enforces correctness. If no default site exists, saving articles should fail loudly rather than silently indexing into the wrong site.

---

# 4) Update `src/lib/meili.ts` to include `site` in docs

Edit `src/lib/meili.ts`:

### 4.1 In `toMeiliArticleDoc`, add `site`

Inside the returned object, include:

```ts
site: (() => {
  const s = a.site
  if (typeof s === 'string' || typeof s === 'number') return String(s)
  if (s && typeof s === 'object' && 'id' in (s as any)) return String((s as any).id)
  return null
})(),
```

So the return becomes:

```ts
return {
  id: String(id),
  site: ...,
  title: ...,
  slug: ...,
  excerpt: ...,
  status: ...,
  publishedAt: ...,
  updatedAt: ...,
  categories: ...,
  tags: ...,
  contentText: ...,
}
```

### 4.2 If `site` is null, do not index

Right after `const payloadDoc = toMeiliArticleDoc(doc)` (in `upsertArticleToMeili`), add:

```ts
if (!payloadDoc.site) return
```

This prevents bad docs from entering the index.

### 4.3 Add an index settings helper (required for site filtering)

Add this function to `meili.ts`:

```ts
export async function ensureArticlesIndexSettings(): Promise<void> {
  const c = getClient()
  if (!c) return

  const index = c.index(INDEX_NAME)

  // Make filtering/sorting/search behavior predictable
  await index.updateSettings({
    searchableAttributes: ['title', 'excerpt', 'contentText'],
    filterableAttributes: ['site', 'status', 'categories', 'tags'],
    sortableAttributes: ['publishedAt', 'updatedAt', 'title'],
  })
}
```

(No need to wait for tasks; Meili applies async—good enough for our use.)

---

# 5) Update `/api/reindex/articles` endpoint to include site + ensure settings

Edit `src/endpoints/reindexArticles.ts`:

### 5.1 Ensure it imports these from lib/meili:

```ts
import { getMeiliClient, toMeiliArticleDoc, ensureArticlesIndexSettings } from '../lib/meili'
```

### 5.2 At start of handler, call:

```ts
await ensureArticlesIndexSettings()
```

### 5.3 When mapping docs, use `toMeiliArticleDoc(d)` and filter out null + missing site:

```ts
const docs = res.docs
  .map((d) => toMeiliArticleDoc(d))
  .filter((d): d is NonNullable<typeof d> => Boolean(d && d.site))
```

### 5.4 Use `index.updateDocuments(docs)` (not addDocuments)

Keep it consistent with your current implementation.

---

# 6) Add a public, site-scoped search endpoint: `/api/search`

Create file: `src/endpoints/searchArticles.ts`

```ts
import type { Endpoint } from 'payload'
import { getMeiliClient, ensureArticlesIndexSettings } from '../lib/meili'

function getHeader(req: any, name: string): string | null {
  const h = req?.headers
  if (!h) return null
  if (typeof h.get === 'function') return h.get(name)
  return h[name] ?? h[name?.toLowerCase?.()]
}

function normalizeHost(host: string): string {
  return host.split(',')[0].trim().toLowerCase().replace(/:\d+$/, '')
}

export const searchArticlesEndpoint: Endpoint = {
  path: '/search',
  method: 'get',
  handler: async (req: any) => {
    const q = typeof req?.query?.q === 'string' ? req.query.q.trim() : ''
    const limit = Math.min(
      50,
      Math.max(1, Number(req?.query?.limit ?? 10) || 10)
    )
    const page = Math.max(1, Number(req?.query?.page ?? 1) || 1)

    if (!q) {
      return new Response(JSON.stringify({ ok: true, q, hits: [], page, limit, total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Resolve site by host → Sites.domains.domain; fallback to isDefault=true
    const hostRaw =
      getHeader(req, 'x-forwarded-host') ||
      getHeader(req, 'host') ||
      ''
    const host = hostRaw ? normalizeHost(hostRaw) : ''

    const sitesByDomain = host
      ? await req.payload.find({
          collection: 'sites',
          where: { 'domains.domain': { equals: host } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] }

    const siteDoc =
      sitesByDomain.docs?.[0] ||
      (
        await req.payload.find({
          collection: 'sites',
          where: { isDefault: { equals: true } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      ).docs?.[0]

    if (!siteDoc?.id) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No site found. Create a default Site (isDefault=true).' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    }

    const meili = getMeiliClient()
    if (!meili) {
      return new Response(
        JSON.stringify({ ok: false, error: 'MeiliSearch not configured.' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      )
    }

    await ensureArticlesIndexSettings()

    const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
    const index = meili.index(indexName)

    const siteId = String(siteDoc.id)
    const offset = (page - 1) * limit

    const res = await index.search(q, {
      limit,
      offset,
      filter: [`site = "${siteId}"`, `status = "published"`],
    })

    return new Response(
      JSON.stringify({
        ok: true,
        q,
        siteId,
        page,
        limit,
        total: res.estimatedTotalHits ?? res.hits.length,
        hits: res.hits,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  },
}
```

---

# 7) Register the new search endpoint in `payload.config.ts`

In `src/payload.config.ts`:

### 7.1 Add import

```ts
import { searchArticlesEndpoint } from './endpoints/searchArticles'
```

### 7.2 Update endpoints array

Change:

```ts
endpoints: [reindexArticlesEndpoint],
```

To:

```ts
endpoints: [reindexArticlesEndpoint, searchArticlesEndpoint],
```

---

# 8) DB Migration + Types

Because we added a new collection + relationship, ensure DB is updated.

### 8.1 Generate and apply migrations

Run on dev box (with DATABASE_URI set to the same DB used for dev/testing):

* Create migration (use your existing Payload migration workflow/command you’ve been using)
* Apply migration locally
* Commit the migration file(s)

### 8.2 Regenerate Payload types

Run:

```bash
pnpm run generate:types
pnpm run generate:importmap
pnpm run build
```

Commit all changes.

---

# 9) Post-deploy setup in Admin (required)

After deploy succeeds:

1. Go to Payload Admin → **Sites**

2. Create the default site:

   * name: `Default`
   * slug: `default`
   * isDefault: ✅ true
   * domains: add your main public domain(s) (not cms domain). Example:

     * `fightclubtech.com`
     * `winecountrycorner.com`
     * etc.
   * You can add multiple domains per site if needed.

3. Edit existing articles and confirm `site` auto-populates (or manually set once).

---

# 10) Test Plan (must pass)

### 10.1 Reindex all published articles

```bash
curl -X POST "https://cms.xencolabs.com/api/reindex/articles" \
  -H "x-api-key: $REINDEX_API_KEY"
```

Expect: `{ ok: true, indexed: <number> }`

### 10.2 Verify Meili docs include `site`

```bash
curl -s -H "Authorization: Bearer $MEILI_KEY" \
  "https://search.xencolabs.com/indexes/articles/documents?limit=5"
```

Each document must contain `"site":"<siteId>"`.

### 10.3 Search endpoint returns site-scoped results

Use Host header to simulate the domain:

```bash
curl -s "https://cms.xencolabs.com/api/search?q=career&limit=10&page=1" \
  -H "Host: fightclubtech.com"
```

Expect:

* `ok: true`
* `siteId` is the site matching that domain
* hits only from that site

---

# 11) Commit Expectations

One PR/branch containing:

* `src/collections/Sites.ts`
* Updated `src/payload.config.ts`
* Updated `src/collections/Articles.ts` (site relationship + default assignment)
* Updated `src/lib/meili.ts` (site field + ensureArticlesIndexSettings)
* Updated `src/endpoints/reindexArticles.ts` (uses toMeiliArticleDoc + ensure settings)
* New `src/endpoints/searchArticles.ts`
* Migration file(s)
* Generated types/importmap updates (if committed in this repo)

---


give your admin the full multi-site + search instructions **now**, and just include this **small alignment update** to the reindex endpoint as part of the same change set (so there’s no “follow-up patch” later).

## What to change in `src/endpoints/reindexArticles.ts` (aligned + multisite-ready)

1. **Keep** `handler: async (req) => {}` (do NOT destructure args).
2. Switch the Meili import to **relative** (more reliable in Payload endpoint compilation).
3. Add `ensureArticlesIndexSettings()` call.
4. Filter out docs missing `site` (they shouldn’t be indexed). Return a `skippedMissingSite` count so you can see what’s happening.

Use this exact file:

```ts
import type { Endpoint } from 'payload'
import {
  getMeiliClient,
  toMeiliArticleDoc,
  ensureArticlesIndexSettings,
} from '../lib/meili'

export const reindexArticlesEndpoint: Endpoint = {
  path: '/reindex/articles',
  method: 'post',
  handler: async (req) => {
    const apiKey = req.headers?.get?.('x-api-key')

    if (!apiKey || apiKey !== process.env.REINDEX_API_KEY) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const meili = getMeiliClient()
    if (!meili) {
      return Response.json(
        { ok: false, error: 'MeiliSearch not configured (MEILISEARCH_HOST/KEY missing)' },
        { status: 500 },
      )
    }

    await ensureArticlesIndexSettings()

    const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
    const index = meili.index(indexName)

    const limit = 100
    let page = 1
    let indexed = 0
    let skippedMissingSite = 0

    while (true) {
      const res = await req.payload.find({
        collection: 'articles',
        where: { status: { equals: 'published' } },
        limit,
        page,
        depth: 0,
        overrideAccess: true,
      })

      if (!res.docs?.length) break

      const mapped = res.docs
        .map((d) => toMeiliArticleDoc(d))
        .filter((d): d is NonNullable<ReturnType<typeof toMeiliArticleDoc>> => Boolean(d))

      const docs = mapped.filter((d) => {
        const ok = Boolean(d.site)
        if (!ok) skippedMissingSite++
        return ok
      })

      if (docs.length) {
        await index.updateDocuments(docs)
        indexed += docs.length
      }

      if (page >= (res.totalPages ?? 1)) break
      page++
    }

    return Response.json({ ok: true, indexed, skippedMissingSite })
  },
}
```

### Why this matters

* Your **current handler signature is already correct**; this keeps it correct.
* Once you add `site` as required on Articles, any legacy published articles without `site` will otherwise “silently vanish” from the index — the `skippedMissingSite` counter makes that obvious.

## One critical note for your admin (so you don’t get “indexed: 0” surprise)

After adding Sites + making `Articles.site` required:

* Create the **default Site** in admin (`isDefault=true`)
* Then either:

  * edit/save existing published articles once (so the `beforeChange` assigns the default site), **or**
  * run a quick one-time script/migration to backfill `site` on existing articles


---

## Patch: update `src/lib/meili.ts`

### 1) Add a tiny helper for a single relationship value (site)

Add this helper near your other helpers (e.g., right above `asStringArray`):

```ts
function asString(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}
```

### 2) Add `site` to `toMeiliArticleDoc()`

Update your returned object to include:

```ts
site: asString(a.site),
```

So it becomes:

```ts
export function toMeiliArticleDoc(doc: unknown) {
  const a = doc as Record<string, unknown>
  const id = a.id
  if (typeof id !== 'string' && typeof id !== 'number') return null

  return {
    id: String(id),
    site: asString(a.site), // ✅ add this
    title: typeof a.title === 'string' ? a.title : '',
    slug: typeof a.slug === 'string' ? a.slug : '',
    excerpt: typeof a.excerpt === 'string' ? a.excerpt : '',
    status: typeof a.status === 'string' ? a.status : '',
    publishedAt: a.publishedAt ? String(a.publishedAt) : null,
    updatedAt: a.updatedAt ? String(a.updatedAt) : null,
    categories: asStringArray(a.categories),
    tags: asStringArray(a.tags),
    contentText: extractTextFromLexical(a.content),
  }
}
```

### 3) Add `ensureArticlesIndexSettings()` export (memoized)

Add this **export** somewhere after `getClient()` (anywhere top-level is fine):

```ts
let ensureSettingsPromise: Promise<void> | null = null

export async function ensureArticlesIndexSettings(): Promise<void> {
  const c = getClient()
  if (!c) return

  if (!ensureSettingsPromise) {
    ensureSettingsPromise = (async () => {
      const index = c.index(INDEX_NAME)

      // Ensure index exists (create if missing)
      try {
        // Works in most Meili versions
        // @ts-ignore
        await index.getRawInfo?.()
      } catch (e: any) {
        // Create index if it doesn't exist
        const status = e?.status ?? e?.response?.status
        if (status === 404) {
          // @ts-ignore
          const task = await c.createIndex(INDEX_NAME, { primaryKey: 'id' })
          // @ts-ignore
          if (task?.taskUid && typeof c.waitForTask === 'function') {
            await withTimeout(c.waitForTask(task.taskUid), 8000)
          }
        } else {
          throw e
        }
      }

      // Set best-practice search settings for Articles
      // (site/status/categories/tags filterable; dates sortable; content searchable)
      // @ts-ignore
      const task = await index.updateSettings({
        searchableAttributes: ['title', 'excerpt', 'contentText'],
        filterableAttributes: ['site', 'status', 'categories', 'tags'],
        sortableAttributes: ['publishedAt', 'updatedAt', 'title'],
        displayedAttributes: [
          'id',
          'site',
          'title',
          'slug',
          'excerpt',
          'status',
          'publishedAt',
          'updatedAt',
          'categories',
          'tags',
          'contentText',
        ],
      })

      // Wait if supported (helps make tests deterministic)
      // @ts-ignore
      if (task?.taskUid && typeof c.waitForTask === 'function') {
        await withTimeout(c.waitForTask(task.taskUid), 8000)
      }
    })()
  }

  return ensureSettingsPromise
}
```

### 4) (Recommended) Call `ensureArticlesIndexSettings()` inside `upsertArticleToMeili`

This guarantees settings are applied even if you never call the reindex endpoint:

```ts
export async function upsertArticleToMeili(doc: unknown): Promise<void> {
  const c = getClient()
  if (!c) return

  await ensureArticlesIndexSettings() // ✅ add this

  const payloadDoc = toMeiliArticleDoc(doc)
  if (!payloadDoc) return
  if (!payloadDoc.site) return // ✅ skip until site is set (multi-site correctness)

  const index = c.index(INDEX_NAME)
  await withTimeout(index.updateDocuments([payloadDoc]), 4000)
}
```

---

## Quick sanity checks after patch

```bash
pnpm run generate:types
pnpm run build
```

Then verify settings exist (optional) by reindexing:

```bash
curl -X POST "https://cms.xencolabs.com/api/reindex/articles" \
  -H "x-api-key: $REINDEX_API_KEY"
```

---
