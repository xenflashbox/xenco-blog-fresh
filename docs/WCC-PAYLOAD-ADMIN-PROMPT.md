# Payload Admin Prompt — Create WCC Collections
## Wine Country Corner · Site ID: 2

You are working inside the Payload CMS codebase (the shared multi-tenant Payload instance
that serves multiple sites). Your job is to add six new collections for the Wine Country 
Corner site (ID=2) and redeploy Payload.

## CRITICAL VALUES
- Wine Country Corner Site ID: 2
- Site slug: wine-country-corner
- All new collections must have a `site` relationship field
- Collections must NOT conflict with any existing collection slugs

## MANDATORY GIT RULES
git pull before starting.
git add -A && git commit -m "message" && git push after each step.
Verify Payload redeploys and admin is accessible at cms.winecountrycorner.com before finishing.

---

## Step 1 — Locate the Payload collections directory

Find where existing collections are defined. It will be something like:
  src/collections/ or collections/
  
List what collections already exist so you don't duplicate slugs.

---

## Step 2 — Create src/collections/Wineries.ts

```typescript
import type { CollectionConfig } from "payload"

export const Wineries: CollectionConfig = {
  slug: "wineries",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "region", "featuredTier", "site"],
    group: "Wine Country Corner",
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: "site",
      type: "relationship",
      relationTo: "sites",
      required: true,
      admin: { position: "sidebar" },
    },
    {
      name: "name",
      type: "text",
      required: true,
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { position: "sidebar" },
    },
    {
      name: "website",
      type: "text",
    },
    {
      name: "region",
      type: "select",
      options: [
        { label: "Napa Valley", value: "Napa Valley" },
        { label: "Sonoma County", value: "Sonoma County" },
        { label: "Coombsville AVA", value: "Coombsville AVA" },
        { label: "Stags Leap District", value: "Stags Leap District" },
        { label: "Other", value: "Other" },
      ],
    },
    {
      name: "subAppellation",
      type: "text",
      label: "Sub-Appellation",
    },
    {
      name: "varietalFocus",
      type: "array",
      label: "Varietal Focus",
      fields: [{ name: "varietal", type: "text" }],
    },
    {
      name: "tastingAvailable",
      type: "checkbox",
      label: "Tastings Available",
      defaultValue: false,
    },
    {
      name: "tastingBookingUrl",
      type: "text",
      label: "Tasting Booking URL",
    },
    {
      name: "wineClubEnabled",
      type: "checkbox",
      label: "Wine Club",
      defaultValue: false,
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar" },
    },
    {
      name: "featuredTier",
      type: "select",
      label: "Featured Tier",
      admin: { position: "sidebar" },
      options: [
        { label: "Flagship", value: "flagship" },
        { label: "Featured", value: "featured" },
        { label: "Listed", value: "listed" },
      ],
    },
    {
      name: "featuredOrder",
      type: "number",
      label: "Featured Order",
      admin: { position: "sidebar" },
    },
    {
      name: "featuredHero",
      type: "upload",
      relationTo: "media",
      label: "Hero Image",
    },
    {
      name: "featuredStory",
      type: "richText",
      label: "Editorial Story",
    },
    {
      name: "featuredQuote",
      type: "text",
      label: "Pull Quote",
    },
    {
      name: "featuredQuoteAttribution",
      type: "text",
      label: "Quote Attribution",
    },
    {
      name: "phone",
      type: "text",
    },
    {
      name: "email",
      type: "email",
    },
    {
      name: "instagramHandle",
      type: "text",
      label: "Instagram Handle",
    },
    {
      name: "address",
      type: "group",
      fields: [
        { name: "street", type: "text" },
        { name: "city", type: "text" },
        { name: "state", type: "text" },
        { name: "zip", type: "text" },
      ],
    },
    {
      name: "coordinates",
      type: "group",
      fields: [
        { name: "lat", type: "number" },
        { name: "lng", type: "number" },
      ],
    },
    {
      name: "partnerSince",
      type: "date",
      label: "Partner Since",
    },
  ],
  timestamps: true,
}
```

---

## Step 3 — Create src/collections/Wines.ts

