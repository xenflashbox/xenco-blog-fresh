# Blog Platform Admin Configuration Guide

This guide is for front-end administrators connecting to the Payload CMS blog backend.

## Table of Contents

1. [CMS Overview](#cms-overview)
2. [API Endpoints](#api-endpoints)
3. [Authentication](#authentication)
4. [Collections Reference](#collections-reference)
5. [Frontend Integration](#frontend-integration)
6. [Recommended Components](#recommended-components)
7. [Multi-Site Architecture](#multi-site-architecture)
8. [Media Handling](#media-handling)
9. [Search Integration](#search-integration)
10. [Example Implementations](#example-implementations)

---

## CMS Overview

The blog platform runs on **Payload CMS 3.x** with:

- **Database**: PostgreSQL (Neon)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Search**: MeiliSearch
- **Hosting**: Vercel

### Base URL

```
Production: https://your-cms-domain.com
API Base:   https://your-cms-domain.com/api
```

---

## API Endpoints

### REST API

All collections are accessible via REST:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/articles` | GET | List articles (paginated) |
| `/api/articles?where[status][equals]=published` | GET | Published articles only |
| `/api/articles?where[site][equals]=1` | GET | Articles for specific site |
| `/api/articles?where[slug][equals]=my-article` | GET | Single article by slug |
| `/api/categories` | GET | List categories |
| `/api/tags` | GET | List tags |
| `/api/authors` | GET | List authors |
| `/api/media` | GET | List media files |
| `/api/sites` | GET | List sites |
| `/api/search-articles?q=keyword` | GET | MeiliSearch articles |

### Query Parameters

```typescript
// Pagination
?limit=10&page=1

// Filtering
?where[field][operator]=value

// Operators: equals, not_equals, in, not_in, exists,
//            greater_than, less_than, like, contains

// Sorting
?sort=field        // ascending
?sort=-field       // descending

// Depth (resolve relationships)
?depth=1           // resolve 1 level of relationships
?depth=2           // resolve 2 levels

// Field selection
?select[title]=true&select[slug]=true
```

### Example: Fetch Published Articles for Site

```typescript
const response = await fetch(
  `${CMS_URL}/api/articles?` + new URLSearchParams({
    'where[status][equals]': 'published',
    'where[site][equals]': String(siteId),
    'sort': '-publishedAt',
    'depth': '2',
    'limit': '10'
  }),
  {
    headers: {
      'Authorization': `users API-Key ${API_KEY}`
    }
  }
);

const { docs, totalDocs, totalPages, page } = await response.json();
```

---

## Authentication

### API Key Authentication

The CMS supports API key authentication for server-to-server requests:

```typescript
headers: {
  'Authorization': 'users API-Key YOUR_API_KEY_HERE'
}
```

To obtain an API key:
1. Log into the CMS admin panel
2. Go to Users collection
3. Edit your user
4. Enable "API Key" toggle
5. Copy the generated key

### Public Access

Published articles, categories, tags, and media are publicly readable. No authentication required for:

```typescript
// Public endpoints (read-only)
GET /api/articles?where[status][equals]=published
GET /api/categories
GET /api/tags
GET /api/media
GET /api/authors
```

---

## Collections Reference

### Articles

The main content collection for blog posts.

```typescript
interface Article {
  id: number;
  title: string;
  slug: string;
  excerpt?: string;
  featuredImage?: Media;     // Card/social image (1200x630 recommended)
  heroImage?: Media;         // Full-width hero background
  content?: LexicalContent;  // Rich text (Lexical JSON)
  categories?: Category[];
  tags?: Tag[];
  author?: Author;
  site: Site;
  status: 'draft' | 'published';
  publishedAt?: string;      // ISO date string
  updatedAt: string;
  createdAt: string;
}
```

**Key Notes:**
- `slug` is unique per site (same slug can exist on different sites)
- `content` is Lexical rich-text JSON (see [Rendering Content](#rendering-lexical-content))
- `featuredImage` vs `heroImage`: Use featuredImage for cards/listings, heroImage for article page backgrounds
- Only `status: 'published'` articles should be shown on frontend

### Categories

```typescript
interface Category {
  id: number;
  title: string;
  slug: string;
  description?: string;
  site: Site;
}
```

### Tags

```typescript
interface Tag {
  id: number;
  name: string;
  slug: string;
  site: Site;
}
```

### Authors

```typescript
interface Author {
  id: number;
  name: string;
  slug: string;
  bio?: string;
  avatar?: Media;
  website?: string;
  site: Site;
  isDefault?: boolean;  // Default author for the site
}
```

### Sites (Multi-Tenant)

```typescript
interface Site {
  id: number;
  name: string;
  slug: string;
  domains?: { domain: string }[];  // e.g., "myblog.com"
  isDefault?: boolean;
}
```

### Media

```typescript
interface Media {
  id: number;
  site?: Site;
  alt: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}
```

**Media URLs**: Images are served from R2 storage. The `url` field contains the full URL.

---

## Frontend Integration

### Recommended Tech Stack

Based on the Payload website template:

- **Framework**: Next.js 14+ (App Router)
- **Styling**: TailwindCSS
- **Components**: shadcn/ui
- **Rich Text**: `@payloadcms/richtext-lexical/react`

### Install Required Packages

```bash
npm install @payloadcms/richtext-lexical
```

### Create API Client

```typescript
// lib/api.ts
const CMS_URL = process.env.CMS_URL || 'https://your-cms.com';
const API_KEY = process.env.CMS_API_KEY;

interface FetchOptions {
  siteId?: number;
  limit?: number;
  page?: number;
  depth?: number;
  where?: Record<string, any>;
  sort?: string;
}

export async function fetchArticles(options: FetchOptions = {}) {
  const { siteId, limit = 10, page = 1, depth = 2, sort = '-publishedAt' } = options;

  const params = new URLSearchParams({
    'where[status][equals]': 'published',
    'sort': sort,
    'depth': String(depth),
    'limit': String(limit),
    'page': String(page),
  });

  if (siteId) {
    params.set('where[site][equals]', String(siteId));
  }

  const res = await fetch(`${CMS_URL}/api/articles?${params}`, {
    headers: API_KEY ? { 'Authorization': `users API-Key ${API_KEY}` } : {},
    next: { revalidate: 60 }, // ISR: revalidate every 60 seconds
  });

  if (!res.ok) throw new Error('Failed to fetch articles');
  return res.json();
}

export async function fetchArticleBySlug(slug: string, siteId?: number) {
  const params = new URLSearchParams({
    'where[slug][equals]': slug,
    'where[status][equals]': 'published',
    'depth': '2',
    'limit': '1',
  });

  if (siteId) {
    params.set('where[site][equals]', String(siteId));
  }

  const res = await fetch(`${CMS_URL}/api/articles?${params}`, {
    headers: API_KEY ? { 'Authorization': `users API-Key ${API_KEY}` } : {},
    next: { revalidate: 60 },
  });

  const { docs } = await res.json();
  return docs[0] || null;
}

export async function fetchCategories(siteId?: number) {
  const params = new URLSearchParams({ depth: '0' });
  if (siteId) params.set('where[site][equals]', String(siteId));

  const res = await fetch(`${CMS_URL}/api/categories?${params}`, {
    next: { revalidate: 300 },
  });
  return res.json();
}

export async function searchArticles(query: string, siteId?: number) {
  const params = new URLSearchParams({ q: query });
  if (siteId) params.set('siteId', String(siteId));

  const res = await fetch(`${CMS_URL}/api/search-articles?${params}`);
  return res.json();
}
```

---

## Recommended Components

### From Payload Website Template

These components from the Payload website template are highly recommended for adoption:

#### 1. Card Component

Display article cards in listings.

```typescript
// components/Card.tsx
import Link from 'next/link';
import { Media } from './Media';
import type { Article, Category } from '@/types';

interface CardProps {
  article: Article;
  showCategories?: boolean;
}

export function Card({ article, showCategories = true }: CardProps) {
  const { slug, title, excerpt, featuredImage, categories } = article;

  return (
    <article className="border border-border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-shadow">
      {featuredImage && (
        <div className="relative aspect-[16/9]">
          <Media resource={featuredImage} fill className="object-cover" />
        </div>
      )}
      <div className="p-4">
        {showCategories && categories?.length > 0 && (
          <div className="text-sm text-muted-foreground mb-2">
            {categories.map((cat, i) => (
              <span key={typeof cat === 'object' ? cat.id : cat}>
                {typeof cat === 'object' ? cat.title : cat}
                {i < categories.length - 1 && ', '}
              </span>
            ))}
          </div>
        )}
        <h3 className="text-lg font-semibold mb-2">
          <Link href={`/articles/${slug}`} className="hover:underline">
            {title}
          </Link>
        </h3>
        {excerpt && <p className="text-muted-foreground line-clamp-2">{excerpt}</p>}
      </div>
    </article>
  );
}
```

#### 2. Media Component

Handle images and videos from the CMS.

```typescript
// components/Media.tsx
import Image from 'next/image';
import type { Media as MediaType } from '@/types';

interface MediaProps {
  resource?: MediaType | number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

export function Media({ resource, fill, className, sizes, priority }: MediaProps) {
  if (!resource || typeof resource === 'number') return null;

  const { url, alt, width, height, mimeType } = resource;

  if (!url) return null;

  // Handle video
  if (mimeType?.includes('video')) {
    return (
      <video
        src={url}
        controls
        className={className}
        style={fill ? { objectFit: 'cover', width: '100%', height: '100%' } : undefined}
      />
    );
  }

  // Handle image
  if (fill) {
    return (
      <Image
        src={url}
        alt={alt || ''}
        fill
        className={className}
        sizes={sizes || '100vw'}
        priority={priority}
      />
    );
  }

  return (
    <Image
      src={url}
      alt={alt || ''}
      width={width || 800}
      height={height || 600}
      className={className}
      sizes={sizes}
      priority={priority}
    />
  );
}
```

#### 3. Collection Archive

Grid layout for article listings.

```typescript
// components/CollectionArchive.tsx
import { Card } from './Card';
import type { Article } from '@/types';

interface CollectionArchiveProps {
  articles: Article[];
  showCategories?: boolean;
}

export function CollectionArchive({ articles, showCategories = true }: CollectionArchiveProps) {
  if (!articles?.length) {
    return <p className="text-muted-foreground">No articles found.</p>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {articles.map((article) => (
        <Card
          key={article.id}
          article={article}
          showCategories={showCategories}
        />
      ))}
    </div>
  );
}
```

#### 4. Post Hero

Full-width hero section for article pages.

```typescript
// components/PostHero.tsx
import { Media } from './Media';
import { formatDate } from '@/lib/utils';
import type { Article } from '@/types';

export function PostHero({ article }: { article: Article }) {
  const { title, heroImage, author, categories, publishedAt } = article;

  return (
    <div className="relative min-h-[60vh] flex items-end">
      {/* Background Image */}
      {heroImage && typeof heroImage !== 'number' && (
        <>
          <div className="absolute inset-0">
            <Media resource={heroImage} fill className="object-cover" priority />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        </>
      )}

      {/* Content */}
      <div className="container relative z-10 pb-12 text-white">
        {/* Categories */}
        {categories?.length > 0 && (
          <div className="text-sm uppercase tracking-wide mb-4 opacity-80">
            {categories.map((cat, i) => (
              <span key={typeof cat === 'object' ? cat.id : cat}>
                {typeof cat === 'object' ? cat.title : ''}
                {i < categories.length - 1 && ' / '}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 max-w-4xl">
          {title}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap gap-6 text-sm">
          {author && typeof author !== 'number' && (
            <div>
              <span className="opacity-60">By</span> {author.name}
            </div>
          )}
          {publishedAt && (
            <time dateTime={publishedAt}>
              {formatDate(publishedAt)}
            </time>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### 5. Rich Text Renderer

Render Lexical content from the CMS.

```typescript
// components/RichText.tsx
import {
  RichText as PayloadRichText,
  JSXConvertersFunction,
  LinkJSXConverter,
  DefaultNodeTypes,
} from '@payloadcms/richtext-lexical/react';
import { cn } from '@/lib/utils';

const jsxConverters: JSXConvertersFunction<DefaultNodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({
    internalDocToHref: ({ linkNode }) => {
      const { value, relationTo } = linkNode.fields.doc || {};
      if (typeof value !== 'object') return '#';
      return relationTo === 'articles' ? `/articles/${value.slug}` : `/${value.slug}`;
    },
  }),
});

interface RichTextProps {
  data: any;
  className?: string;
  enableProse?: boolean;
}

export function RichText({ data, className, enableProse = true }: RichTextProps) {
  if (!data) return null;

  return (
    <PayloadRichText
      data={data}
      converters={jsxConverters}
      className={cn(
        enableProse && 'prose prose-lg dark:prose-invert max-w-none',
        className
      )}
    />
  );
}
```

---

## Multi-Site Architecture

The CMS supports multiple sites/blogs from a single installation.

### Site Resolution

Sites can be identified by:

1. **Site ID**: Direct numeric ID
2. **Site Slug**: URL-friendly identifier
3. **Domain**: Custom domain mapping

### Frontend Implementation

```typescript
// lib/site.ts
import { headers } from 'next/headers';

export async function getCurrentSite() {
  const headersList = headers();
  const host = headersList.get('host') || '';

  // Fetch site by domain
  const res = await fetch(`${CMS_URL}/api/sites?where[domains.domain][equals]=${host}&limit=1`);
  const { docs } = await res.json();

  if (docs[0]) return docs[0];

  // Fallback to default site
  const defaultRes = await fetch(`${CMS_URL}/api/sites?where[isDefault][equals]=true&limit=1`);
  const { docs: defaultDocs } = await defaultRes.json();

  return defaultDocs[0] || null;
}
```

### Filtering Content by Site

Always filter content by site ID:

```typescript
// app/articles/page.tsx
export default async function ArticlesPage() {
  const site = await getCurrentSite();
  const { docs: articles } = await fetchArticles({ siteId: site?.id });

  return <CollectionArchive articles={articles} />;
}
```

---

## Media Handling

### Image URLs

Media URLs are full URLs pointing to R2 storage:

```
https://pub-xxxxx.r2.dev/media/filename.jpg
```

### Next.js Image Configuration

Add the R2 domain to your `next.config.js`:

```javascript
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-*.r2.dev',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
      },
    ],
  },
};
```

### Recommended Image Sizes

| Usage | Size | Aspect |
|-------|------|--------|
| Featured Image | 1200x630 | 1.91:1 (OG/Social) |
| Hero Image | 1920x1080 | 16:9 |
| Thumbnail | 400x300 | 4:3 |
| Avatar | 200x200 | 1:1 |

---

## Search Integration

### MeiliSearch Endpoint

The CMS exposes a search endpoint powered by MeiliSearch:

```typescript
// Search articles
const response = await fetch(`${CMS_URL}/api/search-articles?q=${encodeURIComponent(query)}`);
const results = await response.json();
```

### Search Component Example

```typescript
// components/SearchBar.tsx
'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import Link from 'next/link';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (!debouncedQuery) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(res => res.json())
      .then(data => {
        setResults(data.hits || []);
        setIsLoading(false);
      });
  }, [debouncedQuery]);

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search articles..."
        className="w-full px-4 py-2 border rounded-lg"
      />

      {results.length > 0 && (
        <ul className="absolute top-full left-0 right-0 bg-white border rounded-lg mt-1 shadow-lg">
          {results.map((result: any) => (
            <li key={result.id}>
              <Link
                href={`/articles/${result.slug}`}
                className="block px-4 py-2 hover:bg-gray-100"
              >
                {result.title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## Example Implementations

### Article Listing Page

```typescript
// app/articles/page.tsx
import { fetchArticles } from '@/lib/api';
import { CollectionArchive } from '@/components/CollectionArchive';
import { Pagination } from '@/components/Pagination';

interface Props {
  searchParams: { page?: string };
}

export default async function ArticlesPage({ searchParams }: Props) {
  const page = Number(searchParams.page) || 1;
  const { docs, totalPages } = await fetchArticles({ page, limit: 12 });

  return (
    <main className="container py-12">
      <h1 className="text-4xl font-bold mb-8">Articles</h1>
      <CollectionArchive articles={docs} />
      <Pagination currentPage={page} totalPages={totalPages} />
    </main>
  );
}
```

### Single Article Page

```typescript
// app/articles/[slug]/page.tsx
import { fetchArticleBySlug, fetchArticles } from '@/lib/api';
import { PostHero } from '@/components/PostHero';
import { RichText } from '@/components/RichText';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  const { docs } = await fetchArticles({ limit: 100 });
  return docs.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await fetchArticleBySlug(params.slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      images: article.featuredImage?.url ? [article.featuredImage.url] : [],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const article = await fetchArticleBySlug(params.slug);

  if (!article) notFound();

  return (
    <article>
      <PostHero article={article} />
      <div className="container py-12">
        <RichText data={article.content} className="max-w-3xl mx-auto" />
      </div>
    </article>
  );
}
```

### Category Page

```typescript
// app/categories/[slug]/page.tsx
import { fetchArticles, fetchCategories } from '@/lib/api';
import { CollectionArchive } from '@/components/CollectionArchive';
import { notFound } from 'next/navigation';

interface Props {
  params: { slug: string };
}

export default async function CategoryPage({ params }: Props) {
  const { docs: categories } = await fetchCategories();
  const category = categories.find((c) => c.slug === params.slug);

  if (!category) notFound();

  const { docs: articles } = await fetchArticles({
    where: { 'categories.slug': { equals: params.slug } },
  });

  return (
    <main className="container py-12">
      <h1 className="text-4xl font-bold mb-4">{category.title}</h1>
      {category.description && (
        <p className="text-muted-foreground mb-8">{category.description}</p>
      )}
      <CollectionArchive articles={articles} showCategories={false} />
    </main>
  );
}
```

---

## Environment Variables

Required environment variables for your frontend:

```bash
# .env.local

# CMS URL (no trailing slash)
CMS_URL=https://your-cms-domain.com

# Optional: API key for authenticated requests
CMS_API_KEY=your-api-key-here

# Site ID (if not using domain resolution)
SITE_ID=1
```

---

## Troubleshooting

### Common Issues

1. **"Invalid Date" in publishedAt**
   - Some articles may have null `publishedAt` until first publish
   - Always check: `publishedAt && formatDate(publishedAt)`

2. **Images not loading**
   - Verify R2 domain is in `next.config.js` remotePatterns
   - Check if `url` field exists on media object

3. **Categories/Tags showing as IDs**
   - Increase `depth` parameter in API call
   - `depth=2` resolves nested relationships

4. **Content not appearing**
   - Check article `status` is `'published'`
   - Verify `site` filter matches your site ID

5. **CORS errors**
   - API should be configured to allow your frontend domain
   - Contact CMS admin if experiencing CORS issues

---

## Support

For CMS configuration issues, contact your Payload CMS administrator.

For frontend implementation questions, refer to:
- [Payload CMS Documentation](https://payloadcms.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Lexical Rich Text](https://payloadcms.com/docs/rich-text/overview)
