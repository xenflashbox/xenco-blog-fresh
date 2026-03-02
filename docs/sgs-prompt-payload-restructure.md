# TASK: Payload CMS Collection Restructuring — Separate Content Types

## CONTEXT

The Payload CMS currently stores ALL content types (blog posts, reviews, directory entries, events, suites) in a single `articles` collection, differentiated only by category slugs. This makes the admin panel unmanageable and the data model fragile.

We are restructuring into dedicated collections:
- `articles` — Blog posts ONLY (stays as-is, but cleaned of non-blog content)
- `suites` — NEW collection for suite definitions
- `reviews` — NEW collection for guest reviews
- `directory-entries` — NEW collection for wineries, restaurants, activities
- `events` — NEW collection for calendar events

All collections are **multi-tenant** with a `site` relationship field so any Xenco Labs site can use them.

**IMPORTANT:** The Sonoma Grove Suites site ID is `10`. All content for this site uses `site: 10`.

## CRITICAL RULES

- Follow Xenco Production Standards: no mock data, no workarounds, schema-first
- Run Payload migrations after schema changes
- Validate all collections appear in the admin panel with correct fields
- Do NOT delete any existing articles until new collections are confirmed working
- Test API endpoints (`/api/suites`, `/api/reviews`, etc.) before marking complete

---

## STEP 1: Create New Collection Configs

Create these 4 files in the Payload CMS codebase. Each collection includes a `site` relationship field for multi-tenancy.

### 1A: Suites Collection

**File:** `payload/collections/Suites.ts`

```typescript
import type { CollectionConfig } from 'payload'

export const Suites: CollectionConfig = {
  slug: 'suites',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'site', 'status'],
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'tagline', type: 'text', required: true },
    { name: 'description', type: 'richText', required: true },
    { name: 'shortDescription', type: 'textarea' },
    {
      name: 'details',
      type: 'group',
      fields: [
        { name: 'bedrooms', type: 'number', required: true },
        { name: 'bathrooms', type: 'number', required: true },
        { name: 'maxGuests', type: 'number', required: true },
        { name: 'sqft', type: 'number' },
        {
          name: 'floor',
          type: 'select',
          options: [
            { label: 'Ground Floor', value: 'ground' },
            { label: 'Upper Floor', value: 'upper' },
          ],
        },
        { name: 'hasPatio', type: 'checkbox', defaultValue: false },
        { name: 'hasEnSuite', type: 'checkbox', defaultValue: false },
        { name: 'isADACompliant', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'amenities',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'icon', type: 'text' },
      ],
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'alt', type: 'text', required: true },
        { name: 'caption', type: 'text' },
        { name: 'isPrimary', type: 'checkbox', defaultValue: false },
      ],
    },
    { name: 'lodgifyPropertyId', type: 'text', required: true },
    {
      name: 'pricing',
      type: 'group',
      fields: [
        { name: 'baseNightlyRate', type: 'number' },
        { name: 'cleaningFee', type: 'number' },
        { name: 'directBookingDiscount', type: 'number' },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
      admin: { position: 'sidebar' },
    },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
}
```

### 1B: Reviews Collection

**File:** `payload/collections/Reviews.ts`

```typescript
import type { CollectionConfig } from 'payload'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'reviewerName',
    defaultColumns: ['reviewerName', 'suite', 'rating', 'date', 'site'],
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    { name: 'reviewerName', type: 'text', required: true },
    { name: 'reviewerLocation', type: 'text' },
    {
      name: 'suite',
      type: 'relationship',
      relationTo: 'suites',
      required: true,
      index: true,
    },
    { name: 'rating', type: 'number', min: 1, max: 5, required: true },
    { name: 'title', type: 'text' },
    { name: 'content', type: 'textarea', required: true },
    { name: 'date', type: 'date', required: true, index: true },
    {
      name: 'highlights',
      type: 'array',
      fields: [
        { name: 'item', type: 'text' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Airbnb', value: 'airbnb' },
        { label: 'VRBO', value: 'vrbo' },
        { label: 'Booking.com', value: 'booking' },
        { label: 'Direct', value: 'direct' },
        { label: 'Google', value: 'google' },
      ],
      defaultValue: 'direct',
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Hidden', value: 'hidden' },
      ],
      defaultValue: 'active',
      admin: { position: 'sidebar' },
    },
  ],
}
```