```typescript
import type { CollectionConfig } from "payload"

export const Wines: CollectionConfig = {
  slug: "wines",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "winery", "varietal", "vintage"],
    group: "Wine Country Corner",
  },
  access: { read: () => true },
  fields: [
    {
      name: "site",
      type: "relationship",
      relationTo: "sites",
      required: true,
      admin: { position: "sidebar" },
    },
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, admin: { position: "sidebar" } },
    {
      name: "winery",
      type: "relationship",
      relationTo: "wineries",
    },
    { name: "varietal", type: "text" },
    { name: "vintage", type: "number" },
    { name: "tastingNotes", type: "textarea", label: "Tasting Notes" },
    { name: "price", type: "number" },
    {
      name: "priceTier",
      type: "select",
      label: "Price Tier",
      options: [
        { label: "Under $50", value: "under-50" },
        { label: "$50–$100", value: "50-100" },
        { label: "$100–$200", value: "100-200" },
        { label: "Over $200", value: "over-200" },
      ],
    },
    { name: "rating", type: "number" },
    { name: "purchaseUrl", type: "text", label: "Purchase URL" },
    { name: "image", type: "upload", relationTo: "media" },
    { name: "featured", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
  ],
  timestamps: true,
}
```

---

## Step 4 — Create src/collections/Restaurants.ts

```typescript
import type { CollectionConfig } from "payload"

export const Restaurants: CollectionConfig = {
  slug: "restaurants",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "city", "priceRange", "featuredTier"],
    group: "Wine Country Corner",
  },
  access: { read: () => true },
  fields: [
    {
      name: "site",
      type: "relationship",
      relationTo: "sites",
      required: true,
      admin: { position: "sidebar" },
    },
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, admin: { position: "sidebar" } },
    { name: "website", type: "text" },
    {
      name: "region",
      type: "select",
      options: [
        { label: "Napa Valley", value: "Napa Valley" },
        { label: "Sonoma County", value: "Sonoma County" },
        { label: "Other", value: "Other" },
      ],
    },
    { name: "city", type: "text" },
    {
      name: "cuisineType",
      type: "array",
      label: "Cuisine Type",
      fields: [{ name: "cuisine", type: "text" }],
    },
    {
      name: "priceRange",
      type: "select",
      label: "Price Range",
      options: [
        { label: "$", value: "$" },
        { label: "$$", value: "$$" },
        { label: "$$$", value: "$$$" },
        { label: "$$$$", value: "$$$$" },
      ],
    },
    { name: "wineFocused", type: "checkbox", label: "Wine Focused", defaultValue: false },
    { name: "reservationsUrl", type: "text", label: "Reservations URL" },
    {
      name: "address",
      type: "group",
      fields: [
        { name: "street", type: "text" },
        { name: "city", type: "text" },
        { name: "state", type: "text" },
        { name: "zip", type: "text" },
      ],
    },
    { name: "phone", type: "text" },
    { name: "hours", type: "text" },
    { name: "featuredImage", type: "upload", relationTo: "media", label: "Featured Image" },
    { name: "featured", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
    {
      name: "featuredTier",
      type: "select",
      label: "Featured Tier",
      admin: { position: "sidebar" },
      options: [
        { label: "Flagship", value: "flagship" },
        { label: "Featured", value: "featured" },
        { label: "Listed", value: "listed" },
      ],
    },
    { name: "description", type: "textarea" },
  ],
  timestamps: true,
}
```

---

## Step 5 — Create src/collections/Accommodations.ts

```typescript
import type { CollectionConfig } from "payload"

export const Accommodations: CollectionConfig = {
  slug: "accommodations",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "city", "type", "isOwned", "featuredTier"],
    group: "Wine Country Corner",
  },
  access: { read: () => true },
  fields: [
    {
      name: "site",
      type: "relationship",
      relationTo: "sites",
      required: true,
      admin: { position: "sidebar" },
    },
    { name: "name", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, admin: { position: "sidebar" } },
    { name: "website", type: "text" },
    {
      name: "region",
      type: "select",
      options: [
        { label: "Napa Valley", value: "Napa Valley" },
        { label: "Sonoma County", value: "Sonoma County" },
        { label: "Other", value: "Other" },
      ],
    },
    { name: "city", type: "text" },
    {
      name: "type",
      type: "select",
      options: [
        { label: "Hotel", value: "hotel" },
        { label: "Bed & Breakfast", value: "bb" },
        { label: "Vacation Rental", value: "vacation-rental" },
        { label: "Resort", value: "resort" },
        { label: "Inn", value: "inn" },
      ],
    },
    {
      name: "priceRange",
      type: "select",
      label: "Price Range",
      options: [
        { label: "$", value: "$" },
        { label: "$$", value: "$$" },
        { label: "$$$", value: "$$$" },
        { label: "$$$$", value: "$$$$" },
      ],
    },
    { name: "bookingUrl", type: "text", label: "Booking URL" },
    {
      name: "address",
      type: "group",
      fields: [
        { name: "street", type: "text" },
        { name: "city", type: "text" },
        { name: "state", type: "text" },
        { name: "zip", type: "text" },
      ],
    },
    { name: "phone", type: "text" },
    {
      name: "amenities",
      type: "array",
      fields: [{ name: "amenity", type: "text" }],
    },
    { name: "featuredImage", type: "upload", relationTo: "media", label: "Featured Image" },
    { name: "featured", type: "checkbox", defaultValue: false, admin: { position: "sidebar" } },
    {
      name: "featuredTier",
      type: "select",
      label: "Featured Tier",
      admin: { position: "sidebar" },
      options: [
        { label: "Flagship", value: "flagship" },
        { label: "Featured", value: "featured" },
        { label: "Listed", value: "listed" },
      ],
    },
    { name: "description", type: "textarea" },
    {
      name: "isOwned",
      type: "checkbox",
      label: "WCC Owned/Partner Property",
      defaultValue: false,
      admin: { position: "sidebar", description: "Check for Sonoma Grove Suites — appears first in listings." },
    },
  ],
  timestamps: true,
}
```

