# Multi-Site Blog Setup Guide

This guide explains how to set up a new blog site with full Meilisearch integration, including:
- Blog article search
- Related articles
- Auto-sync to Meilisearch index
- LLM-powered synonym generation
- Internal linking suggestions

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     PAYLOAD CMS (Shared)                        │
│  - Single instance serves ALL sites                             │
│  - Articles collection with site field                          │
│  - Meilisearch sync hooks (auto-sync on publish)               │
│  - Synonym generation webhook (triggers on article save)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MEILISEARCH (Shared)                         │
│  - Single "articles" index for ALL sites                       │
│  - Each article has site.slug field                            │
│  - Filtering by site.slug isolates each site's articles        │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ ResumeCoach  │      │  BlogCraft   │      │  FightClub   │
│  Frontend    │      │  Frontend    │      │  Frontend    │
│              │      │              │      │              │
│ SITE_SLUG=   │      │ SITE_SLUG=   │      │ SITE_SLUG=   │
│ resume-coach │      │ blogcraft    │      │ fightclub    │
└──────────────┘      └──────────────┘      └──────────────┘
```

## What's Already Done (No Setup Needed)

These features work automatically for ALL sites:

1. **Meilisearch Sync** - When you publish an article in Payload CMS, it auto-syncs to Meilisearch
2. **Image Sync** - Featured images are automatically included in the index
3. **Synonym Generation** - LLM analyzes new terms and creates synonyms (debounced, 1/minute max)
4. **Internal Linking** - Suggestions logged in Payload CMS console

## Setup Steps for a New Site

### 1. Create Site in Payload CMS

First, create a new Site in Payload CMS admin:

```
https://cms.xencolabs.com/admin/collections/sites/create
```

Fill in:
- **Name**: Your site name (e.g., "BlogCraft")
- **Slug**: URL-safe identifier (e.g., "blogcraft") - **THIS IS CRITICAL**
- **Domain**: Your site URL (e.g., "https://blogcraft.me")

### 2. Copy Required Files from ResumeCoach

When cloning the frontend for a new site, copy these files:

```
lib/meilisearch.ts           # Search client library
components/BlogSearch.tsx    # Search component with dropdown
app/blog/search/page.tsx     # Full search results page
app/api/blog/search/route.ts # Search API endpoint
app/api/admin/meilisearch/   # Admin endpoints (resync, synonyms, configure)
```

### 3. Set Environment Variable

The ONLY thing you need to configure per-site is the `NEXT_PUBLIC_SITE_SLUG` environment variable.

#### Option A: In .env.production
```bash
NEXT_PUBLIC_SITE_SLUG=blogcraft
```

#### Option B: In build script
```bash
NEXT_PUBLIC_SITE_SLUG=blogcraft ./build-with-clerk.sh v1.0.0
```

#### Option C: In Docker stack
```yaml
services:
  blogcraft:
    environment:
      - NEXT_PUBLIC_SITE_SLUG=blogcraft
```

### 4. Build and Deploy

```bash
# Set the site slug before building
export NEXT_PUBLIC_SITE_SLUG=blogcraft

# Build with all required args
./build-with-clerk.sh v1.0.0

# Deploy
docker service update --image registry.xencolabs.com/blogcraft:v1.0.0 blogcraft_app
```

### 5. Verify Setup

After deployment, verify everything works:

```bash
# Check Meilisearch health
curl "https://blogcraft.me/api/blog/search?health=true"

# Test search (should only return blogcraft articles)
curl "https://blogcraft.me/api/blog/search?q=test"

# Trigger manual resync (if needed)
curl -X POST "https://blogcraft.me/api/admin/meilisearch/resync" \
  -H "x-api-key: admin-configure-meilisearch-2024"

# Check synonyms
curl "https://blogcraft.me/api/admin/meilisearch/synonyms"
```

## Environment Variables Reference

### Required (Build Time)
| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_SITE_SLUG` | Payload CMS site slug | `blogcraft` |

### Required (Runtime)
| Variable | Description | Example |
|----------|-------------|---------|
| `MEILISEARCH_HOST` | Meilisearch server URL | `http://meilisearch:7700` |
| `MEILISEARCH_API_KEY` | Meilisearch API key | `your-api-key` |
| `PAYLOAD_API_URL` | Payload CMS API URL | `https://cms.xencolabs.com/api` |

### Optional (for LLM Synonyms)
| Variable | Description | Example |
|----------|-------------|---------|
| `LLM_GATEWAY_URL` | LLM API endpoint | `https://llm.xencolabs.com/v1` |
| `LLM_API_KEY` | LLM API key | `sk-...` |

### Optional (Admin)
| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_API_KEY` | Admin endpoints auth | `admin-configure-meilisearch-2024` |

## API Endpoints

Each site has these endpoints available:

### Public Endpoints
- `GET /api/blog/search?q=query` - Search articles
- `GET /api/blog/search?health=true` - Check Meilisearch health

### Admin Endpoints (require x-api-key header)
- `POST /api/admin/meilisearch/resync` - Re-sync all articles to Meilisearch
- `GET /api/admin/meilisearch/resync` - Check sync status
- `GET /api/admin/meilisearch/synonyms` - Get current synonyms
- `POST /api/admin/meilisearch/synonyms?action=generate` - Generate synonyms with LLM
- `POST /api/admin/meilisearch/configure` - Configure Meilisearch index settings

## Troubleshooting

### Search returns no results
1. Check site slug matches Payload CMS exactly: `echo $NEXT_PUBLIC_SITE_SLUG`
2. Verify articles are published in Payload CMS
3. Trigger a manual resync

### Images not showing in search results
1. Ensure `featuredImage` is set in Payload CMS
2. Trigger a resync to update existing articles

### Synonyms not generating
1. Check LLM API key is configured
2. Check LLM endpoint is accessible
3. Synonym generation is debounced (max once per minute)

## Checklist for New Site

- [ ] Create site in Payload CMS with correct slug
- [ ] Copy required files from ResumeCoach
- [ ] Set `NEXT_PUBLIC_SITE_SLUG` environment variable
- [ ] Build and deploy
- [ ] Verify search works
- [ ] Publish test article and verify it appears in search
- [ ] (Optional) Configure site-specific synonyms