### 1C: Directory Entries Collection

**File:** `payload/collections/DirectoryEntries.ts`

```typescript
import type { CollectionConfig } from 'payload'

export const DirectoryEntries: CollectionConfig = {
  slug: 'directory-entries',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'subcategory', 'site', 'status'],
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'description', type: 'richText', required: true },
    { name: 'shortDescription', type: 'textarea' },
    {
      name: 'category',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Wineries & Tasting Rooms', value: 'wineries' },
        { label: 'Restaurants & Dining', value: 'restaurants' },
        { label: 'Activities & Experiences', value: 'activities' },
        { label: 'Wedding & Event Venues', value: 'venues' },
      ],
    },
    { name: 'subcategory', type: 'text' },
    {
      name: 'tags',
      type: 'array',
      fields: [
        { name: 'tag', type: 'text' },
      ],
    },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'location',
      type: 'group',
      fields: [
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'distanceFromProperty', type: 'text' },
        { name: 'driveTimeMinutes', type: 'number' },
      ],
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'website', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'text' },
      ],
    },
    {
      name: 'details',
      type: 'group',
      fields: [
        {
          name: 'priceRange',
          type: 'select',
          options: [
            { label: '$', value: '$' },
            { label: '$$', value: '$$' },
            { label: '$$$', value: '$$$' },
            { label: '$$$$', value: '$$$$' },
          ],
        },
        { name: 'hours', type: 'textarea' },
        { name: 'reservationRequired', type: 'checkbox', defaultValue: false },
        { name: 'tastingFeeRange', type: 'text' },
        { name: 'cuisineType', type: 'text' },
        { name: 'capacity', type: 'text' },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
      ],
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
      admin: { position: 'sidebar' },
    },
    { name: 'sourceUrl', type: 'text' },
    { name: 'lastCrawledAt', type: 'date' },
  ],
}
```

### 1D: Events Collection

**File:** `payload/collections/Events.ts`

```typescript
import type { CollectionConfig } from 'payload'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'category', 'site', 'status'],
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'description', type: 'richText', required: true },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    { name: 'startDate', type: 'date', required: true, index: true },
    { name: 'endDate', type: 'date' },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Music & Concerts', value: 'music' },
        { label: 'Wine & Food', value: 'wine-food' },
        { label: 'Arts & Culture', value: 'arts-culture' },
        { label: 'Seasonal', value: 'seasonal' },
        { label: 'Community', value: 'community' },
        { label: 'Festivals', value: 'festivals' },
      ],
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        { name: 'venueName', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
      ],
    },
    { name: 'externalUrl', type: 'text' },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
      ],
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Past', value: 'past' },
      ],
      defaultValue: 'active',
      admin: { position: 'sidebar' },
    },
    { name: 'sourceUrl', type: 'text' },
    { name: 'lastCrawledAt', type: 'date' },
  ],
}
```

---

## STEP 2: Register Collections in Payload Config

**File:** `payload.config.ts`

Add the new collections to the `collections` array. They should appear alongside the existing `articles`, `media`, `sites`, etc.

```typescript
import { Suites } from './collections/Suites'
import { Reviews } from './collections/Reviews'
import { DirectoryEntries } from './collections/DirectoryEntries'
import { Events } from './collections/Events'

// In the buildConfig:
collections: [
  // ... existing collections (articles, media, sites, authors, categories, tags)
  Suites,
  Reviews,
  DirectoryEntries,
  Events,
],
```

**Admin sidebar grouping:** The `group: 'Content'` on each collection will group them together in the admin panel. Consider also adding `group: 'Content'` to the existing `articles` collection config for consistency.

---

## STEP 3: Run Database Migration

After adding the collection configs, Payload needs to create the database tables.

```bash
# Generate the migration
npx payload migrate:create --name add-suites-reviews-directory-events

# Run the migration
npx payload migrate

# Verify the tables were created
psql $DATABASE_URI -c "\dt" | grep -E "suites|reviews|directory|events"
```

