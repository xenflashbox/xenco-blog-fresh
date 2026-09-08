import type {
  CollectionConfig,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  FieldAccess,
} from 'payload'
import { normalizeDomain } from '../lib/site'
import { syncDomainsAfterChange, syncDomainsAfterDelete } from '../hooks/syncDomainsToTraefik'
import { authenticatedWrite } from '../access/authenticatedWrite'

function normalizeDomainPreserveSubdomain(raw: string): string | null {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '')
    .replace(/\/+$/, '')

  return value || null
}

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, originalDoc, context }) => {
  if (!data) return data

  // Nested unset-other-defaults updates (below) must not re-enter the
  // default-enforcement logic: at that point the outer save is uncommitted, so
  // the find() would see no default and force isDefault back to true.
  if (context?.skipSiteDefaultChecks) return data

  // Normalize domains while preserving subdomains.
  // This keeps explicit entries like `cms.example.com` and `www.example.com`
  // visible in admin instead of collapsing them into `example.com`.
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

        const normalized = normalizeDomainPreserveSubdomain(raw)
        if (!normalized) return null

        return { domain: normalized }
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
          // Same transaction (prevents the second-session lock-wait pattern that
          // deadlocked vendor-certifications) + skip re-entrant default checks.
          req,
          context: { skipSiteDefaultChecks: true },
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

// Sites is embedded in every article response — as `site`, `featuredImage.site`
// and `author.site` — so anything readable here is readable anonymously from
// /api/articles. Payload omits a field entirely when its read access denies,
// which keeps the relation expansion intact for the consumers that rely on it.
// Server-side callers use the Local API (overrideAccess: true) and are unaffected.
const authenticatedFieldRead: FieldAccess = ({ req }) => Boolean(req.user)

export const Sites: CollectionConfig = {
  slug: 'sites',
  admin: { useAsTitle: 'name' },
  access: {
    read: () => true,
    create: authenticatedWrite,
    update: authenticatedWrite,
    delete: authenticatedWrite,
  },
  hooks: {
    beforeChange: [beforeChange],
    beforeDelete: [beforeDelete],
    afterChange: [syncDomainsAfterChange],
    afterDelete: [syncDomainsAfterDelete],
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

    // ── Branding ──────────────────────────────────────────────────────────────
    {
      name: 'tagline',
      type: 'text',
      admin: { description: 'Short brand tagline (e.g. "Find your direction.")' },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'Site description for admin reference and SEO defaults' },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Primary site logo (SVG or PNG)' },
    },
    {
      name: 'favicon',
      type: 'upload',
      relationTo: 'media',
      admin: { description: 'Site favicon (SVG or ICO)' },
    },
    {
      name: 'themeColor',
      type: 'text',
      label: 'Theme Color',
      admin: { description: 'Primary brand color hex (e.g. #0F4C5C)' },
    },
    {
      name: 'backgroundColor',
      type: 'text',
      label: 'Background Color',
      admin: { description: 'Background color hex (e.g. #F4EDE0)' },
    },

    // ── Newsletter integrations ───────────────────────────────────────────────
    {
      name: 'listmonkListId',
      type: 'text',
      label: 'Listmonk List ID',
      access: { read: authenticatedFieldRead },
      admin: { description: 'Listmonk mailing list ID for newsletter signups on this site' },
    },
    {
      name: 'mauticSegmentId',
      type: 'text',
      label: 'Mautic Segment ID',
      access: { read: authenticatedFieldRead },
      admin: { description: 'Mautic segment ID for this site' },
    },

    // ── ISR Revalidation settings for front-end cache invalidation ───────────
    {
      name: 'revalidateUrl',
      type: 'text',
      access: { read: authenticatedFieldRead },
      admin: {
        description:
          'Full URL for on-demand revalidation (e.g., https://resumecoach.me/api/revalidate). Leave empty to skip.',
      },
    },
    {
      name: 'revalidateSecret',
      type: 'text',
      access: { read: authenticatedFieldRead },
      admin: {
        description: 'Secret token for the revalidation endpoint (passed as ?secret=...)',
      },
    },
  ],
}
