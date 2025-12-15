import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { resolveSiteForRequest, getDefaultSiteId } from '../lib/site'
import { ensureUniqueSlugForSite } from '../lib/uniqueSlug'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  // Preserve site on update if not provided
  if (operation === 'update' && !data.site && (originalDoc as any)?.site) {
    data.site = (originalDoc as any).site
  }

  // site assignment on create with fallback
  if (operation === 'create' && !data.site) {
    const site = await resolveSiteForRequest(req.payload, req.headers)
    if (!site?.id) {
      // Fallback to default site
      const defaultSiteId = await getDefaultSiteId(req.payload)
      if (!defaultSiteId) {
        throw new Error('No default site found. Create a Site with isDefault=true.')
      }
      data.site = defaultSiteId
    } else {
      data.site = site.id
    }
  }

  // slug from name if missing
  if (typeof data.name === 'string' && (!data.slug || typeof data.slug !== 'string')) {
    data.slug = slugify(data.name)
  }

  const siteId =
    typeof data.site === 'string' || typeof data.site === 'number'
      ? String(data.site)
      : (data.site as any)?.id
        ? String((data.site as any).id)
        : null

  if (!siteId) throw new Error('Tag.site is required.')

  // unique per-site slug
  if (typeof data.slug === 'string' && data.slug.trim()) {
    data.slug = await ensureUniqueSlugForSite({
      payload: req.payload,
      collection: 'tags',
      siteId,
      desiredSlug: data.slug,
      currentId: originalDoc?.id ? String((originalDoc as any).id) : undefined,
    })
  }

  return data
}

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: { useAsTitle: 'name' },
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
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },

    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      admin: { position: 'sidebar' },
      defaultValue: async ({ req }) => {
        const site = await resolveSiteForRequest(req.payload, req.headers)
        if (site?.id) return site.id
        const defaultSiteId = await getDefaultSiteId(req.payload)
        return defaultSiteId
      },
    },
  ],
}
