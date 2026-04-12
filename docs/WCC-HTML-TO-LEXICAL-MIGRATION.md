# Payload Admin Prompt — Migrate All 106 WordPress Articles: HTML → Native Lexical

## Context

106 articles were migrated from WordPress. Their content is stored as
raw HTML in an `html` field. This is a foreign pattern in a Payload CMS
application. Every article must have its content in the native Lexical
richText field — the same format used by all new content on this site.

This is a one-time migration. After this runs, the `html` field is dead
and the codebase can be cleaned of every HTML rendering path.

No workarounds. No partial migration. Every article gets migrated or
the script fails explicitly.

---

## Step 1 — Verify the schema before touching anything

```bash
CMS_KEY=$(grep "^CMS_API_KEY=" .env.local | cut -d= -f2)
CMS_URL="https://cms.winecountrycorner.com"
SITE_ID=2

# Fetch one article to confirm field structure
curl -s "$CMS_URL/api/articles?limit=1&depth=0&where[site][equals]=$SITE_ID" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '.docs[0] | keys'
```

Confirm these fields exist on the article document:
- `html` — the WordPress HTML content (source)
- `content` — the Payload richText lexical field (destination)
- `id`, `slug`, `title`

If `content` field does not exist or has a different name, STOP.
Check the Payload collection config:

```bash
cat collections/Articles.ts | grep -A5 "richText\|lexical\|content\|body"
```

Identify the correct field name before proceeding.

---

## Step 2 — Count articles that need migration

```bash
CMS_KEY=$(grep "^CMS_API_KEY=" .env.local | cut -d= -f2)
CMS_URL="https://cms.winecountrycorner.com"

# Total articles for site 2
curl -s "$CMS_URL/api/articles?limit=1&where[site][equals]=2" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '{totalDocs}'

# Articles with html content (source ready)
curl -s "$CMS_URL/api/articles?limit=1&where[site][equals]=2&where[html][exists]=true" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '{totalDocs}'

# Articles already with lexical content (already migrated)
curl -s "$CMS_URL/api/articles?limit=1&where[site][equals]=2&where[content][exists]=true" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '{totalDocs}'
```

Log these three numbers. The migration should move all "html exists"
articles to "content exists" articles.

---

## Step 3 — Create the migration script

Save as `scripts/migrate-html-to-lexical.mjs` in the project root:

```javascript
#!/usr/bin/env node
// migrate-html-to-lexical.mjs
// Migrates all WordPress HTML article content to native Payload Lexical format
// Xenco Standards: No workarounds. Fix root cause. Fail explicitly.

import { parseHTML } from "linkedom"

const CMS_URL = process.env.CMS_URL || "https://cms.winecountrycorner.com"
const CMS_KEY = process.env.CMS_API_KEY
const SITE_ID = 2
const CONTENT_FIELD = "content" // Payload richText field name — verify in Step 1
const DRY_RUN = process.argv.includes("--dry-run")

if (!CMS_KEY) {
  console.error("❌ CMS_API_KEY not set")
  process.exit(1)
}

// ── HTML → Lexical Converter ─────────────────────────────────────────────────

function htmlToLexical(html) {
  if (!html || typeof html !== "string" || html.trim().length === 0) {
    throw new Error("Empty or invalid HTML input")
  }

  const { document } = parseHTML(`<body>${html}</body>`)
  const body = document.querySelector("body")
  const nodes = []

  function processNode(el) {
    const tag = el.tagName?.toLowerCase()
    const text = el.textContent?.trim()

    // Skip empty elements
    if (!tag && !text) return null

    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4": {
        const level = parseInt(tag[1])
        const children = processInlineChildren(el)
        if (children.length === 0) return null
        return {
          type: "heading",
          tag: `h${level}`,
          children,
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
        }
      }

      case "p": {
        const children = processInlineChildren(el)
        if (children.length === 0) return null
        return {
          type: "paragraph",
          children,
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
        }
      }

      case "ul":
      case "ol": {
        const listType = tag === "ul" ? "bullet" : "number"
        const listItems = []
        for (const li of el.querySelectorAll("li")) {
          const children = processInlineChildren(li)
          if (children.length > 0) {
            listItems.push({
              type: "listitem",
              children,
              direction: "ltr",
              format: "",
              indent: 0,
              version: 1,
              value: listItems.length + 1,
            })
          }
        }
        if (listItems.length === 0) return null
        return {
          type: "list",
          listType,
          children: listItems,
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
          tag,
        }
      }

      case "blockquote": {
        const children = processInlineChildren(el)
        if (children.length === 0) return null
        return {
          type: "quote",
          children,
          direction: "ltr",
          format: "",
          indent: 0,
          version: 1,
        }
      }

      case "hr":
        return {
          type: "horizontalrule",
          version: 1,
        }

      case "div":
      case "section":
      case "article": {
        // Process children of container elements
        const results = []
        for (const child of el.childNodes) {
          const node = processNode(child)
          if (node) results.push(node)
        }
        return results.length > 0 ? results : null
      }

      default: {
        // Text node or unknown inline element — wrap in paragraph
        if (!tag && text) {
          return {
            type: "paragraph",
            children: [makeTextNode(text)],
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
          }
        }
        // Unknown block element with text content — wrap in paragraph
        if (text) {
          const children = processInlineChildren(el)
          if (children.length > 0) {
            return {
              type: "paragraph",
              children,
              direction: "ltr",
              format: "",
              indent: 0,
              version: 1,
            }
          }
        }
        return null
      }
    }
  }

  function processInlineChildren(el) {
    const children = []
    for (const node of el.childNodes) {
      const nodeType = node.nodeType
      const tag = node.tagName?.toLowerCase()

      if (nodeType === 3) {
        // Text node
        const text = node.textContent
        if (text && text.trim().length > 0) {
          children.push(makeTextNode(text))
        }
      } else if (tag === "strong" || tag === "b") {
        const text = node.textContent?.trim()
        if (text) children.push(makeTextNode(text, { bold: true }))
      } else if (tag === "em" || tag === "i") {
        const text = node.textContent?.trim()
        if (text) children.push(makeTextNode(text, { italic: true }))
      } else if (tag === "a") {
        const href = node.getAttribute("href")
        const text = node.textContent?.trim()
        if (text && href) {
          children.push({
            type: "link",
            url: href,
            children: [makeTextNode(text)],
            direction: "ltr",
            format: "",
            indent: 0,
            version: 1,
            fields: { url: href, newTab: href.startsWith("http") },
          })
        } else if (text) {
          children.push(makeTextNode(text))
        }
      } else if (tag === "br") {
        children.push(makeTextNode("\n"))
      } else if (tag === "code") {
        const text = node.textContent?.trim()
        if (text) children.push(makeTextNode(text, { code: true }))
      } else {
        const text = node.textContent?.trim()
        if (text) children.push(makeTextNode(text))
      }
    }
    return children
  }

  function makeTextNode(text, formats = {}) {
    let format = 0
    if (formats.bold) format |= 1
    if (formats.italic) format |= 2
    if (formats.underline) format |= 8
    if (formats.code) format |= 16
    return {
      type: "text",
      text,
      format,
      mode: "normal",
      style: "",
      detail: 0,
      version: 1,
    }
  }

  // Process all top-level children of body
  const rawNodes = []
  for (const child of body.childNodes) {
    const result = processNode(child)
    if (Array.isArray(result)) {
      rawNodes.push(...result)
    } else if (result) {
      rawNodes.push(result)
    }
  }

  // Filter empty nodes
  const filteredNodes = rawNodes.filter(
    (n) => n && (n.children?.length > 0 || n.type === "horizontalrule")
  )

  if (filteredNodes.length === 0) {
    throw new Error("HTML produced zero Lexical nodes — content may be empty or malformed")
  }

  return {
    root: {
      type: "root",
      children: filteredNodes,
      direction: "ltr",
      format: "",
      indent: 0,
      version: 1,
    },
  }
}

// ── Fetch all articles ────────────────────────────────────────────────────────

async function fetchAllArticles() {
  const allArticles = []
  let page = 1
  let hasNextPage = true

  while (hasNextPage) {
    const res = await fetch(
      `${CMS_URL}/api/articles?limit=100&page=${page}&depth=0` +
      `&where[site][equals]=${SITE_ID}` +
      `&where[html][exists]=true`,
      { headers: { Authorization: `users API-Key ${CMS_KEY}` } }
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Failed to fetch articles page ${page}: ${res.status} ${text}`)
    }

    const data = await res.json()
    allArticles.push(...data.docs)
    hasNextPage = data.hasNextPage
    page++
    console.log(`  Fetched page ${page - 1}: ${data.docs.length} articles (${allArticles.length}/${data.totalDocs} total)`)
  }

  return allArticles
}

