# Payload Admin Prompt — Find and Assess 9 Stub Articles

## Context

The HTML→Lexical migration found 9 articles with no content in either
the `html` field or the `content` field. These are stubs. We need to
know what they are before deciding to delete or rewrite them.

---

## Step 1 — Fetch the stub articles

```bash
CMS_KEY=$(grep "^CMS_API_KEY=" .env.local | cut -d= -f2)

curl -s "https://cms.winecountrycorner.com/api/articles?limit=20&depth=0\
&where[site][equals]=2\
&where[content][exists]=false\
&where[html][exists]=false" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '.docs[] | {
      id,
      slug,
      title,
      status,
      publishedAt,
      createdAt,
      thumbnailUrl
    }'
```

Paste the full output.

---

## Step 2 — For each stub, check if it has search traffic

```bash
# Get just the slugs
curl -s "https://cms.winecountrycorner.com/api/articles?limit=20&depth=0\
&where[site][equals]=2\
&where[content][exists]=false\
&where[html][exists]=false" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq -r '.docs[].slug'
```

For each slug, check if the URL returns 200 or is already dead:

```bash
for slug in $(curl -s "https://cms.winecountrycorner.com/api/articles?limit=20&depth=0\
&where[site][equals]=2\
&where[content][exists]=false\
&where[html][exists]=false" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq -r '.docs[].slug'); do
  code=$(curl -so /dev/null -w "%{http_code}" \
    "https://winecountrycorner.com/$slug")
  echo "$code  /$slug"
done
```

---

## Step 3 — Check their status (published vs draft)

```bash
curl -s "https://cms.winecountrycorner.com/api/articles?limit=20&depth=0\
&where[site][equals]=2\
&where[content][exists]=false\
&where[html][exists]=false" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '.docs[] | {slug, status, publishedAt}'
```

If status is "draft" — these were never published. Safe to delete.
If status is "published" — these are live pages with no content.
  Those need either a redirect or immediate content.

---

## Signal Complete With

Paste all output from Steps 1, 2, and 3 together as one block.

We need:
- Full list: id, slug, title, status, publishedAt for all 9
- HTTP status code for each live URL
- Whether any have a thumbnailUrl (image) suggesting real content exists

Owner will decide: delete, redirect, or rewrite based on this data.
Do not delete or modify anything yet. Assessment only.
