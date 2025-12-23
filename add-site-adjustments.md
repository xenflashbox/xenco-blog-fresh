---

## Cursor Admin Prompt — Finalize Multi-Site + Search + Meili (pre-deploy hardening)

### Goal

Make multi-site **production-safe** before redeploy:

1. **Enforce exactly one default Site**
2. **Normalize + de-duplicate domains**
3. **Auto-assign `article.site` from request Host when missing** (so API writes and future automation route to the correct site)
4. Add a **protected backfill endpoint** to set `site` on existing Articles (then reindex)
5. Keep Meili indexing and search endpoint consistent + site-scoped

---

## 1) Update `src/collections/Sites.ts` (enforce single default + normalize domains)

### Requirements

* Domains must be stored normalized: lowercase, trimmed, no protocol, no trailing slash.
* If `isDefault=true` on a site, automatically unset `isDefault` on all other sites.
* Prevent saving a site that causes **domain collisions** with another site.

### Implement

Add hooks to Sites:

* `beforeChange`:

  * Normalize domains.
  * If `data.isDefault === true`, unset other defaults via `req.payload.update` (overrideAccess true).
  * Validate domain uniqueness:

    * For each domain in `domains[]`, query other sites where `domains.domain == domain` and `id != currentId`, and throw if found.

**Note:** Keep this strict. It prevents the “two sites claim the same domain” disaster.

---

## 2) Add shared domain/site resolver helper `src/lib/site.ts`

Create a helper file so Articles + search endpoint share identical logic.

### Create: `src/lib/site.ts`

Implement:

* `normalizeDomain(raw: string | null | undefined): string | null`

  * lowercases
  * strips `http://` / `https://`
  * removes path/query
  * removes trailing slash
  * trims
* `getHostFromHeaders(headers: Headers): string | null`

  * prefer `x-forwarded-host`
  * fallback `host`
  * if value contains commas, take first
* `resolveSiteForRequest(payload, headers): Promise<{ id: string } | null>`

  * normalize host
  * try lookup Sites where `domains.domain == host`
  * also try without leading `www.`
  * if not found, fallback to default site (where isDefault = true)
  * return `{ id }` or null

Keep this file dependency-free (no alias imports). It should accept `payload` and `Headers`.

---

## 3) Update `src/collections/Articles.ts` to auto-assign site from Host (then default)

Right now Articles assigns the default site if missing (good), but it should first try to assign by **request domain** when the write is coming from an API call (future ingestion, etc.).

### Implement changes

In `beforeChange`:

1. If `data.site` is missing:

   * Try resolve site via `resolveSiteForRequest(req.payload, req.headers)`
   * If found, set `data.site = site.id`
2. If still missing:

   * Use default site (existing logic)
3. If still missing:

   * Throw a clear error: `"No default site configured. Create a Site with isDefault=true."`

Also, **ensure slug uniqueness is per-site** (critical for multi-site):

* Remove `unique: true` from `slug` field.
* Add a `beforeChange` validation:

  * Query Articles where `site == data.site` AND `slug == data.slug`
  * Exclude current doc id if updating
  * If found, throw error: `Slug already exists for this site`

(Do this now, otherwise two sites will fight over slugs and routing later.)

---

## 4) Update `src/lib/meili.ts` (small but important)

You already added:

* `site` in `toMeiliArticleDoc`
* `ensureArticlesIndexSettings()`

Add one additional best-practice safeguard:

### Ensure site is always a string

In `toMeiliArticleDoc`, ensure `site` is either a string id or `null`.

Also, confirm `ensureArticlesIndexSettings()` includes:

* filterableAttributes includes `site`
* searchableAttributes includes `contentText`
* sortableAttributes includes `publishedAt`, `updatedAt`

(They already did this—just confirm no regression.)

---

## 5) Update search endpoint to use the shared resolver helper

### File: `src/endpoints/searchArticles.ts`

Replace any inline domain logic with `resolveSiteForRequest(...)` from `../lib/site`.

Behavior must be:

* Determine site from headers
* Filter Meili: `site = "<siteId>" AND status = "published"`
* Support query params:

  * `q` (string, default `""`)
  * `limit` (1–50, default 10)
  * `page` (>=1, default 1)
* Return:

  * `ok`
  * `siteId`
  * `query`
  * `page`, `limit`
  * `total`
  * `results` (Meili hits)

No secret keys exposed. This endpoint is the public search surface.

---

## 6) Add backfill endpoint (so old articles get `site` automatically)

### Create: `src/endpoints/backfillArticleSites.ts`

Protected by `x-api-key == REINDEX_API_KEY` (same guard as reindex).

Behavior:

