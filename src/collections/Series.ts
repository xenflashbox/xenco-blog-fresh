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

  // Resolve site (same pattern as Categories)
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

  if (!siteId) throw new Error('Series.site is required.')

  if (typeof data.slug === 'string' && data.slug.trim()) {
    data.slug = await ensureUniqueSlugForSite({
      payload: req.payload,
      collection: 'series',
      siteId,
      desiredSlug: data.slug,
      currentId: originalDoc?.id ? String((originalDoc as any).id) : undefined,
    })
  }

  return data
}

export const Series: CollectionConfig = {
  slug: 'series',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'category', 'status', 'site'],
    group: 'Lexi Explains',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    beforeChange: [beforeChange],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
      filterOptions: ({ data }) => {
        const site = (data as any)?.site
        const siteId =
          typeof site === 'string' || typeof site === 'number'
            ? String(site)
            : site?.id
              ? String(site.id)
              : null
        if (!siteId) return true
        return { site: { equals: siteId } }
      },
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
      admin: { position: 'sidebar' },
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