Expected new tables:
- `suites`
- `suites_amenities` (array field)
- `suites_images` (array field)
- `reviews`
- `reviews_highlights` (array field)
- `directory_entries` (or `directory-entries` depending on Payload version)
- `directory_entries_tags` (array field)
- `events`

---

## STEP 4: Verify API Endpoints

After migration, test that each new collection's API is accessible:

```bash
# These should all return { docs: [], totalDocs: 0, ... }
curl -s https://cms.sonomagrovesuites.com/api/suites?limit=1 | jq '.totalDocs'
curl -s https://cms.sonomagrovesuites.com/api/reviews?limit=1 | jq '.totalDocs'
curl -s https://cms.sonomagrovesuites.com/api/directory-entries?limit=1 | jq '.totalDocs'
curl -s https://cms.sonomagrovesuites.com/api/events?limit=1 | jq '.totalDocs'
```

Also verify the admin panel shows the new collections in the sidebar under "Content."

---

## STEP 5: Deploy

```bash
git add payload/collections/Suites.ts payload/collections/Reviews.ts \
        payload/collections/DirectoryEntries.ts payload/collections/Events.ts \
        payload.config.ts

git commit -m "feat(cms): add separate collections for suites, reviews, directory, events

- Suites: name, details, amenities, images, lodgifyPropertyId, pricing, SEO
- Reviews: reviewerName, suite (relationship), rating, content, source, highlights
- DirectoryEntries: name, category, location, contact, details, tags, SEO
- Events: name, dates, category, location, externalUrl, SEO
- All collections multi-tenant with site relationship field
- Articles collection remains for blog posts only"

git push origin main
```

Deploy the Payload CMS:
```bash
# Build and deploy Payload
docker build -t registry.xencolabs.com/payload-cms:latest .
docker push registry.xencolabs.com/payload-cms:latest
docker service update --force --image registry.xencolabs.com/payload-cms:latest payload_payload-app

# Wait for healthy replicas
watch -n 5 'docker service ps payload_payload-app --filter desired-state=running'

# Run migration on the running container
docker exec $(docker ps -q -f name=payload_payload-app) npx payload migrate
```

---

## STEP 6: Verification Checklist

After deployment:

```bash
# 1. Admin panel loads all 4 new collections
curl -sI https://cms.sonomagrovesuites.com/admin | grep HTTP
# → 200

# 2. Each API endpoint responds
curl -s https://cms.sonomagrovesuites.com/api/suites | jq '.totalDocs'
# → 0

curl -s https://cms.sonomagrovesuites.com/api/reviews | jq '.totalDocs'
# → 0

curl -s https://cms.sonomagrovesuites.com/api/directory-entries | jq '.totalDocs'
# → 0

curl -s https://cms.sonomagrovesuites.com/api/events | jq '.totalDocs'
# → 0

# 3. Existing articles collection still works
curl -s https://cms.sonomagrovesuites.com/api/articles?limit=1 | jq '.totalDocs'
# → should be 91 (or whatever the current count is)

# 4. Database tables exist
docker exec $(docker ps -q -f name=payload-postgres) \
  psql -U payload -d payload -c "\dt" | grep -E "suites|reviews|directory|events"
```

**DO NOT proceed to data upload until ALL 4 checks pass.**

---

## WHAT HAPPENS NEXT (Do NOT do these — separate prompts will be provided)

After this restructuring is confirmed working, separate prompts will handle:

1. **Frontend `payload.ts` update** — Rewrite the SGS data layer to query `/api/suites`, `/api/reviews`, `/api/directory-entries`, `/api/events` instead of filtering articles by category slug
2. **Suite data seed** — Upload the 3 suites (Cabernet, Pinot, Chardonnay) with proper typed fields and image arrays
3. **Review data re-upload** — Upload ~168 guest reviews with suite relationships
4. **Directory entry re-upload** — Upload ~40 wineries/restaurants/activities with structured location/contact data
5. **Event data re-upload** — Upload ~22 events with proper date fields
6. **Articles cleanup** — Remove non-blog articles from the `articles` collection (reviews, suites, events, directory entries that were stored as articles)

These are SEPARATE tasks. This prompt only creates the empty collections and verifies they work.