* Resolve default site id (must exist; otherwise return 500 with a clear message)
* Find Articles where `site` is missing/null
* Update in pages of 100:

  * set `site = defaultSiteId`
  * `overrideAccess: true`
* Return counts:

  * `updated`
  * `scanned`

Important:

* Do **not** attempt to reindex inside this endpoint.
* After backfill, we will call `/api/reindex/articles` once.

### Register in `payload.config.ts`

Add endpoint to endpoints array:

* `backfillArticleSitesEndpoint`

---

## 7) Ensure `payload.config.ts` endpoints are clean

In `src/payload.config.ts`:

* Collections should include `Sites` (before Articles is fine)
* Endpoints should be exactly:

  * `reindexArticlesEndpoint`
  * `searchArticlesEndpoint`
  * `backfillArticleSitesEndpoint`
* Remove any leftover inline endpoint handlers that destructure `{ payload, req }` (that caused the Vercel type error previously).

---

## 8) Commands + deploy checklist

Run locally:

```bash
pnpm i
pnpm run generate:types
pnpm run generate:importmap
pnpm run build
```

After deploy:

1. In Payload Admin, create a Site:

   * name: Default
   * slug: default
   * isDefault: ✅ true
   * domains: include `fightclubtech.com`, etc.

2. Backfill existing articles:

```bash
curl -X POST "https://cms.xencolabs.com/api/backfill/articles/site" \
  -H "x-api-key: $REINDEX_API_KEY"
```

3. Reindex:

```bash
curl -X POST "https://cms.xencolabs.com/api/reindex/articles" \
  -H "x-api-key: $REINDEX_API_KEY"
```

4. Test search scoped by domain:

```bash
curl "https://cms.xencolabs.com/api/search?q=career&limit=10&page=1" \
  -H "Host: fightclubtech.com"
```

---

## Quick note on your Sites.ts

Your `Sites.ts` schema is fine as-is. The only missing piece is the **hooks** to enforce:

* single default
* normalized domains
* no domain collisions

---

## 1) Critical: your Meili `filter: [...]` is likely OR, not AND

In Meili, `filter` arrays are treated as **OR groups** (depending on client version), so:

```ts
filter: [`site = "X"`, `status = "published"`]
```

can behave like:

* `site = "X" OR status = "published"`

That can leak published results from other sites. Fix it by using a **single AND string**:

```ts
const filter = `site = "${siteId}" AND status = "published"`

const res = await index.search(q, {
  limit,
  offset,
  filter,
})
```

Do **not** pass two separate strings.

---

## 2) Your host normalization is incomplete (strip scheme/path + handle www)

`normalizeHost()` only strips port. If a proxy ever passes `https://domain.com` or `domain.com/anything`, you’ll miss the match. Also you should fallback `www.`.

