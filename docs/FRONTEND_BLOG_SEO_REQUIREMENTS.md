# Frontend Blog SEO & Rendering Requirements

**For**: All blog frontends consuming the Payload CMS API (Resume Coach, Fiber Insider, Wine Country Corner WordPress, and any future sites)

**CMS API Base**: `https://cms.{site-domain}/api/articles` (or `https://publish.xencolabs.com/api/articles` as fallback)

**Date**: February 2026

---

## 1. Article API Response Structure

Every article fetched from `/api/articles/{id}` or `/api/articles?where[slug][equals]=xxx&where[site][equals]=n` returns:

```json
{
  "id": 28,
  "title": "Article Title",
  "slug": "article-slug",
  "excerpt": "Short summary for cards and meta description fallback",
  "featuredImage": { "id": 165, "url": "/api/media/file/...", "alt": "...", "width": 1024, "height": 1024 },
  "heroImage": { "id": null, "url": "...", "alt": "..." },
  "content": { "root": { "type": "root", "children": [...] } },
  "categories": [{ "id": 10, "title": "Job Search Strategies", "slug": "job-search-strategies" }],
  "tags": [{ "id": 1, "name": "job search platforms", "slug": "job-search-platforms" }],
  "author": { "id": 3, "name": "Emily Johnson", "bio": "...", "avatar": {...} },
  "site": { "id": 1, "name": "Resume Coach", "slug": "resume-coach" },
  "status": "published",
  "publishedAt": "2026-02-18T00:54:03.014Z",
  "metaTitle": "Job Search Platforms: 7 Essential Sites | ResumeCoach",
  "metaDescription": "Discover the best job search platforms for 2026...",
  "focusKeyword": "job search platforms",
  "noIndex": false,
  "canonicalUrl": null,
  "structuredData": null,
  "seoScore": 85,
  "seoGrade": "A"
}
```

**NOTE**: The `metaTitle`, `metaDescription`, `focusKeyword`, `noIndex`, `canonicalUrl`, and `structuredData` fields are being added to the Payload schema. They will be `null` for older articles until backfilled. Your frontend MUST handle null gracefully with fallbacks.

---

## 2. HTML `<head>` SEO Requirements

Every blog article page MUST include the following in `<head>`. Use Next.js `metadata` export or `generateMetadata()` for App Router sites.

### 2.1 Core Meta Tags

```html
<!-- Title: metaTitle > title + site name fallback -->
<title>{metaTitle || `${title} | ${siteName} Blog`}</title>

<!-- Description: metaDescription > excerpt fallback -->
<meta name="description" content="{metaDescription || excerpt}" />

<!-- Canonical URL (prevents duplicate content issues) -->
<link rel="canonical" href="{canonicalUrl || `https://${siteDomain}/blog/${slug}`}" />

<!-- Robots -->
<meta name="robots" content="{noIndex ? 'noindex, nofollow' : 'index, follow'}" />

<!-- Focus keyword hint for internal tooling (not rendered to HTML, used by SEO scoring) -->
<!-- Store in data attribute or use in content optimization logic -->
```

### 2.2 Open Graph (Facebook, LinkedIn, etc.)

```html
<meta property="og:type" content="article" />
<meta property="og:title" content="{metaTitle || title}" />
<meta property="og:description" content="{metaDescription || excerpt}" />
<meta property="og:url" content="https://{siteDomain}/blog/{slug}" />
<meta property="og:image" content="{absolute URL to featuredImage}" />
<meta property="og:image:width" content="{featuredImage.width}" />
<meta property="og:image:height" content="{featuredImage.height}" />
<meta property="og:image:alt" content="{featuredImage.alt}" />
<meta property="og:site_name" content="{siteName}" />
<meta property="og:locale" content="en_US" />
<meta property="article:published_time" content="{publishedAt}" />
<meta property="article:modified_time" content="{updatedAt}" />
<meta property="article:author" content="{author.name}" />
<meta property="article:section" content="{categories[0].title}" />
<meta property="article:tag" content="{tag.name}" />  <!-- one per tag -->
```

### 2.3 Twitter Card

```html
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{metaTitle || title}" />
<meta name="twitter:description" content="{metaDescription || excerpt}" />
<meta name="twitter:image" content="{absolute URL to featuredImage}" />
<meta name="twitter:image:alt" content="{featuredImage.alt}" />
```

### 2.4 JSON-LD Structured Data (CRITICAL for Google Rich Results)

Every article page MUST include this `<script type="application/ld+json">` in `<head>`:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "{title}",
  "description": "{metaDescription || excerpt}",
  "image": ["{absolute featuredImage URL}"],
  "datePublished": "{publishedAt}",
  "dateModified": "{updatedAt}",
  "author": {
    "@type": "Person",
    "name": "{author.name}"
  },
  "publisher": {
    "@type": "Organization",
    "name": "{siteName}",
    "logo": {
      "@type": "ImageObject",
      "url": "https://{siteDomain}/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://{siteDomain}/blog/{slug}"
  },
  "keywords": "{focusKeyword}, {tags.map(t => t.name).join(', ')}"
}
```

