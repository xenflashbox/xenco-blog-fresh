// src/collections/Articles.ts
import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from 'payload'

import { upsertArticleToMeili, deleteArticleFromMeili } from '../lib/meili'
import { resolveSiteForRequest } from '../lib/site'

let cachedDefaultSiteId: string | null = null
let cachedDefaultSiteAt = 0

async function getDefaultSiteId(req: {
  payload: { find: (args: any) => Promise<any> }
}): Promise<string | null> {
  const now = Date.now()
  if (cachedDefaultSiteId && now - cachedDefaultSiteAt < 60_000) return cachedDefaultSiteId

  const res = await req.payload.find({
    collection: 'sites',
    where: { isDefault: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const site = res.docs?.[0]
  if (!site?.id) return null

  cachedDefaultSiteId = String(site.id)
  cachedDefaultSiteAt = now
  return cachedDefaultSiteId
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function ensureUniqueSlugForSite(args: {
  req: any
  siteId: string
  slug: string
  currentId?: string
}): Promise<string> {
  const base = slugify(args.slug)
  let candidate = base
  let i = 2

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      and: [{ site: { equals: args.siteId } }, { slug: { equals: candidate } }],
    }

    // exclude current doc on updates
    if (args.currentId) {
      where.and.push({ id: { not_equals: args.currentId } })
    }

    const existing = await args.req.payload.find({
      collection: 'articles',
      where,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!existing.docs?.length) return candidate
    candidate = `${base}-${i++}`
    if (i > 50) throw new Error('Unable to generate unique slug for this site.')
  }
}

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  // Normalize/auto-slug if missing
  if (typeof data.title === 'string' && (!data.slug || typeof data.slug !== 'string')) {
    data.slug = slugify(data.title)
  }

  // Ensure site is set:
  // - On update: keep original site unless user explicitly provided one
  // - On create: try to assign from Host header, then default site
  const incomingSite = (data as any).site
  const existingSite = (originalDoc as any)?.site

  if (!incomingSite) {
    if (operation === 'update' && existingSite) {
      ;(data as any).site = existingSite
    } else {
      // Try to resolve site from request Host header
      let siteId: string | null = null
      try {
        const resolved = await resolveSiteForRequest(req.payload, req.headers)
        if (resolved?.id) {
          siteId = resolved.id
        }
      } catch (err) {
        // If resolver fails, fall back to default
        req.payload.logger.warn({ err }, 'Failed to resolve site from Host header, using default')
      }

      // If still no site, use default
      if (!siteId) {
        const defaultSiteId = await getDefaultSiteId(req)
        if (!defaultSiteId) {
          req.payload.logger.error(
            'No default site found. Create a Sites record with isDefault=true.',
          )
          throw new Error('Missing default site. Create a Site with isDefault=true.')
        }
        siteId = defaultSiteId
      }

      ;(data as any).site = siteId
    }
  }

  // Set publishedAt only on first publish (draft -> published)
  const nextStatus = (data as any).status
  const prevStatus = (originalDoc as any)?.status
  if (nextStatus === 'published' && prevStatus !== 'published' && !(data as any).publishedAt) {
    ;(data as any).publishedAt = new Date().toISOString()
  }

  // Ensure slug unique PER SITE (allow same slug across different sites)
  const siteId = String((data as any).site ?? existingSite ?? '')
  if (siteId && typeof (data as any).slug === 'string') {
    ;(data as any).slug = await ensureUniqueSlugForSite({
      req,
      siteId,
      slug: (data as any).slug,
      currentId: String((originalDoc as any)?.id ?? ''),
    })
  }

  return data
}

const afterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  // Only index published docs; delete from index if it was published and is no longer published
  const isPublishedNow = (doc as { status?: unknown })?.status === 'published'
  const wasPublished = (previousDoc as { status?: unknown } | undefined)?.status === 'published'

  try {
    if (isPublishedNow) {
      await upsertArticleToMeili(doc)
    } else if (wasPublished) {
      await deleteArticleFromMeili(String((doc as { id?: unknown })?.id ?? ''))
    }
  } catch (err) {
    // IMPORTANT: never break the CMS UI for search indexing issues
    req.payload.logger.error(
      { err },
      'MeiliSearch indexing failed (non-fatal). Article save succeeded.',
    )
  }

  return doc
}

const afterDelete: CollectionAfterDeleteHook = async ({ id, req }) => {
  try {
    await deleteArticleFromMeili(String(id))
  } catch (err) {
    req.payload.logger.error({ err }, 'MeiliSearch delete failed (non-fatal).')
  }
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: { useAsTitle: 'title' },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },

  hooks: {
    beforeChange: [beforeChange],
    afterChange: [afterChange],
    afterDelete: [afterDelete],
  },

  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true },

    {
      name: 'excerpt',
      type: 'textarea',
      admin: { description: 'Short summary used on listing pages / previews.' },
    },

    { name: 'content', type: 'richText' },

    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: { position: 'sidebar' },
      filterOptions: ({ data }) => {
        const site = (data as any)?.site
        const siteId =
          typeof site === 'string' || typeof site === 'number'
            ? String(site)
            : site?.id ? String(site.id) : null
        if (!siteId) return true
        return { site: { equals: siteId } }
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: { position: 'sidebar' },
      filterOptions: ({ data }) => {
        const site = (data as any)?.site
        const siteId =
          typeof site === 'string' || typeof site === 'number'
            ? String(site)
            : site?.id ? String(site.id) : null
        if (!siteId) return true
        return { site: { equals: siteId } }
      },
    },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      admin: { position: 'sidebar' },
      required: true,
    },

    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'draft',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
  ],
}
