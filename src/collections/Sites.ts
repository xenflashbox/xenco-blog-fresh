import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'

function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '')
  return s || null
}

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  if (!data) return data

  // Normalize domains
  if (Array.isArray(data.domains)) {
    data.domains = data.domains
      .map((d: any) => {
        if (typeof d === 'string') {
          const normalized = normalizeDomain(d)
          return normalized ? { domain: normalized } : null
        }
        if (d && typeof d === 'object' && typeof d.domain === 'string') {
          const normalized = normalizeDomain(d.domain)
          return normalized ? { domain: normalized } : null
        }
        return null
      })
      .filter((d: any) => d !== null)
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

    const currentId = (originalDoc as any)?.id
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
  ],
}

