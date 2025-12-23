## #2 — Fix the Categories/Tags Admin form so `site` shows (and/or auto-fills)

### Step 2A: Prove the deployed app is actually running the updated collection configs

The fact that **the Admin form shows no `site` field** almost always means **the running Payload server is not using the updated `Categories.ts` / `Tags.ts`** (wrong import, duplicate collection, old build, etc.).

Have your admin run these searches in the repo:

```bash
rg "slug:\s*'categories'" -n
rg "slug:\s*'tags'" -n
```

You should see **exactly one** collection definition for each.

Then check `payload.config.ts` (or wherever your config lives) and confirm it imports the same files you edited:

```ts
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
```

If you find duplicates (common in refactors like `collections/taxonomy/Categories.ts`), delete/merge them and redeploy.

### Step 2B: Ensure `Sites` is readable (so the relationship can populate)

In your `Sites` collection config:

```ts
access: {
  read: () => true,
}
```

If `Sites` isn’t readable, the relationship may fail to populate options (usually you’d still see the field label, but it’s still required).

### Step 2C: Make create + update **never** null out `site`

In BOTH `Categories.ts` and `Tags.ts` `beforeChange` hook add:

```ts
if (operation === 'update' && !data.site && originalDoc?.site) {
  data.site = originalDoc.site
}
```

And for create, guarantee a fallback site ID:

```ts
if (operation === 'create' && !data.site) {
  // choose one:
  // 1) req.site?.id (if you have site resolution)
  // 2) default site from DB
  data.site = req.site?.id ?? (await getDefaultSiteId(payload))
}
```

This alone prevents the “**site_id cannot be empty**” brick even if the UI doesn’t show a picker.

---

## #3 — Fix the `/api/categories … 400` + “can’t see/edit existing categories”

What you described (can create, but **can’t see existing**, and **updates forbidden**) is classic:
**read/update access is being site-filtered, but Admin requests don’t have a resolved site**, so the access logic returns an invalid/empty filter or false.

### Step 3A: Patch access to be safe when `req.site` is missing

In Categories + Tags, make access do this:

* If user is admin → allow all
* Else if site is known → constrain to site
* Else → **return true** (not a broken `{ equals: undefined }` filter)

Example pattern:

```ts
read: ({ req }) => {
  if (isAdmin(req.user)) return true
  const siteId = req.site?.id
  return siteId ? { site: { equals: siteId } } : true
},
update: ({ req }) => {
  if (isAdmin(req.user)) return true
  const siteId = req.site?.id
  return siteId ? { site: { equals: siteId } } : false
},
delete: same as update
```

> The critical part is **never returning** `{ site: { equals: undefined } }` — that commonly produces a **400**.

### Step 3B: Confirm the 400 goes away immediately

After redeploy, hit:

* `/api/categories?depth=0`
* `/api/tags?depth=0`

They should return **200**.

---

## Do these next (fastest path)

1. **Search for duplicate category/tag collections** and confirm `payload.config.ts` imports the updated ones.
2. **Add the “preserve site on update” + “fallback site on create” hook logic**.
3. **Make access safe when `req.site` is missing** (prevents 400 + missing lists + forbidden edit).
4. Redeploy.

Got it — **your column + FK setup is correct**, but **your indexes are not** and that alone can cause weird “can’t edit / can’t list / only one row works” behavior.

### ✅ What’s correct in your schema

* `categories.site_id` and `tags.site_id` are **NOT NULL** ✅
* Both have `FOREIGN KEY … REFERENCES sites(id) ON DELETE RESTRICT` ✅
* The **composite unique** index `(...site_id, slug)` exists ✅ (this is the one we want)

### ❌ What’s wrong in your schema (must fix)

These should **NOT** be UNIQUE, but your DB shows them as UNIQUE:

**Categories**

* `categories_site_id_idx` **UNIQUE** ❌ (this would allow only *one* category per site)
* `categories_slug_idx` **UNIQUE** ❌ (this forces slug uniqueness globally, defeating “per-site slug”)
* `categories_created_at_idx` / `categories_updated_at_idx` shown as **UNIQUE** ❌ (also wrong)

**Tags**

* `tags_site_id_idx` **UNIQUE** ❌ (only *one* tag per site)
* `tags_slug_idx` **UNIQUE** ❌ (global slug uniqueness)
* `tags_created_at_idx` / `tags_updated_at_idx` shown as **UNIQUE** ❌

So even if your Payload code is perfect, the DB is currently enforcing constraints you don’t want.

---

## #3 Next step: make the Admin UX foolproof for `site` (even if sidebar is missed)

Your hook is fine *in principle*, but you’re currently depending on the sidebar field + site resolution.

Do this to remove all ambiguity:

### 3A) Preserve `site` on update

Add this in BOTH Categories and Tags `beforeChange`:

```ts
if (operation === 'update' && !data.site && (originalDoc as any)?.site) {
  data.site = (originalDoc as any).site
}
```

### 3B) Auto-default site at the field level (so Admin form gets it prefilled)

Add `defaultValue` to the relationship field (both collections):

```ts
{
  name: 'site',
  type: 'relationship',
  relationTo: 'sites',
  required: true,
  admin: { position: 'sidebar' },
  defaultValue: async ({ req }) => {
    const site = await resolveSiteForRequest(req.payload, req.headers)
    return site?.id
  },
},
```

### 3C) Temporarily move `site` out of the sidebar (debug / UX)

For one deploy, **remove** `admin: { position: 'sidebar' }` and put `site` at the top of `fields`. This will immediately tell us if the field “was there but you didn’t see it” vs “the deployed app isn’t using this config”.

---

## One more high-signal check (because your symptoms match this)

If the Admin truly shows **no `site` field at all**, that usually means **the deployed build is still using an old Categories/Tags collection file**.

Do this quick repo check:

```bash
rg "slug:\s*'categories'" -n
rg "slug:\s*'tags'" -n
```

You should see **exactly one** definition for each, and `payload.config.ts` must import those exact files.

---

### Ignore the LastPass console spam

All those `runtime.lastError … LastPass` messages are just the extension.

---

