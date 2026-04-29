import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { resolveSiteForRequest } from '../lib/site'
import { ensureUniqueSlugForSite } from '../lib/uniqueSlug'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  if (!data) return data

  if (typeof data.title === 'string' && (!data.slug || typeof data.slug !== 'string')) {
    data.slug = slugify(data.title)
  }

  // Resolve site (same pattern as Categories/Series)
  let siteId: string | null =
    typeof data.site === 'string' || typeof data.site === 'number'
      ? String(data.site)
      : (data.site as any)?.id
        ? String((data.site as any).id)
        : null

  if (!siteId && originalDoc && (originalDoc as any).site) {
    const orig = (originalDoc as any).site
    siteId =
      typeof orig === 'string' || typeof orig === 'number'
        ? String(orig)
        : orig?.id
          ? String(orig.id)
          : null
  }

  if (!siteId) {
    const site = await resolveSiteForRequest(req.payload, req.headers)
    if (!site?.id) throw new Error('No default site found. Create a Site with isDefault=true.')
    data.site = Number(site.id)
    siteId = String(site.id)
  }

  if (!siteId) throw new Error('Episode.site is required.')

  if (typeof data.slug === 'string' && data.slug.trim()) {
    data.slug = await ensureUniqueSlugForSite({
      payload: req.payload,
      collection: 'episodes',
      siteId,
      desiredSlug: data.slug,
      currentId: originalDoc?.id ? String((originalDoc as any).id) : undefined,
    })
  }

  // Stamp publishedAt on first publish
  const nextStatus = (data as any).status
  const prevStatus = (originalDoc as any)?.status
  if (nextStatus === 'published' && prevStatus !== 'published' && !(data as any).publishedAt) {
    ;(data as any).publishedAt = new Date().toISOString()
  }

  return data
}

const filterBySite = ({ data }: { data: Record<string, unknown> }) => {
  const site = (data as any)?.site
  const siteId =
    typeof site === 'string' || typeof site === 'number'
      ? String(site)
      : site?.id
        ? String(site.id)
        : null
  if (!siteId) return true
  return { site: { equals: siteId } }
}

export const Episodes: CollectionConfig = {
  slug: 'episodes',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'status', 'publishedAt', 'site'],
    group: 'Lexi Explains',
    listSearchableFields: ['title', 'slug', 'hook'],
  },
  access: {
    // Authenticated CMS users see everything; unauthenticated callers
    // (frontend / API) only see published episodes.
    read: ({ req }) => {
      if (req.user) return true
      return { status: { equals: 'published' } }
    },
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    beforeChange: [beforeChange],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Episode title — keep it punchy, e.g. "Credit Scores Are Like Dating".',
      },
    },
    { name: 'slug', type: 'text', required: true, index: true },
    {
      name: 'hook',
      type: 'textarea',
      admin: {
        description:
          'Lexi’s opening line in the video — used as the meta description and excerpt.',
      },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      filterOptions: filterBySite,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'authors',
      required: true,
      index: true,
      admin: {
        description: 'Episode byline. Required — every episode has a host.',
        position: 'sidebar',
      },
      filterOptions: filterBySite,
    },
    {
      name: 'series',
      type: 'relationship',
      relationTo: 'series',
      admin: {
        description: 'Optional — only set if this episode is part of a multi-part series.',
      },
      filterOptions: filterBySite,
    },
    {
      name: 'episodeNumber',
      type: 'number',
      admin: {
        description: 'If part of a series, the episode number within the series.',
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
                description: 'YouTube video ID (the part after watch?v=).',
                condition: (data) => data.videoSource === 'youtube',
              },
            },
            {
              name: 'tiktokUrl',
              type: 'text',
              admin: {
                description: 'Full TikTok video URL used as the embed source.',
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
              admin: { description: 'Length in seconds.' },
            },
            {
              name: 'posterImage',
              type: 'upload',
              relationTo: 'media',
              required: true,
              admin: {
                description: 'Vertical 9:16 still frame used as the thumbnail.',
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
                description: 'Horizontal hero image for the article view (16:9 or similar).',
              },
            },
            {
              name: 'transcript',
              type: 'textarea',
              admin: {
                description: 'Full transcript of what Lexi says — also great for SEO.',
              },
            },
            {
              name: 'extendedContent',
              type: 'richText',
              admin: { description: 'Optional longer-form companion article.' },
            },
            {
              name: 'keyTakeaways',
              type: 'array',
              fields: [{ name: 'point', type: 'text', required: true }],
              admin: { description: '3-5 bullet takeaways shown in the sidebar.' },
            },
          ],
        },
        {
          label: 'Cross-Posting',
          fields: [
            {
              name: 'tiktokPostUrl',
              type: 'text',
              admin: { description: 'Public TikTok URL once posted.' },
            },
            { name: 'instagramUrl', type: 'text' },
            { name: 'youtubeShortUrl', type: 'text' },
            {
              name: 'tiktokViews',
              type: 'number',
              admin: { description: 'Manually update for tracking — optional.' },
            },
          ],
        },
        {
          label: 'SEO',
          fields: [
            { name: 'metaTitle', type: 'text' },
            { name: 'metaDescription', type: 'textarea' },
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
      fields: [{ name: 'tag', type: 'text', required: true }],
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Pin to homepage hero.',
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
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: {
        position: 'sidebar',
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      admin: { position: 'sidebar' },
      defaultValue: async ({ req }) => {
        const site = await resolveSiteForRequest(req.payload, req.headers)
        return site?.id ? Number(site.id) : undefined
      },
    },
  ],
}
