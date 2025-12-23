Right now your **Payload Admin is not sending `site`**, and your hooks are **not safely handling updates where `site` is omitted**. The most reliable fix is:

1. **Make the Site field always show AND default itself** (so editors can pick, but it pre-fills)
2. **In hooks, fall back to `originalDoc.site` on update** (so editing old docs doesn’t fail when Admin doesn’t include `site`)

### 2) Patch Categories.ts and Tags.ts (hooks + defaultValue)

#### Categories.ts — replace your `siteId` extraction block with this safer version

```ts
let siteId: string | null =
  typeof data.site === 'string' || typeof data.site === 'number'
    ? String(data.site)
    : (data.site as any)?.id
      ? String((data.site as any).id)
      : null

// IMPORTANT: on update, Payload admin may omit relationship fields from `data`
if (!siteId && originalDoc && (originalDoc as any).site) {
  const orig = (originalDoc as any).site
  siteId =
    typeof orig === 'string' || typeof orig === 'number'
      ? String(orig)
      : orig?.id
        ? String(orig.id)
        : null
}

// If still missing, resolve (works for create AND “weird admin payloads”)
if (!siteId) {
  const site = await resolveSiteForRequest(req.payload, req.headers)
  if (!site?.id) throw new Error('No default site found. Create a Site with isDefault=true.')
  data.site = site.id
  siteId = String(site.id)
}

if (!siteId) throw new Error('Category.site is required.')
```

#### Categories.ts — update the `site` field to prefill in Admin

```ts
{
  name: 'site',
  type: 'relationship',
  relationTo: 'sites',
  required: true,
  admin: { position: 'sidebar' },
  defaultValue: async ({ req }) => {
    const site = await resolveSiteForRequest(req.payload, req.headers)
    return site?.id ?? undefined
  },
},
```

Do the **same two changes** in `Tags.ts` (swap error text + collection name).

---

## Why this fixes your symptoms

* **“site_id cannot be empty” on create**: Admin didn’t include `site`, and your hook didn’t successfully populate it in that request path → now it will (defaultValue + fallback resolve).
* **Can’t edit existing categories/tags**: On update, Admin can omit the `site` field, and your hook throws `Category.site is required.` → now it falls back to `originalDoc.site`.

If after this you still see `/api/categories ... 400`, open the Network tab, click that request, and look at the **response JSON**—it’ll name the real server-side error. In most cases it’s one of:

* no default site exists
* sites collection not registered/accessible
* hook throwing due to missing site on update