// ── Patch single article ──────────────────────────────────────────────────────

async function patchArticle(id, lexicalContent) {
  const res = await fetch(`${CMS_URL}/api/articles/${id}`, {
    method: "PATCH",
    headers: {
      Authorization: `users API-Key ${CMS_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ [CONTENT_FIELD]: lexicalContent }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PATCH failed for article ${id}: ${res.status} ${text}`)
  }

  const data = await res.json()

  // Verify the field was actually saved
  const saved = data.doc?.[CONTENT_FIELD]
  if (!saved || !saved.root?.children?.length) {
    throw new Error(`Verification failed for article ${id}: content field empty after PATCH`)
  }

  return data.doc
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"━".repeat(60)}`)
  console.log(`WCC HTML → Lexical Migration`)
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`)
  console.log(`CMS: ${CMS_URL}`)
  console.log(`${"━".repeat(60)}\n`)

  // Fetch all articles with HTML content
  console.log("Fetching articles with HTML content...")
  const articles = await fetchAllArticles()
  console.log(`\nFound ${articles.length} articles to migrate\n`)

  if (articles.length === 0) {
    console.log("Nothing to migrate.")
    process.exit(0)
  }

  const results = {
    success: [],
    failed: [],
    skipped: [],
  }

  for (const article of articles) {
    const { id, slug, title, html, [CONTENT_FIELD]: existingContent } = article

    // Skip if already has lexical content
    if (existingContent?.root?.children?.length > 0) {
      console.log(`⏭  SKIP  ${slug} — already has Lexical content`)
      results.skipped.push({ id, slug })
      continue
    }

    if (!html || html.trim().length === 0) {
      console.log(`⚠  SKIP  ${slug} — html field is empty`)
      results.skipped.push({ id, slug, reason: "empty html" })
      continue
    }

    try {
      // Convert HTML to Lexical
      const lexical = htmlToLexical(html)
      const nodeCount = lexical.root.children.length

      if (DRY_RUN) {
        console.log(`✓  DRY   ${slug} — would produce ${nodeCount} Lexical nodes`)
        results.success.push({ id, slug, nodeCount })
        continue
      }

      // Write to Payload
      await patchArticle(id, lexical)
      console.log(`✅ DONE  ${slug} — ${nodeCount} nodes written`)
      results.success.push({ id, slug, nodeCount })

      // Rate limiting — avoid hammering the API
      await new Promise(r => setTimeout(r, 150))

    } catch (err) {
      console.error(`❌ FAIL  ${slug} — ${err.message}`)
      results.failed.push({ id, slug, error: err.message })
    }
  }

  // Summary
  console.log(`\n${"━".repeat(60)}`)
  console.log(`Migration ${DRY_RUN ? "Dry Run" : ""} Complete`)
  console.log(`━`.repeat(60))
  console.log(`✅ Success:  ${results.success.length}`)
  console.log(`⏭  Skipped:  ${results.skipped.length}`)
  console.log(`❌ Failed:   ${results.failed.length}`)

  if (results.failed.length > 0) {
    console.log(`\nFailed articles:`)
    results.failed.forEach(f => console.log(`  - ${f.slug}: ${f.error}`))
    process.exit(1) // Fail explicitly — Xenco standard
  }

  if (results.success.length + results.skipped.length === articles.length) {
    console.log(`\n✅ All ${articles.length} articles accounted for.`)
    process.exit(0)
  }

  console.error(`\n❌ Count mismatch — investigate before proceeding.`)
  process.exit(1)
}

