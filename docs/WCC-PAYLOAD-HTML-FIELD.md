# Payload Admin Prompt — Add HTML Field to Articles Collection
## One field addition — required for WordPress content migration

You are working inside the Payload CMS codebase (the shared multi-tenant instance
at cms.winecountrycorner.com).

The Wine Country Corner articles collection is missing an `html` field.
During the WordPress migration, the import script tried to store raw HTML content
in this field but Payload silently ignored it because the field doesn't exist
in the schema. Adding this field allows 104 migrated articles to display their
full body content.

## MANDATORY GIT RULES
git pull before starting.
git add -A && git commit -m "message" && git push after the change.
Verify Payload redeploys and cms.winecountrycorner.com/admin is accessible.

---

## STEP 1 — Find the Articles collection config file

```bash
find src -name "*.ts" | xargs grep -l "slug.*articles\|articles.*slug" | head -5
```

Open the Articles collection file. It will contain something like:
```typescript
export const Articles: CollectionConfig = {
  slug: "articles",
  fields: [
    { name: "title", type: "text", ... },
    { name: "slug", type: "text", ... },
    { name: "content", type: "richText", ... },
    ...
  ]
}
```

---

## STEP 2 — Add the html field

In the fields array, find the `content` field (the Lexical richText field).
Add the `html` field AFTER the content field:

```typescript
{
  name: "html",
  type: "textarea",
  label: "Imported HTML Content",
  admin: {
    description: "Raw HTML from WordPress import. Rendered when Lexical content is not available. Do not edit manually.",
    condition: (data) => !data.content?.root?.children?.length,
  },
},
```

If the `condition` import causes a TypeScript error, use this simpler version:
```typescript
{
  name: "html",
  type: "textarea",
  label: "Imported HTML Content",
  admin: {
    description: "Raw HTML from WordPress import. Rendered when Lexical content is not available.",
  },
},
```

---

## STEP 3 — Build and redeploy Payload

```bash
npm run build
# or whatever the Payload build command is
```

Redeploy via Docker, PM2, or however the Payload instance is managed.

---

## STEP 4 — Verify the field exists

After redeploy, confirm the field is accepted by Payload:

```bash
# PATCH a test article with an html value and confirm it's returned
curl -s -X PATCH \
  "https://cms.winecountrycorner.com/api/articles/3734" \
  -H "Authorization: users API-Key <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"html": "<p>Test content</p>"}' \
  | grep -o '"html":"[^"]*"'
```

Expected: `"html":"<p>Test content</p>"`

If `html` appears in the response, the field is live.
If html is absent from the response, the schema change didn't deploy correctly.

---

## STEP 5 — Commit and push

```bash
git add -A
git commit -m "feat: add html textarea field to articles collection for WordPress import"
git push origin main
```

Signal to the WCC admin that the field is live — they will run the content
backfill script immediately after.
