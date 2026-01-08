import type {
  CollectionConfig,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
} from 'payload'
import { normalizeDomain } from '../lib/site'

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  if (!data) return data

  // Normalize domains - store only root domains (remove cms. and www. prefixes)
  if (Array.isArray(data.domains)) {
    data.domains = data.domains
      .map((d: any) => {
        let raw: string | null = null
        if (typeof d === 'string') {
          raw = d
        } else if (d && typeof d === 'object' && typeof d.domain === 'string') {
          raw = d.domain
        }

        if (!raw) return null

        const normalized = normalizeDomain(raw)
        if (!normalized) return null

        // Strip cms. and www. prefixes to store only root domain
        const canonical = normalized.replace(/^cms\./, '').replace(/^www\./, '')
        return canonical ? { domain: canonical } : null
      })
      .filter((d: any) => d !== null)

    // Deduplicate normalized domains inside the same Site
    const seen = new Set<string>()
    data.domains = data.domains.filter((d: any) => {
      const dom = d?.domain
      if (typeof dom !== 'string') return false
      if (seen.has(dom)) return false
      seen.add(dom)
      return true
    })
  }

  // If no default exists yet, force this site to become default.
  // This prevents the platform from getting stuck (Articles requires a default fallback).
  const currentId = (originalDoc as any)?.id
  const existingDefault = await req.payload.find({
    collection: 'sites',
    where: {
      and: [
        { isDefault: { equals: true } },
        ...(currentId ? [{ id: { not_equals: currentId } }] : []),
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (!existingDefault.docs?.length) {
    data.isDefault = true
  }

  // Block unsetting the last default
  const wasDefault = Boolean((originalDoc as any)?.isDefault)
  const willBeDefault = data.isDefault === true

  if (wasDefault && !willBeDefault) {
    // ensure there is another default; otherwise block
    const otherDefault = await req.payload.find({
      collection: 'sites',
      where: {
        and: [
          { isDefault: { equals: true } },
          { id: { not_equals: String((originalDoc as any)?.id) } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!otherDefault.docs?.length) {
      throw new Error('You cannot unset the last default site. Set another site as default first.')
    }
  }

  // If setting isDefault=true, unset other defaults
  if (data.isDefault === true) {
    const allSites = await req.payload.find({
      collection: 'sites',
      where: { isDefault: { equals: true } },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    for (const site of allSites.docs || []) {
      if (String(site.id) !== String(currentId)) {
        await req.payload.update({
          collection: 'sites',
          id: String(site.id),
          data: { isDefault: false },
          overrideAccess: true,
        })
      }
    }
  }

  // Validate domain uniqueness
  if (Array.isArray(data.domains)) {
    const currentId = (originalDoc as any)?.id
    for (const domainEntry of data.domains) {
      const domain = domainEntry?.domain
      if (typeof domain === 'string') {
        const normalized = normalizeDomain(domain)
        if (normalized) {
          const existing = await req.payload.find({
            collection: 'sites',
            where: {
              and: [
                { 'domains.domain': { equals: normalized } },
                ...(currentId ? [{ id: { not_equals: currentId } }] : []),
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (existing.docs?.length) {
            throw new Error(`Domain "${normalized}" is already used by another site.`)
          }
        }
      }
    }
  }

  return data
}

const beforeDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const site = await req.payload.findByID({
    collection: 'sites',
    id: String(id),
    depth: 0,
    overrideAccess: true,
  })

  if (site?.isDefault) {
    const otherDefault = await req.payload.find({
      collection: 'sites',
      where: {
        and: [{ isDefault: { equals: true } }, { id: { not_equals: String(id) } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (!otherDefault.docs?.length) {
      throw new Error('You cannot delete the last default site. Set another site as default first.')
    }
  }
}

export const Sites: CollectionConfig = {
  slug: 'sites',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    beforeChange: [beforeChange],
    beforeDelete: [beforeDelete],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },

    {
      name: 'domains',
      type: 'array',
      fields: [{ name: 'domain', type: 'text', required: true }],
      admin: {
        description:
          'Domains that should resolve to this site (e.g. fightclubtech.com). Do NOT include protocol.',
      },
    },

    { name: 'isDefault', type: 'checkbox', defaultValue: false },

    // ISR Revalidation settings for front-end cache invalidation
    {
      name: 'revalidateUrl',
      type: 'text',
      admin: {
        description:
          'Full URL for on-demand revalidation (e.g., https://resumecoach.me/api/revalidate). Leave empty to skip.',
      },
    },
    {
      name: 'revalidateSecret',
      type: 'text',
      admin: {
        description: 'Secret token for the revalidation endpoint (passed as ?secret=...)',
      },
    },
  ],
}