main().catch(err => {
  console.error("❌ Fatal error:", err)
  process.exit(1)
})
```

---

## Step 4 — Install dependency

```bash
# linkedom is a fast, Node-compatible HTML parser
npm install linkedom
```

---

## Step 5 — Run dry-run first

```bash
set -a && source .env.local && set +a

node scripts/migrate-html-to-lexical.mjs --dry-run
```

Expected output: one line per article showing slug and projected
node count. No writes happen.

If any article shows 0 nodes or errors in dry-run, investigate that
article's HTML before running live.

---

## Step 6 — Run live migration

```bash
set -a && source .env.local && set +a

node scripts/migrate-html-to-lexical.mjs 2>&1 | tee /tmp/wcc-migration-$(date +%Y%m%d).log
```

Watch for ❌ FAIL lines. Any failure exits with code 1 and lists the
failed slugs. If failures occur, investigate and re-run — the script
skips already-migrated articles so re-running is safe.

---

## Step 7 — Verify migration completeness

```bash
CMS_KEY=$(grep "^CMS_API_KEY=" .env.local | cut -d= -f2)

# Count articles with lexical content after migration
curl -s "https://cms.winecountrycorner.com/api/articles?limit=1&where[site][equals]=2&where[content][exists]=true" \
  -H "Authorization: users API-Key $CMS_KEY" \
  | jq '.totalDocs'

# Should match the total number of articles
# Any delta = articles that failed and need investigation
```

---

## Step 8 — Update article page to use native Lexical renderer

Once migration is complete, update `app/articles/[slug]/page.tsx`
(or wherever article body renders) to use the RichText component
instead of HTML:

```tsx
// REMOVE:
<div dangerouslySetInnerHTML={{ __html: article.html }} />

// OR REMOVE:
<div dangerouslySetInnerHTML={{ __html: article.htmlContent }} />

// REPLACE WITH:
import { RichText } from "@/components/RichText"
<RichText content={article.content} />
```

Where RichText is the native Payload Lexical renderer component.
Use whatever component the winery pages use — same pattern, same
component. One renderer for all content on this site.

---

## Step 9 — Validation check (Xenco standard)

```bash
# Confirm no dangerouslySetInnerHTML remains for content fields
grep -rn "dangerouslySetInnerHTML" app/ components/ \
  --include="*.tsx" --include="*.ts" \
  | grep -v "// legacy\|// temporary"

# Confirm no html field rendering remains
grep -rn "article\.html\|\.htmlContent\|lexicalToHtml" \
  app/ components/ lib/ \
  --include="*.tsx" --include="*.ts"

# Both should return empty or only non-content usage
```

---

## Step 10 — Commit

```bash
git add scripts/migrate-html-to-lexical.mjs
git commit -m "feat: migrate all 106 WordPress articles HTML → native Payload Lexical"
git push origin main
```

Signal complete with:
- Dry-run output (paste first 10 lines and last 5 lines)
- Live migration summary (success / skipped / failed counts)
- Post-migration verification count from Step 7
- Confirmation article page now uses RichText component
- Result of Step 9 grep checks (empty = clean)