If the article has an FAQ section (detected by an `<h2>` with text "Frequently Asked Questions"), ALSO include FAQ structured data:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text here",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer text here"
      }
    }
  ]
}
```

### 2.5 Breadcrumb Structured Data

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://{siteDomain}" },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://{siteDomain}/blog" },
    { "@type": "ListItem", "position": 3, "name": "{categories[0].title}", "item": "https://{siteDomain}/blog/category/{categories[0].slug}" },
    { "@type": "ListItem", "position": 4, "name": "{title}" }
  ]
}
```

---

## 3. Lexical Rich Text Rendering

The `content` field is Payload Lexical JSON. The frontend MUST render ALL of these node types that the CMS supports:

### 3.1 Supported Lexical Node Types

| Node Type | Lexical `type` value | How to Render |
|-----------|---------------------|---------------|
| Paragraph | `paragraph` | `<p>` with proper spacing |
| Heading | `heading` (tag: h1-h6) | `<h2>`, `<h3>`, etc. with anchor IDs for TOC links |
| Unordered List | `list` (listType: bullet) | `<ul><li>` |
| Ordered List | `list` (listType: number) | `<ol><li>` |
| List Item | `listitem` | `<li>` |
| Link | `link` | `<a href>` with `rel="noopener"` for external links |
| **Blockquote** | `quote` | `<blockquote>` styled as a callout/pull-quote |
| **Horizontal Rule** | `horizontalrule` | `<hr>` styled as a section divider |
| Upload/Image | `upload` | `<figure><img><figcaption>` |
| Checklist | `checklist` | Styled checkbox list |
| Inline Code | format bit | `<code>` inline |
| Bold | format: 1 | `<strong>` |
| Italic | format: 2 | `<em>` |
| Underline | format: 8 | `<u>` |
| Strikethrough | format: 4 | `<s>` |
| Subscript | format: 32 | `<sub>` |
| Superscript | format: 64 | `<sup>` |

### 3.2 Heading Anchor IDs (for TOC navigation)

Every heading MUST generate an `id` attribute from its text content for in-page navigation:

```tsx
function slugifyHeading(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Render: <h2 id="how-job-search-platforms-evolved-2026">...</h2>
```

This is CRITICAL because articles include Table of Contents sections with `#anchor-link` references.

### 3.3 Image Rendering

Upload nodes contain:
```json
{
  "type": "upload",
  "relationTo": "media",
  "value": { "id": 166, "url": "/api/media/file/...", "alt": "...", "width": 1024, "height": 1024 },
  "fields": { "caption": "Image description text" }
}
```

Render as:
```html
<figure class="article-image">
  <img
    src="https://cms.{domain}/api/media/file/{filename}"
    alt="{value.alt}"
    width="{value.width}"
    height="{value.height}"
    loading="lazy"
    decoding="async"
  />
  <figcaption>{fields.caption}</figcaption>
</figure>
```

