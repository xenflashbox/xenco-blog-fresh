## What to tell your Cursor admin to do next (direct instructions)

### Goal

Create/apply the migration that adds the `sites` table (and any related schema changes), then verify admin loads.

### Steps

1. **Confirm you’re targeting the same DB Vercel is using**

   * Use the exact `DATABASE_URI` from **Vercel Production** env vars (not local/dev).

2. **Create a new migration for the Sites + Articles(site) schema change (if you haven’t already)**

   * From repo root:

     * `pnpm payload migrate:create add_sites_and_article_site`
   * Commit the generated migration file(s).
     (This is the standard “generate migration then edit/apply” flow. ([Payload][2]))

3. **Apply migrations to the Production database**

   * Run (locally/CI) with Production env vars:

     * `DATABASE_URI="..." PAYLOAD_SECRET="..." pnpm payload migrate`
   * This is the step that will actually create the missing `sites` table. ([Payload][1])

4. **Verify the table exists (quick DB check)**

   * Run one of these against the prod DB:

     * `select to_regclass('public.sites');`  → should return `sites`
     * or list tables and confirm `sites` exists.

5. **Then verify in the app**

   * Reload Payload Admin → **Sites list should render**
   * Articles should render again too.

6. **Only after the admin renders**

   * Create the Default Site in Admin (`isDefault=true`, add domains)
   * Call:

     * `POST /api/backfill/articles/site` (your new backfill endpoint)
     * `POST /api/reindex/articles`
   * Then test:

     * `GET /api/search?q=test` with a `Host:` header for a known domain




## Next Cursor Admin Prompt (final hardening before redeploy)

### Goal

Make Sites impossible to end up with **zero default** and prevent deleting the **last default**.

### Files to change

`src/collections/Sites.ts`

---

### 1) Deduplicate normalized domains inside the same Site

After you normalize `data.domains`, dedupe by `domain`:

```ts
if (Array.isArray(data.domains)) {
  const seen = new Set<string>()
  data.domains = data.domains.filter((d: any) => {
    const dom = d?.domain
    if (typeof dom !== 'string') return false
    if (seen.has(dom)) return false
    seen.add(dom)
    return true
  })
}
```

---

### 2) Ensure the first Site created becomes default automatically

In the `beforeChange` hook, **before** the “unset other defaults” block, add:

```ts
// If no default exists yet, force this site to become default.
// This prevents the platform from getting stuck (Articles requires a default fallback).
const currentId = (originalDoc as any)?.id
const existingDefault = await req.payload.find({
  collection: 'sites',
  where: {
    and: [
      { isDefault: { equals: true } },
      ...(currentId ? [{ id: { not_equals: currentId } }] : []),
    ],
  },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})

if (!existingDefault.docs?.length) {
  data.isDefault = true
}
```

---

### 3) Block unsetting the last default

Still in `beforeChange`, add a guard:

```ts
const wasDefault = Boolean((originalDoc as any)?.isDefault)
const willBeDefault = data.isDefault === true

if (wasDefault && !willBeDefault) {
  // ensure there is another default; otherwise block
  const otherDefault = await req.payload.find({
    collection: 'sites',
    where: {
      and: [
        { isDefault: { equals: true } },
        { id: { not_equals: String((originalDoc as any)?.id) } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (!otherDefault.docs?.length) {
    throw new Error('You cannot unset the last default site. Set another site as default first.')
  }
}
```

---

### 4) Add a `beforeDelete` hook to prevent deleting the last default

Add a new hook:

```ts
import type { CollectionConfig, CollectionBeforeChangeHook, CollectionBeforeDeleteHook } from 'payload'

const beforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const site = await req.payload.findByID({
    collection: 'sites',
    id: String(id),
    depth: 0,
    overrideAccess: true,
  })

  if (site?.isDefault) {
    const otherDefault = await req.payload.find({
      collection: 'sites',
      where: {
        and: [
          { isDefault: { equals: true } },
          { id: { not_equals: String(id) } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!otherDefault.docs?.length) {
      throw new Error('You cannot delete the last default site. Set another site as default first.')
    }
  }
}
```

Register it:

```ts
hooks: {
  beforeChange: [beforeChange],
  beforeDelete: [beforeDelete],
},
```

---

### 5) Build verification

Run:

```bash
pnpm run generate:types
pnpm run build
```

Commit + push.

---

## After Vercel deploy: exact rollout sequence

1. In Payload Admin → **Sites**: confirm you have **at least one default** and that domains are correct (no protocol).
2. Run backfill:

```bash
curl -X POST "https://cms.xencolabs.com/api/backfill/articles/site" \
  -H "x-api-key: $REINDEX_API_KEY"
```

3. Run reindex:

```bash
curl -X POST "https://cms.xencolabs.com/api/reindex/articles" \
  -H "x-api-key: $REINDEX_API_KEY"
```

4. Validate site-scoped search:

```bash
curl "https://cms.xencolabs.com/api/search?q=career&limit=10" \
  -H "Host: fightclubtech.com"
```

---
This `site.ts` is **mostly solid**, but there’s one real mismatch with the admin summary:

* You **only try removing `www.`**, not the opposite case (request is `example.com` but your Sites record stores `www.example.com`). That will cause “site not found → default fallback” when it shouldn’t.

Also: you’re doing the **default-site lookup 3 separate times** per request (can be noisy under traffic). Easy to tighten up with a tiny cached helper.

Here’s the exact patch I want your admin to apply (replace the whole file contents with this):

```ts
// src/lib/site.ts
// Shared domain/site resolver helper

type PayloadLike = {
  find: (args: any) => Promise<any>
}

let cachedDefaultSiteId: string | null = null
let cachedDefaultSiteAt = 0

export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null

  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '') // strip trailing dot
    .replace(/\/+$/, '')

  return s || null
}

export function getHostFromHeaders(headers: Headers | Record<string, string> | any): string | null {
  if (!headers) return null

  let host: string | null = null

  if (typeof headers.get === 'function') {
    host = headers.get('x-forwarded-host') || headers.get('host') || null
  } else {
    host =
      headers['x-forwarded-host'] ||
      headers['host'] ||
      headers['X-Forwarded-Host'] ||
      headers['Host'] ||
      null
  }

  if (!host) return null

  // if contains commas, take first
  const first = String(host).split(',')[0].trim()
  return first || null
}

async function getDefaultSiteId(payload: PayloadLike): Promise<string | null> {
  const now = Date.now()
  if (cachedDefaultSiteId && now - cachedDefaultSiteAt < 60_000) return cachedDefaultSiteId

  const defaults = await payload.find({
    collection: 'sites',
    where: { isDefault: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const site = defaults.docs?.[0]
  cachedDefaultSiteId = site?.id ? String(site.id) : null
  cachedDefaultSiteAt = now
  return cachedDefaultSiteId
}

async function findSiteByDomain(payload: PayloadLike, domain: string): Promise<string | null> {
  const res = await payload.find({
    collection: 'sites',
    where: { 'domains.domain': { equals: domain } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const site = res.docs?.[0]
  return site?.id ? String(site.id) : null
}

export async function resolveSiteForRequest(
  payload: PayloadLike,
  headers: Headers | Record<string, string> | any,
): Promise<{ id: string } | null> {
  const hostRaw = getHostFromHeaders(headers)
  const host = normalizeDomain(hostRaw)

  // If no host, fallback to default
  if (!host) {
    const id = await getDefaultSiteId(payload)
    return id ? { id } : null
  }

  // Try both variants: exact, without www, and with www
  const hostNoWww = host.startsWith('www.') ? host.slice(4) : host
  const hostWithWww = hostNoWww.startsWith('www.') ? hostNoWww : `www.${hostNoWww}`

  const candidates = Array.from(new Set([host, hostNoWww, hostWithWww]))

  for (const candidate of candidates) {
    const id = await findSiteByDomain(payload, candidate)
    if (id) return { id }
  }

  // Fallback to default site
  const defaultId = await getDefaultSiteId(payload)
  return defaultId ? { id: defaultId } : null
}
```

### Why this is the right “last-mile” fix

* **Fixes the missing “add www” attempt** (the most common real-world domain mismatch).
* **Reduces DB calls** by caching the default-site lookup.
* Keeps behavior identical otherwise.

