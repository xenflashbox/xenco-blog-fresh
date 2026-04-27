## Now — the Payload collections

Here's the schema for the Lexi Explains content system. This assumes you're on Payload 3.x (App Router compatible) since that matches your other recent builds.

```typescript
// collections/Categories.ts
import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'color'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL slug, e.g. "finance", "ai", "tech"',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'color',
      type: 'select',
      required: true,
      options: [
        { label: 'Money Green', value: 'green' },
        { label: 'Electric Violet', value: 'violet' },
        { label: 'Cyber Blue', value: 'blue' },
        { label: 'Hot Coral', value: 'coral' },
        { label: 'Champagne', value: 'champagne' },
      ],
      admin: {
        description: 'Maps to category accent color in the design system',
      },
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Custom SVG icon for this category',
      },
    },
    {
      name: 'tagline',
      type: 'text',
      admin: {
        description: 'Optional category tagline shown on category landing pages',
      },
    },
  ],
}
```

```typescript
// collections/Episodes.ts
import type { CollectionConfig } from 'payload'

export const Episodes: CollectionConfig = {
  slug: 'episodes',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', 'status'],
    group: 'Content',
  },
  access: {
    read: ({ req }) => {
      if (req.user) return true
      return {
        status: { equals: 'published' },
      }
    },
  },
  versions: {
    drafts: {
      autosave: { interval: 2000 },
    },
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'The episode title — keep it punchy, e.g. "Credit Scores Are Like Dating"',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'hook',
      type: 'textarea',
      admin: {
        description: 'The opening line Lexi uses in the video — used as the meta description and excerpt',
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'series',
      type: 'relationship',
      relationTo: 'series',
      admin: {
        description: 'Optional — only set if this episode is part of a multi-part series',
      },
    },
    {
      name: 'episodeNumber',
      type: 'number',
      admin: {
        description: 'If part of a series, the episode number',
        condition: (data) => Boolean(data.series),
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Video',
          fields: [
            {
              name: 'videoSource',
              type: 'select',
              required: true,
              defaultValue: 'youtube',
              options: [
                { label: 'YouTube (private/unlisted)', value: 'youtube' },
                { label: 'TikTok', value: 'tiktok' },
                { label: 'Direct upload', value: 'direct' },
              ],
            },
            {
              name: 'youtubeId',
              type: 'text',
              admin: {
                description: 'YouTube video ID (the part after watch?v=)',
                condition: (data) => data.videoSource === 'youtube',
              },
            },
            {
              name: 'tiktokUrl',
              type: 'text',
              admin: {
                description: 'Full TikTok video URL',
                condition: (data) => data.videoSource === 'tiktok',
              },
            },
            {
              name: 'directVideo',
              type: 'upload',
              relationTo: 'media',
              admin: {
                condition: (data) => data.videoSource === 'direct',
              },
            },
            {
              name: 'duration',
              type: 'number',
              admin: {
                description: 'Length in seconds',
              },
            },
            {
              name: 'posterImage',
              type: 'upload',
              relationTo: 'media',
              required: true,
              admin: {
                description: 'Vertical 9:16 still frame used as the thumbnail',
              },
            },
          ],
        },
        {
          label: 'Article',
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Horizontal hero image for the article view (16:9 or similar)',
              },
            },
            {
              name: 'transcript',
              type: 'textarea',
              admin: {
                description: 'Full transcript of what Lexi says — also great for SEO',
              },
            },
            {
              name: 'extendedContent',
              type: 'richText',
              admin: {
                description: 'Optional longer-form companion article',
              },
            },
            {
              name: 'keyTakeaways',
              type: 'array',
              fields: [
                { name: 'point', type: 'text', required: true },
              ],
              admin: {
                description: '3-5 bullet takeaways shown in the sidebar',
              },
            },
          ],
        },
        {
          label: 'Cross-Posting',
          fields: [
            {
              name: 'tiktokUrl',
              type: 'text',
              admin: {
                description: 'Public TikTok URL once posted',
              },
            },
            {
              name: 'instagramUrl',
              type: 'text',
            },
            {
              name: 'youtubeShortUrl',
              type: 'text',
            },
            {
              name: 'tiktokViews',
              type: 'number',
              admin: {
                description: 'Manually update for tracking — optional',
              },
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            {
              name: 'metaTitle',
              type: 'text',
            },
            {
              name: 'metaDescription',
              type: 'textarea',
            },
            {
              name: 'ogImage',
              type: 'upload',
              relationTo: 'media',
            },
          ],
        },
      ],
    },
    {
      name: 'tags',
      type: 'array',
      fields: [
        { name: 'tag', type: 'text', required: true },
      ],
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Pin to homepage hero',
        position: 'sidebar',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
}
```

```typescript
// collections/Series.ts
import type { CollectionConfig } from 'payload'

export const Series: CollectionConfig = {
  slug: 'series',
  admin: {
    useAsTitle: 'title',
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'totalEpisodes',
      type: 'number',
      admin: {
        description: 'Planned total — episodes themselves are linked from the Episodes collection',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Complete', value: 'complete' },
        { label: 'Paused', value: 'paused' },
      ],
    },
  ],
}
```

```typescript
// collections/Promos.ts (for the cross-promo slots — your other apps)
import type { CollectionConfig } from 'payload'

export const Promos: CollectionConfig = {
  slug: 'promos',
  admin: {
    useAsTitle: 'name',
    group: 'Marketing',
  },
  access: {
    read: () => true,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'product',
      type: 'select',
      options: [
        { label: 'BlogCraft', value: 'blogcraft' },
        { label: 'ResumeCoach', value: 'resumecoach' },
        { label: 'ImageCrafter', value: 'imagecrafter' },
        { label: 'DevMaestro', value: 'devmaestro' },
        { label: 'MCP Forge', value: 'mcpforge' },
        { label: 'HISATECH', value: 'hisatech' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'headline', type: 'text', required: true },
    { name: 'subhead', type: 'text' },
    { name: 'ctaText', type: 'text', required: true, defaultValue: 'Learn more' },
    { name: 'ctaUrl', type: 'text', required: true },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'placement',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Homepage banner', value: 'home-banner' },
        { label: 'Sidebar (mid)', value: 'sidebar-mid' },
        { label: 'Sidebar (bottom)', value: 'sidebar-bottom' },
        { label: 'In-article', value: 'in-article' },
        { label: 'Newsletter footer', value: 'newsletter-footer' },
      ],
    },
    {
      name: 'targetCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        description: 'Optional — show this promo only on episodes in these categories',
      },
    },
    { name: 'active', type: 'checkbox', defaultValue: true },
    {
      name: 'startDate',
      type: 'date',
    },
    {
      name: 'endDate',
      type: 'date',
    },
  ],
}
```