**IMPORTANT**: All images MUST have `alt` text. If `value.alt` is empty, use `fields.caption` as fallback. Never render an image with an empty alt attribute.

### 3.4 Blockquote Styling (Pull Quotes / Callouts)

Blockquotes should be visually distinct - not just indented text. Recommended styling:

```css
blockquote {
  border-left: 4px solid var(--accent-color);
  background: rgba(var(--accent-rgb), 0.05);
  padding: 1.25rem 1.5rem;
  margin: 2rem 0;
  border-radius: 0 8px 8px 0;
  font-style: italic;
  font-size: 1.1em;
  line-height: 1.6;
}
```

### 3.5 Horizontal Rule Styling

```css
hr.article-divider {
  border: none;
  height: 1px;
  background: linear-gradient(to right, transparent, var(--border-color), transparent);
  margin: 3rem auto;
  max-width: 60%;
}
```

---

## 4. FAQ Accordion Component

When the renderer encounters an `h2` node with text "Frequently Asked Questions" (or similar), switch to FAQ rendering mode. Detect the pattern:

- **Bold paragraph** = Question
- **Next regular paragraph(s)** = Answer

Render using an accordion/collapsible component:

```tsx
// Using shadcn/ui Accordion (recommended)
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

<section id="faq" className="article-faq">
  <h2>Frequently Asked Questions</h2>
  <Accordion type="single" collapsible className="faq-accordion">
    {faqItems.map((item, i) => (
      <AccordionItem key={i} value={`faq-${i}`}>
        <AccordionTrigger>{item.question}</AccordionTrigger>
        <AccordionContent>{item.answer}</AccordionContent>
      </AccordionItem>
    ))}
  </Accordion>
</section>
```

**Detection logic**: After the "Frequently Asked Questions" h2, scan child nodes:
1. A paragraph where the first text node has `format: 1` (bold) = Question
2. All subsequent non-bold paragraphs until the next bold paragraph or heading = Answer
3. Repeat until the next `h2` or end of content

**CSS for FAQ section**:
```css
.faq-accordion [data-state="open"] {
  background: rgba(var(--accent-rgb), 0.03);
  border-radius: 8px;
}

.faq-accordion button {
  font-weight: 600;
  font-size: 1.05rem;
  text-align: left;
  padding: 1rem;
}

.faq-accordion [role="region"] {
  padding: 0 1rem 1rem;
  color: var(--text-muted);
  line-height: 1.7;
}
```

---

## 5. Article Page Layout Best Practices

### 5.1 Reading Experience

- **Max content width**: 720px for body text (optimal reading width)
- **Line height**: 1.7-1.8 for body paragraphs
- **Paragraph spacing**: `margin-bottom: 1.5rem` between paragraphs
- **Heading spacing**: `margin-top: 3rem; margin-bottom: 1rem` for h2, `margin-top: 2rem; margin-bottom: 0.75rem` for h3
- **Font size**: 18px base for article body text (16px is too small for long-form)

### 5.2 Table of Contents (Sticky Sidebar)

For articles with a "Table of Contents" section, consider rendering a sticky sidebar TOC on desktop:
- Extract all h2/h3 headings from the content
- Generate anchor links matching the heading IDs
- Highlight the current section based on scroll position (Intersection Observer)
- On mobile, render as a collapsible section at the top

### 5.3 Author Card

Display author information below the title or at the bottom:
```
[Avatar] Emily Johnson
Career Coach & Resume Expert
Published Feb 18, 2026 · 15 min read
```

Calculate reading time: `Math.ceil(wordCount / 200)` minutes.

### 5.4 Category/Tag Display

- Show primary category as a badge/chip above the title
- Show tags at the bottom of the article as clickable chips
- Link categories to `/blog/category/{slug}` listing pages
- Link tags to `/blog/tag/{slug}` listing pages

### 5.5 Social Sharing

Include share buttons for Twitter, LinkedIn, Facebook, and a copy-link button. Use the article's canonical URL.

---

## 6. Image SEO Requirements

### 6.1 All Images Must Have Alt Text

