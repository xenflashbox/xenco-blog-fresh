import type { CollectionConfig } from 'payload'

export const DirectoryEntries: CollectionConfig = {
  slug: 'directory-entries',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'tier', 'subcategory', 'site', 'status'],
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  // Per-site slug uniqueness: allows same slug on different sites (multi-tenant design)
  indexes: [
    {
      fields: ['site', 'slug'],
      unique: true,
    },
  ],
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    // Tier classification field (Step 2)
    {
      name: 'tier',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'tier-1',
      options: [
        { label: 'Tier 1 — Standard Entry', value: 'tier-1' },
        { label: 'Tier 2 — Enhanced Entry', value: 'tier-2' },
        { label: 'Tier 3 — Featured Partner', value: 'tier-3' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Determines content depth, schema, and conversion features. Promote based on GSC impression data or partnership status.',
      },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, index: true },
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
        { label: 'Hotels, Inns & Vacation Rentals', value: 'lodging' },
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
    // Extended content for Tier 2+ entries (Step 3)
    {
      name: 'extendedContent',
      type: 'group',
      admin: {
        condition: (data) => data.tier === 'tier-2' || data.tier === 'tier-3',
        description: 'Extended content sections required for Tier 2+ entries',
      },
      fields: [
        { name: 'whatMakesItSpecial', type: 'richText' },
        { name: 'whoItsRightFor', type: 'richText' },
        { name: 'whatToExpect', type: 'richText' },
        { name: 'localContext', type: 'richText' },
        {
          name: 'faqs',
          type: 'array',
          fields: [
            { name: 'question', type: 'text', required: true },
            { name: 'answer', type: 'richText', required: true },
          ],
        },
      ],
    },
    // Gallery for Tier 2+ entries (Step 4)
    {
      name: 'gallery',
      type: 'array',
      admin: {
        condition: (data) => data.tier === 'tier-2' || data.tier === 'tier-3',
        description: 'Photo gallery for Tier 2+ entries. 4-6 photos for Tier 2; 8-15 for Tier 3.',
      },
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'alt', type: 'text', required: true },
        { name: 'caption', type: 'text' },
      ],
    },
    // Winery-specific fields (Step 5)
    {
      name: 'wineryDetails',
      type: 'group',
      admin: {
        condition: (data) => data.category === 'wineries',
        description: 'Winery-specific fields used for directory filtering and faceting',
      },
      fields: [
        {
          name: 'ava',
          type: 'select',
          options: [
            // Sonoma County AVAs
            { label: 'Sonoma Valley', value: 'sonoma-valley' },
            { label: 'Russian River Valley', value: 'russian-river-valley' },
            { label: 'Dry Creek Valley', value: 'dry-creek-valley' },
            { label: 'Alexander Valley', value: 'alexander-valley' },
            { label: 'Knights Valley', value: 'knights-valley' },
            { label: 'Bennett Valley', value: 'bennett-valley' },
            { label: 'Chalk Hill', value: 'chalk-hill' },
            { label: 'Rockpile', value: 'rockpile' },
            { label: 'Sonoma Coast', value: 'sonoma-coast' },
            { label: 'Sonoma Mountain', value: 'sonoma-mountain' },
            { label: 'Carneros (Sonoma)', value: 'carneros-sonoma' },
            // Napa County AVAs
            { label: 'Napa Valley', value: 'napa-valley' },
            { label: 'Stags Leap District', value: 'stags-leap' },
            { label: 'Oakville', value: 'oakville' },
            { label: 'Rutherford', value: 'rutherford' },
            { label: 'St. Helena', value: 'st-helena' },
            { label: 'Calistoga', value: 'calistoga' },
            { label: 'Mount Veeder', value: 'mount-veeder' },
            { label: 'Howell Mountain', value: 'howell-mountain' },
            { label: 'Spring Mountain', value: 'spring-mountain' },
            { label: 'Atlas Peak', value: 'atlas-peak' },
            { label: 'Diamond Mountain', value: 'diamond-mountain' },
            { label: 'Yountville', value: 'yountville' },
            { label: 'Oak Knoll', value: 'oak-knoll' },
            { label: 'Wild Horse Valley', value: 'wild-horse-valley' },
            { label: 'Carneros (Napa)', value: 'carneros-napa' },
            { label: 'Coombsville', value: 'coombsville' },
          ],
        },
        {
          name: 'varietalsProduced',
          type: 'array',
          fields: [{ name: 'varietal', type: 'text' }],
        },
        {
          name: 'wineryType',
          type: 'select',
          options: [
            { label: 'Boutique (under 5,000 cases)', value: 'boutique' },
            { label: 'Small Estate (5,000-20,000 cases)', value: 'small-estate' },
            { label: 'Mid-Size (20,000-100,000 cases)', value: 'mid-size' },
            { label: 'Large (100,000+ cases)', value: 'large' },
          ],
        },
        { name: 'familyOwned', type: 'checkbox', defaultValue: false },
        { name: 'yearFounded', type: 'number' },
        { name: 'reservationsRequired', type: 'checkbox', defaultValue: false },
        { name: 'walkInsAccepted', type: 'checkbox', defaultValue: false },
        { name: 'dogFriendly', type: 'checkbox', defaultValue: false },
        { name: 'familyFriendly', type: 'checkbox', defaultValue: false },
        { name: 'picnicFriendly', type: 'checkbox', defaultValue: false },
        { name: 'walkingDistanceFromSonomaPlaza', type: 'checkbox', defaultValue: false },
      ],
    },
    // Commerce 7 integration (Step 6)
    {
      name: 'commerce7',
      type: 'group',
      admin: {
        description: 'Commerce 7 integration tracking. The detection script auto-populates `enabled` and `detectedDomain`.',
      },
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false, index: true },
        { name: 'detectedDomain', type: 'text', admin: { description: 'Auto-populated by Commerce 7 detection script' } },
        { name: 'detectedAt', type: 'date', admin: { readOnly: true } },
        {
          name: 'confidenceLevel',
          type: 'select',
          options: [
            { label: 'High', value: 'high' },
            { label: 'Medium', value: 'medium' },
            { label: 'Low', value: 'low' },
          ],
        },
        {
          name: 'partnershipStatus',
          type: 'select',
          options: [
            { label: 'Not contacted', value: 'not-contacted' },
            { label: 'Outreach sent', value: 'outreach-sent' },
            { label: 'In conversation', value: 'in-conversation' },
            { label: 'Active anchor partner', value: 'active' },
            { label: 'Declined', value: 'declined' },
          ],
          defaultValue: 'not-contacted',
        },
        { name: 'shopEmbedCode', type: 'textarea', admin: { description: 'Commerce 7 shop widget embed code for Tier-3 partners' } },
        { name: 'wineClubEmbedCode', type: 'textarea' },
        { name: 'reservationEmbedCode', type: 'textarea' },
        { name: 'partnerSince', type: 'date' },
        { name: 'revenueShareRate', type: 'number', admin: { description: 'Negotiated percentage (e.g., 20 for 20%). Internal use only.' } },
      ],
    },
    // Metrics for tier promotion (Step 7)
    {
      name: 'metrics',
      type: 'group',
      admin: {
        description: 'GSC and conversion data for tier promotion decisions. Auto-populated by sync job.',
        position: 'sidebar',
      },
      fields: [
        { name: 'gscImpressions30d', type: 'number', admin: { readOnly: true } },
        { name: 'gscClicks30d', type: 'number', admin: { readOnly: true } },
        { name: 'gscAvgPosition', type: 'number', admin: { readOnly: true } },
        { name: 'lastSyncAt', type: 'date', admin: { readOnly: true } },
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
    // Cross-linking relationships (Step 8)
    {
      name: 'relatedArticles',
      type: 'relationship',
      relationTo: 'articles',
      hasMany: true,
      admin: {
        description: 'Cluster articles that link to this directory entry. Bidirectional — update when articles are published.',
      },
    },
    {
      name: 'relatedDirectoryEntries',
      type: 'relationship',
      relationTo: 'directory-entries',
      hasMany: true,
      admin: {
        description: 'Sister entries — nearby wineries, similar restaurants, etc. Surface as "You might also like" on Tier-2+ pages.',
      },
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
        { label: 'Published', value: 'published' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Draft', value: 'draft' },
      ],
      defaultValue: 'published',
      admin: { position: 'sidebar' },
    },
    { name: 'sourceUrl', type: 'text' },
    { name: 'lastCrawledAt', type: 'date' },
  ],
}
