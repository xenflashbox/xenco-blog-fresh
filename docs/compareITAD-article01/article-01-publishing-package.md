# Compare ITAD — Article 01 Publishing Package

**Article:** How to Choose an ITAD Vendor: The 2026 Enterprise Buyer's Guide
**Target URL:** `https://compareitad.com/news/how-to-choose-itad-vendor-2026-enterprise-buyers-guide`
**Category:** Vendor Selection & Due Diligence (pillar 3 of 6)
**Word count:** 3,863 words
**Author:** Compare ITAD Editorial
**Status:** Ready for Payload upload

This package contains everything needed to publish the first launch pillar article: the article body in Payload Lexical JSON format (paste-ready), all 7 final images, complete SEO metadata, and step-by-step upload instructions. Execute in order.

---

## 1. Final image list (upload these first)

Upload all 7 images to Payload's Media collection before uploading the article body. The article body references them via Lexical Upload nodes that require the uploaded media records to exist first.

Images are currently staged in the Xen's project folder at `/mnt/project/` with timestamp-hash filenames. Rename each to the semantic filename in the **Payload filename** column during upload so internal admins and editors can find them later without hunting timestamps.

| # | Placement | Source filename (current) | Payload filename (rename to) | Ratio | Alt text (required) |
|---|---|---|---|---|---|
| 1 | Hero / featured image | `hf_20260421_035941_bc40ed4826764a52bc3aeb3ad93fe5a4.png` | `article-01-hero-itad-storage-room.png` | 16:9 | A dimly lit IT storage room with retired business laptops stacked on shelves, one laptop open on a workbench with a glowing screen, and a security vault door partially open in the background. |
| 2 | After "Why 2026 is different" intro, before the three regulatory paragraphs | `hf_20260421_040009_c655633bd9264f7296f87e40fa26d0cd.png` | `article-01-regulatory-documents-checklist.png` | 16:9 | An executive desk with open regulatory documents showing highlighted passages, a compliance checklist with partially ticked boxes, reading glasses, and a coffee mug in warm morning window light. |
| 3 | Within "Certification portfolio — and how to verify it" section | `hf_20260421_040039_35c32269679c42e38291cca67d15fc8c.png` | `article-01-certification-verification.png` | 16:9 | A professional's hands reviewing a formal certification document with a gold-embossed seal on a wooden desk, a laptop displaying a reference webpage alongside. |
| 4 | Within "Data destruction method — match the method to the media" section | `hf_20260421_040200_7ac38b4d405a4166bf6fcf693934e0b8.png` | `article-01-data-destruction-facility.png` | 16:9 | An industrial data destruction facility with hard drives organized on a metal tray in the foreground, a hard drive shredder chute in the mid-ground, and yellow safety striping on the concrete floor. |
| 5 | Within "Documentation depth — the single highest-impact variable" section | `hf_20260421_114628_9291af277afb47069f978d028854b0ec.png` | `article-01-records-archive-corridor.png` | 16:9 | A records storage corridor with tall shelves of binders on both sides, an archivist reaching up to pull a yellow binder from a high shelf, shown from behind with warm light spilling across the shelves. |
| 6 | Within "Value recovery — quantify the opportunity cost of ignoring it" section | `hf_20260421_040224_58c5a35b442a43839cc34036f2c397e1.png` | `article-01-value-recovery-desk.png` | 16:9 | A business laptop, a paper-clipped stack of US currency, and a printed valuation report on a wooden desk in warm natural window light. |
| 7 | Within "The common mistakes that produce bad outcomes" or "What to do this week" section (recommended: at the start of "What to do this week") | `hf_20260421_040235_c31a382f3898475590c61315b4263111.png` | `article-01-conference-room-decision.png` | 16:9 | A corporate conference room with three professionals seated around a meeting table, seen from behind, reviewing documents and laptops in warm late-afternoon light from a floor-to-ceiling window. |