- **Featured image**: Use `featuredImage.alt` from the API
- **Inline images**: Use `value.alt` from upload nodes, fall back to `fields.caption`
- **Never leave alt empty** - if both are missing, generate from context (e.g., "Image for {article title}")

### 6.2 Image Optimization

- Use `next/image` (Next.js) or equivalent lazy-loading solution
- Serve images in WebP/AVIF where possible
- Include `width` and `height` to prevent layout shift (CLS)
- Featured images should be 1200x630 for optimal social sharing

### 6.3 Image Captions

Always render `fields.caption` from upload nodes as `<figcaption>`. Captions improve accessibility and SEO context.

---

## 7. Performance & Core Web Vitals

### 7.1 LCP (Largest Contentful Paint)

- Preload the hero/featured image: `<link rel="preload" as="image" href="...">`
- Use `priority` prop on Next.js `<Image>` for hero image
- First inline image should NOT be lazy-loaded

### 7.2 CLS (Cumulative Layout Shift)

- All images MUST have explicit `width` and `height` or `aspect-ratio`
- Use CSS `aspect-ratio: 16/9` on image containers
- Fonts should use `font-display: swap` with proper fallbacks

### 7.3 INP (Interaction to Next Paint)

- FAQ accordions should use CSS transitions, not JS animations
- Avoid blocking the main thread during content hydration
- Use `React.lazy` for below-fold components if needed

---

## 8. Google Analytics & Search Console Integration

### 8.1 Google Analytics 4 (GA4)

Ensure the GA4 tag fires on all blog pages. Track:
- `page_view` (automatic with gtag.js)
- `scroll` depth (automatic with enhanced measurement)
- Article-specific dimensions:
  ```js
  gtag('event', 'page_view', {
    article_id: article.id,
    article_category: article.categories[0]?.title,
    article_author: article.author?.name,
    article_publish_date: article.publishedAt,
  });
  ```

### 8.2 Google Search Console

- Ensure `sitemap.xml` includes all published article URLs
- Sitemap format:
  ```xml
  <url>
    <loc>https://{domain}/blog/{slug}</loc>
    <lastmod>{updatedAt}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>{featuredImage absolute URL}</image:loc>
      <image:caption>{featuredImage.alt}</image:caption>
    </image:image>
  </url>
  ```

- Generate sitemap dynamically by querying: `GET /api/articles?where[status][equals]=published&where[site][equals]={siteId}&limit=1000&depth=1`
- Include `robots.txt` with sitemap reference:
  ```
  User-agent: *
  Allow: /
  Sitemap: https://{domain}/sitemap.xml
  ```

---

## 9. RSS Feed

Generate an RSS/Atom feed at `/blog/feed.xml` or `/rss.xml`:

```xml
<rss version="2.0">
  <channel>
    <title>{siteName} Blog</title>
    <link>https://{domain}/blog</link>
    <description>{site description}</description>
    <item>
      <title>{article.title}</title>
      <link>https://{domain}/blog/{article.slug}</link>
      <description>{article.excerpt}</description>
      <pubDate>{article.publishedAt as RFC 822}</pubDate>
      <guid>https://{domain}/blog/{article.slug}</guid>
      <category>{categories[0].title}</category>
    </item>
  </channel>
</rss>
```

---

## 10. Category & Tag Listing Pages

### 10.1 Category Pages (`/blog/category/{slug}`)

- Query: `GET /api/articles?where[categories][in]={categoryId}&where[site][equals]={siteId}&where[status][equals]=published&sort=-publishedAt`
- Display article cards with: featured image, title, excerpt, author, date, category badge
- Include pagination
- Meta title: `{Category Title} Articles | {siteName} Blog`

### 10.2 Tag Pages (`/blog/tag/{slug}`)

- Query: `GET /api/articles?where[tags][in]={tagId}&where[site][equals]={siteId}&where[status][equals]=published&sort=-publishedAt`
- Similar layout to category pages
- Meta title: `Articles tagged "{tag.name}" | {siteName} Blog`

### 10.3 Blog Index (`/blog`)