Best fix: implement a robust normalizer and try both host + no-[www](http://www).

---

# Next Cursor Admin Prompt (copy/paste)

### Objective

Harden `src/endpoints/searchArticles.ts` so it’s safe for multi-site production:

1. Fix Meili filter to **AND** (no cross-site leakage)
2. Normalize host robustly (strip protocol, path, port, comma list)
3. Fallback to `www` / non-`www`
4. Keep response stable (`results` + `total`)

---

### Patch `src/endpoints/searchArticles.ts`

1. Replace `normalizeHost` with this:

```ts
function normalizeDomain(input: string): string {
  let s = input.split(',')[0].trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '')
  s = s.split('/')[0] // drop path/query
  s = s.replace(/:\d+$/, '') // drop port
  return s.trim()
}
```

2. Resolve the site like this (try host, then host without leading `www.`):

```ts
const hostRaw = getHeader(req, 'x-forwarded-host') || getHeader(req, 'host') || ''
const host = hostRaw ? normalizeDomain(hostRaw) : ''
const hostNoWww = host.startsWith('www.') ? host.slice(4) : host

let siteDoc: any = null

if (host) {
  const byDomain = await req.payload.find({
    collection: 'sites',
    where: { or: [
      { 'domains.domain': { equals: host } },
      { 'domains.domain': { equals: hostNoWww } },
    ]},
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  siteDoc = byDomain.docs?.[0] ?? null
}

if (!siteDoc) {
  const defaults = await req.payload.find({
    collection: 'sites',
    where: { isDefault: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  siteDoc = defaults.docs?.[0] ?? null
}
```

3. Fix the Meili filter to a **single AND string**:

```ts
const siteId = String(siteDoc.id)
const filter = `site = "${siteId}" AND status = "published"`

const res = await index.search(q, {
  limit,
  offset,
  filter,
})
```

4. Return `results` (keep `hits` if you want, but include `results` for frontend consistency):

```ts
return new Response(
  JSON.stringify({
    ok: true,
    q,
    siteId,
    page,
    limit,
    total: res.estimatedTotalHits ?? res.hits.length,
    results: res.hits,
  }),
  { status: 200, headers: { 'content-type': 'application/json' } }
)
```

5. Keep `await ensureArticlesIndexSettings()` as-is (assuming it’s memoized). If it is NOT memoized, wrap it with a module-level `let ensured=false`.

---

### After patch, run:

```bash
pnpm run generate:types
pnpm run build
```

### Then test:

```bash
curl "https://cms.xencolabs.com/api/search?q=career&limit=10&page=1" \
  -H "Host: fightclubtech.com"
```

And confirm results are **only** from that site.

---

# Next Cursor Admin Prompt (copy/paste)

### Objective

Harden multi-site behavior for Articles:

1. **Never reassign site on update** unless explicitly changed
2. Enforce **slug uniqueness per-site** (allow same slug across different sites)
3. Set `publishedAt` only on **draft → published** transition
4. Remove the `@ts-ignore` once types are generated

---

## 1) Patch `src/collections/Articles.ts`

### A) Update the hook signature and preserve site on updates

Replace `beforeChange` with the following version (keep your helpers/caching):

```ts
const beforeChange: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  // Normalize/auto-slug if missing
  if (typeof data.title === 'string' && (!data.slug || typeof data.slug !== 'string')) {
    data.slug = slugify(data.title)
  }

  // Ensure site is set:
  // - On update: keep original site unless user explicitly provided one
  // - On create: assign default site
  const incomingSite = (data as any).site
  const existingSite = (originalDoc as any)?.site

  if (!incomingSite) {
    if (operation === 'update' && existingSite) {
      ;(data as any).site = existingSite
    } else {
      const defaultSiteId = await getDefaultSiteId(req)
      if (!defaultSiteId) {
        req.payload.logger.error('No default site found. Create a Sites record with isDefault=true.')
        throw new Error('Missing default site. Create a Site with isDefault=true.')
      }
      ;(data as any).site = defaultSiteId
    }
  }

  // Set publishedAt only on first publish (draft -> published)
  const nextStatus = (data as any).status
  const prevStatus = (originalDoc as any)?.status
  if (nextStatus === 'published' && prevStatus !== 'published' && !(data as any).publishedAt) {
    ;(data as any).publishedAt = new Date().toISOString()
  }

  // Ensure slug unique PER SITE (allow same slug across different sites)
  // (Implemented below as ensureUniqueSlugForSite)
  const siteId = String((data as any).site ?? existingSite ?? '')
  if (siteId && typeof (data as any).slug === 'string') {
    ;(data as any).slug = await ensureUniqueSlugForSite({
      req,
      siteId,
      slug: (data as any).slug,
      currentId: String((originalDoc as any)?.id ?? ''),
    })
  }

  return data
}
```

### B) Add this helper below `slugify` (or near the top)

```ts
async function ensureUniqueSlugForSite(args: {
  req: any
  siteId: string
  slug: string
  currentId?: string
}): Promise<string> {
  const base = slugify(args.slug)
  let candidate = base
  let i = 2

  while (true) {
    const where: any = {
      and: [
        { site: { equals: args.siteId } },
        { slug: { equals: candidate } },
      ],
    }

    // exclude current doc on updates
    if (args.currentId) {
      where.and.push({ id: { not_equals: args.currentId } })
    }

    const existing = await args.req.payload.find({
      collection: 'articles',
      where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!existing.docs?.length) return candidate
    candidate = `${base}-${i++}`
    if (i > 50) throw new Error('Unable to generate unique slug for this site.')
  }
}
```

### C) Change the slug field to NOT be globally unique

In `fields`, change:

```ts
{ name: 'slug', type: 'text', required: true, unique: true },
```

to:

```ts
{ name: 'slug', type: 'text', required: true },
```

### D) Remove the `@ts-ignore` on `relationTo: 'sites'`

Once types are generated, `relationTo: 'sites'` should be valid. Remove the ts-ignore block.

---

## 2) Regenerate types + build

Run:

```bash
pnpm run generate:types
pnpm run build
```

---

## 3) Post-deploy smoke tests

1. Create **two sites** with different domains, one default.
2. Create an article on Site A with slug `hello`
3. Create an article on Site B with slug `hello` (should now be allowed)
4. Edit the Site B article WITHOUT touching the site field — confirm it does **not** jump to default.

---

## One more thing (quick confirmation)

Your `searchArticlesEndpoint` **must** use a single string filter like:

```ts
filter: `site = "${siteId}" AND status = "published"`
```

If it’s still using `filter: [ ... ]`, patch that too to prevent cross-site leakage.

---