**File optimization before upload:** each PNG should be run through a compression step (e.g., squoosh.app with "MozJPEG" at quality 80, or `imagemin` in a build step). Target final sizes: hero ≤ 400 KB, body images ≤ 200 KB. The source PNGs are currently 87–152 KB which is already acceptable; no conversion to JPEG required unless page-weight budget demands it.

**Upload the hero image first and note its Payload ID** — the SEO metadata block below references the hero as the Open Graph image, and the SEO plugin needs the upload ID at save time.

---

## 2. SEO metadata block

These values go into Payload's SEO plugin fields on the post. If your SEO plugin field names differ, the mapping should be semantic-intent, not literal name-matching.

### Meta tags (the SEO plugin's core fields)

| Field | Value | Character count |
|---|---|---|
| `meta.title` | `How to Choose an ITAD Vendor: 2026 Enterprise Buyer's Guide` | 60 |
| `meta.description` | `Independent framework for evaluating IT asset disposition vendors in 2026. Seven evaluation dimensions, verification workflows, and regulatory context.` | 150 |
| `meta.image` | (Upload ID of image #1, the hero) | — |

### URL slug

- `news/how-to-choose-itad-vendor-2026-enterprise-buyers-guide`

If your routing prefixes posts with `/news/`, use just `how-to-choose-itad-vendor-2026-enterprise-buyers-guide` as the slug.

### Open Graph (typically auto-derived from meta fields by the SEO plugin)

Verify these render correctly on publish. If the SEO plugin doesn't auto-fill them, populate manually:

| Field | Value |
|---|---|
| `og:type` | `article` |
| `og:title` | `How to Choose an ITAD Vendor: The 2026 Enterprise Buyer's Guide` |
| `og:description` | `Independent framework for evaluating IT asset disposition vendors in 2026. Seven evaluation dimensions, verification workflows, and regulatory context.` |
| `og:image` | `https://compareitad.com/media/article-01-hero-itad-storage-room.png` (or the full CDN URL your media collection serves) |
| `og:image:width` | `1200` |
| `og:image:height` | `630` |
| `og:url` | `https://compareitad.com/news/how-to-choose-itad-vendor-2026-enterprise-buyers-guide` |
| `og:site_name` | `Compare ITAD` |

**Note on OG image dimensions:** the hero image is natively 16:9 (roughly 2560×1440 from the generator). For optimal social sharing, Payload's media pipeline should generate a 1200×630 crop — most Payload Media configs do this via image sizes. If not, manually create a 1200×630 crop of the hero and upload it as a separate asset tagged `article-01-hero-og-crop.png`, then reference that for the OG image specifically.

### Twitter Card

| Field | Value |
|---|---|
| `twitter:card` | `summary_large_image` |
| `twitter:title` | `How to Choose an ITAD Vendor: The 2026 Enterprise Buyer's Guide` |
| `twitter:description` | `Independent framework for evaluating IT asset disposition vendors in 2026. Seven evaluation dimensions, verification workflows, and regulatory context.` |
| `twitter:image` | Same as `og:image` |

### Schema.org Article markup (typically auto-generated by the SEO plugin)

Verify the plugin emits this JSON-LD block on publish. Expected shape:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Choose an ITAD Vendor: The 2026 Enterprise Buyer's Guide",
  "description": "Independent framework for evaluating IT asset disposition vendors in 2026. Seven evaluation dimensions, verification workflows, and regulatory context.",
  "image": "https://compareitad.com/media/article-01-hero-itad-storage-room.png",
  "datePublished": "2026-04-21T00:00:00Z",
  "dateModified": "2026-04-21T00:00:00Z",
  "author": {
    "@type": "Organization",
    "name": "Compare ITAD Editorial",
    "url": "https://compareitad.com/about"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Compare ITAD",
    "logo": {
      "@type": "ImageObject",
      "url": "https://compareitad.com/compareITAD-logo-workmark.svg"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://compareitad.com/news/how-to-choose-itad-vendor-2026-enterprise-buyers-guide"
  }
}
```

### Internal tracking keywords (not for page metadata — for editorial catalog)

These are the primary search queries this article is positioned to rank for. Track these in whatever analytics/rank-tracking tool the editorial team uses:

- ITAD vendor selection
- IT asset disposition buyer's guide
- ITAD vendor evaluation
- NIST 800-88 Rev 2 vendor requirements
- How to choose an ITAD vendor
- ITAD certification verification
- Enterprise ITAD compliance 2026
- CMMC 2.0 ITAD vendor
- Scope 3 emissions ITAD

---

## 3. Article body upload procedure

### Option A (recommended): Direct API write

This is the cleanest path. The Lexical JSON was generated to exactly match Payload's Lexical editor state shape.

1. Log into the Payload admin at `cms.compareitad.com` and verify a `posts` (or `articles`, or `news`) collection exists with a `content` field of type `richText` using the Lexical editor. If the collection doesn't exist yet, create it per the content collection schema (title, slug, content, featured_image, meta, author, published_at, category).

2. Create a new draft record in that collection via the Payload UI — just title + slug + minimal fields — to get a record ID. Set:
   - Title: `How to Choose an ITAD Vendor: The 2026 Enterprise Buyer's Guide`
   - Slug: `how-to-choose-itad-vendor-2026-enterprise-buyers-guide`
   - Featured image: upload ID of image #1 (hero)
   - Author: `Compare ITAD Editorial`
   - Category: `Vendor Selection & Due Diligence`
   - Status: Draft

3. PATCH the record via REST API to set the `content` field to the contents of `article-01-lexical.json`:

   ```bash
   curl -X PATCH "https://cms.compareitad.com/api/posts/<RECORD_ID>" \
     -H "Authorization: Bearer ${CMS_API_KEY}" \
     -H "Content-Type: application/json" \
     -d "{\"content\": $(cat article-01-lexical.json)}"
   ```

   The response should be 200 with the updated record. Payload validates the Lexical state server-side, so any structural issue will surface as a 400 with a specific error.

4. Refresh the Payload admin UI and open the draft record. The content field should render the full article with headings, paragraphs, lists, and external links all intact.

### Option B (fallback): Paste into the Lexical editor directly

Only use this if Option A fails. The Lexical editor in Payload's admin UI supports pasting editor state via the browser console:

1. Open the draft record in Payload admin
2. Click into the content field so the Lexical editor is focused
3. Open browser DevTools console
4. Execute (adjusting the selector to match Payload's Lexical editor DOM node):

   ```javascript
   const editor = document.querySelector('[data-lexical-editor=true]').__lexicalEditor
   editor.update(() => {
     const state = editor.parseEditorState(JSON.stringify(<paste JSON here>))
     editor.setEditorState(state)
   })
   ```

5. Save the record via the admin UI's Save button

This path is more fragile and should only be used if the API path is blocked.

---

## 4. Image insertion into article body

The Lexical JSON does not include the 7 inline images. Images need to be inserted into the article body after the main upload so that the Upload nodes reference valid media record IDs.

For each image in the table in section 1:

1. Open the article in Payload admin
2. Find the text anchor described in the "Placement" column
3. Click into the editor at that anchor
4. Use the Lexical editor's "Insert upload" button (typically in the toolbar; may be labeled "Image" or "Upload")
5. Select the uploaded media record by its Payload filename (e.g., `article-01-hero-itad-storage-room.png`)
6. Set the alt text from the table

Paragraph-level text anchors for locating each insertion point:

| # | Image | Insert after paragraph beginning with... |
|---|---|---|
| 1 | Hero | _(Not inserted in body — this is the `featured_image` field, which renders above the article)_ |
| 2 | Regulatory/checklist | "The 200 laptops sitting in your storage closet are not a disposal problem..." (end of intro, before the "Why 2026 is different" heading)  — actually insert **immediately after the `## Why 2026 is different` heading**, before the next paragraph |
| 3 | Certification verification | After the paragraph beginning "**How to verify a claimed certification.** Do not rely on the vendor's website..." |
| 4 | Destruction facility | After the paragraph beginning "**On-site versus off-site destruction.**" — insert before that sub-heading actually; place it right after the paragraph beginning "NIST SP 800-88 Rev. 2 defines three categories:" and its sub-list |
| 5 | Archives/records | After the paragraph beginning "**What to require:**" and its bulleted list — insert immediately before the paragraph beginning "One test to run during vendor evaluation:" |
| 6 | Value recovery desk | After the paragraph beginning "A 1,000-seat laptop refresh retiring..." |
| 7 | Conference room | At the start of the `## What to do this week` section, immediately after that heading |

The hero image (#1) is the featured image, not a body image — Payload's featured_image field handles it automatically in the page template, so it should not be inserted as a Lexical Upload node in the content body.

---

## 5. Post-publish verification checklist

Before flipping the record from Draft to Published, verify:

- [ ] All 7 images upload successfully and display correctly in preview
- [ ] Each image has alt text set per section 1
- [ ] All 7 external links open in a new tab when clicked in preview (Lexical should render them with `target="_blank"`)
- [ ] The three external links to certification registries (sustainableelectronics.org, naidonline.org, e-stewards.org) point to the exact URLs in the source article — broken URLs here damage the article's credibility
- [ ] H1, H2, H3 heading hierarchy renders correctly and matches the source article structure
- [ ] Bulleted lists render with correct indentation
- [ ] Bold and italic formatting appears where expected (the subtitle below the H1 is italic; section emphasis like "On-site versus off-site destruction." should be bold)
- [ ] SEO meta title renders as browser tab title in preview
- [ ] SEO meta description renders in the HTML `<meta>` tag (check via DevTools)
- [ ] Open Graph preview renders correctly when tested via [opengraph.xyz](https://www.opengraph.xyz) against the staging or production URL
- [ ] Structured data (JSON-LD) emitted in page source — test via Google's [Rich Results Test](https://search.google.com/test/rich-results)
- [ ] URL slug matches the planned URL: `compareitad.com/news/how-to-choose-itad-vendor-2026-enterprise-buyers-guide`
- [ ] Category tag set to `Vendor Selection & Due Diligence`
- [ ] Publication date and last-modified date populated

After Published:

- [ ] Article appears in `/news` index
- [ ] Sitemap.xml includes the new URL
- [ ] Internal links from the article (`/assessment`, `/methodology`, `/editorial-standards`, `/newsletter`) all resolve to live pages
- [ ] robots.txt is not disallowing this URL (shouldn't be, but verify)
- [ ] Social sharing preview renders correctly on Twitter/X, LinkedIn, Facebook (test with live URL via each platform's preview tool)

---

## 6. Files in this package

| File | Purpose |
|---|---|
| `article-01-publishing-package.md` | This document — admin instructions |
| `article-01-lexical.json` | Article body in Payload Lexical editor state format — paste into the `content` field |
| `article-01-how-to-choose-itad-vendor.md` | Source markdown reference (for editorial review / regeneration) |

Images are in the project folder `/mnt/project/` — 7 files per the filename table in section 1.

---

**Questions for Xen before publishing:**

1. Confirm the target collection name in Payload (is it `posts`, `articles`, `news`, or something else?). This affects the API endpoint path and the URL structure.
2. Confirm whether the SEO plugin is installed on the CMS. If yes, name of the plugin (payload-seo-plugin is the standard one) and the shape of its `meta` field group.
3. Confirm the publication date — publish today (2026-04-21) as soft launch, or queue for a specific launch date?
4. Author byline policy — should the byline read "Compare ITAD Editorial" as a generic org byline, or assign to a named Anthropic editor/Xen directly?
