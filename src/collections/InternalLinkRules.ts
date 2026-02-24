import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  if (!data) return data
  if (data.enabled === false) return data

  const site = typeof data.site === 'object' ? data.site?.id : data.site
  const targetArticle = typeof data.targetArticle === 'object' ? data.targetArticle?.id : data.targetArticle
  if (!site || !targetArticle) return data

  const where: any = {
    and: [
      { site: { equals: site } },
      { targetArticle: { equals: targetArticle } },
      { enabled: { equals: true } },
    ],
  }
  if (originalDoc?.id) {
    where.and.push({ id: { not_equals: String(originalDoc.id) } })
  }

  const existing = await req.payload.find({
    collection: 'internal_link_rules',
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.length) {
    throw new Error('An enabled internal link rule already exists for this site and target article.')
  }

  return data
}

export const InternalLinkRules: CollectionConfig = {
  slug: 'internal_link_rules',
  admin: {
    useAsTitle: 'notes',
    defaultColumns: ['site', 'targetArticle', 'enabled', 'priority', 'source', 'updatedAt'],
    group: 'SEO',
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
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
    },
    {
      name: 'targetArticle',
      type: 'relationship',
      relationTo: 'articles',
      required: true,
      index: true,
      filterOptions: ({ siblingData }) => {
        const site = (siblingData as any)?.site
        const siteId =
          typeof site === 'number' || typeof site === 'string'
            ? String(site)
            : site?.id
              ? String(site.id)
              : null
        if (!siteId) return true
        return { site: { equals: siteId } }
      },
    },
    {
      name: 'keywords',
      type: 'array',
      minRows: 1,
      required: true,
      fields: [
        {
          name: 'keyword',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 100,
    },
    {
      name: 'maxLinksPerSource',
      type: 'number',
      min: 1,
      max: 5,
      defaultValue: 1,
    },
    {
      name: 'caseSensitive',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'partialMatch',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      index: true,
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Generated', value: 'generated' },
      ],
      required: true,
    },
    {
      name: 'notes',
      type: 'textarea',
    },
  ],
}
