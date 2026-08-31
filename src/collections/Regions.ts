import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { resolveSiteForRequest } from '../lib/site'
import { ensureUniqueSlugForSite } from '../lib/uniqueSlug'
import { siteScopedRead } from '../access/siteScopedRead'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const beforeChange: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  if (!data) return data

  if (typeof data.name === 'string' && (!data.slug || typeof data.slug !== 'string')) {
    data.slug = slugify(data.name)
  }

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

  if (!siteId) throw new Error('Region.site is required.')

  if (typeof data.slug === 'string' && data.slug.trim()) {
    data.slug = await ensureUniqueSlugForSite({
      payload: req.payload,
      collection: 'regions',
      siteId,
      desiredSlug: data.slug,
      currentId: originalDoc?.id ? String((originalDoc as any).id) : undefined,
    })
  }

  return data
}

export const Regions: CollectionConfig = {
  slug: 'regions',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'tier', 'stateCode', 'site'],
    group: 'Directory',
  },
  access: {
    read: siteScopedRead,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    beforeChange: [beforeChange],
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
      defaultValue: async ({ req }) => {
        const site = await resolveSiteForRequest(req.payload, req.headers)
        return site?.id ? Number(site.id) : undefined
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'tier',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'State', value: 'state' },
        { label: 'Major Metro', value: 'metro' },
        { label: 'Broad Region', value: 'region' },
      ],
    },
    {
      name: 'stateCode',
      type: 'text',
      label: 'State Code',
      admin: {
        description: '2-character US state code (e.g. AZ, CA). For state and metro tiers.',
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
  timestamps: true,
}