- Query all published articles for the site, sorted by `-publishedAt`
- Grid/list layout with featured images, excerpts
- Filter by category (sidebar or tabs)
- Paginate (12-16 articles per page)

---

## 11. Payload CMS API Field Reference

### Articles Collection Fields

| Field | Type | Description | SEO Use |
|-------|------|-------------|---------|
| `title` | text | Article headline | `<title>` fallback, og:title fallback |
| `slug` | text | URL slug | URL path segment |
| `excerpt` | textarea | Summary (150-160 chars ideal) | meta description fallback |
| `featuredImage` | upload (media) | Card/social image (1200x630) | og:image, twitter:image |
| `heroImage` | upload (media) | Full-width hero background | Page hero section |
| `content` | richText (Lexical) | Article body | Main content rendering |
| `categories` | relationship[] | Article categories | Breadcrumbs, og:section |
| `tags` | relationship[] | Article tags | Keywords, article:tag |
| `author` | relationship | Article author | author meta, schema.org |
| `site` | relationship | Which blog site | Multi-tenant filtering |
| `status` | select | draft/published | Only render published |
| `publishedAt` | date | Publication date | datePublished, sorting |
| `metaTitle` | text | Custom SEO title (50-60 chars) | `<title>`, og:title |
| `metaDescription` | textarea | Custom SEO description (150-160 chars) | meta description, og:description |
| `focusKeyword` | text | Primary SEO keyword | Internal SEO scoring |
| `noIndex` | checkbox | Prevent search indexing | robots meta |
| `canonicalUrl` | text | Custom canonical URL | `<link rel="canonical">` |
| `structuredData` | json | Custom JSON-LD override | Schema.org override |
| `seoScore` | number (read-only) | SEO quality score 0-100 | Internal dashboard |
| `seoGrade` | text (read-only) | Letter grade A-F | Internal dashboard |

### Media Fields (for image SEO)

| Field | Description |
|-------|-------------|
| `url` | Relative path to file |
| `alt` | Alt text for accessibility/SEO |
| `width` | Image width in pixels |
| `height` | Image height in pixels |
| `filename` | Original filename |
| `mimeType` | File MIME type |

**Absolute image URL construction**: `https://cms.{site-domain}{media.url}`

---

## 12. Checklist for Frontend Developers

Before launching any blog frontend, verify:

- [ ] `<title>` uses `metaTitle` with fallback to `title + siteName`
- [ ] `<meta name="description">` uses `metaDescription` with fallback to `excerpt`
- [ ] `<link rel="canonical">` is present on every article page
- [ ] Open Graph tags (og:title, og:description, og:image, og:type) are complete
- [ ] Twitter Card tags are present
- [ ] JSON-LD Article structured data is in `<head>`
- [ ] JSON-LD FAQ structured data is generated when FAQ section exists
- [ ] JSON-LD Breadcrumb structured data is present
- [ ] All images have non-empty `alt` attributes
- [ ] Featured image is preloaded for LCP
- [ ] All images have explicit `width` and `height`
- [ ] Headings generate anchor IDs for in-page navigation
- [ ] Blockquotes render with distinct visual styling
- [ ] Horizontal rules render as styled section dividers
- [ ] FAQ section renders as accordion/collapsible
- [ ] `sitemap.xml` includes all published articles with images
- [ ] `robots.txt` references sitemap
- [ ] RSS feed is available
- [ ] GA4 fires page_view with article metadata
- [ ] Category listing pages work at `/blog/category/{slug}`
- [ ] Tag listing pages work at `/blog/tag/{slug}`
- [ ] Blog index page shows all articles with pagination
- [ ] Reading time is calculated and displayed
- [ ] Author card with name, bio, avatar is shown
- [ ] Social share buttons are functional
- [ ] Mobile responsive (320px-768px tested)
- [ ] Core Web Vitals pass (LCP < 2.5s, CLS < 0.1, INP < 200ms)

---

*This document should be provided to every frontend developer working on any blog site that consumes the Payload CMS API. The Payload backend provides all the data needed — the frontend is responsible for rendering it correctly for users and search engines.*