---

## Step 6 — Create src/collections/WineryEvents.ts

```typescript
import type { CollectionConfig } from "payload"

export const WineryEvents: CollectionConfig = {
  slug: "winery-events",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "winery", "eventType", "startDate"],
    group: "Wine Country Corner",
  },
  access: { read: () => true },
  fields: [
    {
      name: "site",
      type: "relationship",
      relationTo: "sites",
      required: true,
      admin: { position: "sidebar" },
    },
    { name: "title", type: "text", required: true },
    { name: "slug", type: "text", required: true, unique: true, admin: { position: "sidebar" } },
    {
      name: "winery",
      type: "relationship",
      relationTo: "wineries",
    },
    {
      name: "eventType",
      type: "select",
      label: "Event Type",
      options: [
        { label: "Tasting", value: "tasting" },
        { label: "Winemaker Dinner", value: "dinner" },
        { label: "Harvest Event", value: "harvest" },
        { label: "New Release", value: "release" },
        { label: "Wine Club", value: "club" },
        { label: "Other", value: "other" },
      ],
    },
    { name: "startDate", type: "date", label: "Start Date", required: true },
    { name: "endDate", type: "date", label: "End Date" },
    { name: "price", type: "number" },
    { name: "priceFree", type: "checkbox", label: "Free Event", defaultValue: false },
    { name: "registrationUrl", type: "text", label: "Registration URL" },
    { name: "description", type: "textarea" },
    { name: "featuredImage", type: "upload", relationTo: "media", label: "Featured Image" },
  ],
  timestamps: true,
}
```

---

## Step 7 — Register all collections in the Payload config

Open the main Payload config file (payload.config.ts or similar). Import and add all 
five new collections to the collections array.

```typescript
import { Wineries } from "./collections/Wineries"
import { Wines } from "./collections/Wines"
import { Restaurants } from "./collections/Restaurants"
import { Accommodations } from "./collections/Accommodations"
import { WineryEvents } from "./collections/WineryEvents"

// In buildConfig({ collections: [...existing, Wineries, Wines, Restaurants, Accommodations, WineryEvents] })
```

---

## Step 8 — Verify the fields match what WCC expects

The WCC frontend queries these endpoints with these field names:
- GET /api/wineries?where[site.slug][equals]=wine-country-corner&where[featured][equals]=true&where[featuredTier][equals]=flagship
- GET /api/restaurants?where[site.slug][equals]=wine-country-corner
- GET /api/accommodations?where[site.slug][equals]=wine-country-corner
- GET /api/winery-events?where[startDate][greater_than]=<ISO date>

The `site` relationship must use the existing `sites` collection slug.
If your sites collection has a different slug (e.g., `site`, `tenants`), 
update the `relationTo` field in each collection accordingly.

---

## Step 9 — Build and redeploy Payload

```bash
npm run build   # or whatever your Payload build command is
```

Then redeploy via Docker, PM2, or however the Payload instance is managed.

---

## Step 10 — Verify collections exist in the admin

Log into cms.winecountrycorner.com/admin
Confirm you can see in the sidebar (under "Wine Country Corner" group):
- Wineries
- Wines
- Restaurants
- Accommodations
- Winery Events

Then test that the API returns correctly:
```bash
curl "https://cms.winecountrycorner.com/api/wineries?limit=1" \
  -H "Authorization: users API-Key <your-api-key>"
```

Should return: { docs: [], totalDocs: 0, ... }
NOT a 404. A 404 means the collection didn't register.

---

## Step 11 — Commit and push

```bash
git add -A
git commit -m "feat: add WCC collections (wineries, wines, restaurants, accommodations, winery-events)"
git push origin main
```

Signal to the WCC admin that collections are live and seed scripts can now be run.
