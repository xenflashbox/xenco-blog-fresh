import type { CollectionConfig } from 'payload'

export const InternalLinkEdges: CollectionConfig = {
  slug: 'internal_link_edges',
  admin: {
    useAsTitle: 'contextHash',
    defaultColumns: ['site', 'sourceArticle', 'targetArticle', 'placement', 'runId', 'createdAt'],
    listSearchableFields: ['contextHash', 'keywordUsed', 'anchorText'],
    group: 'SEO',
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: () => false,
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
      name: 'sourceArticle',
      type: 'relationship',
      relationTo: 'articles',
      required: true,
      index: true,
    },
    {
      name: 'targetArticle',
      type: 'relationship',
      relationTo: 'articles',
      required: true,
      index: true,
    },
    {
      name: 'keywordUsed',
      type: 'text',
    },
    {
      name: 'anchorText',
      type: 'text',
    },
    {
      name: 'contextHash',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'placement',
      type: 'select',
      required: true,
      options: [
        { label: 'In body', value: 'in_body' },
        { label: 'Related reading', value: 'related_reading' },
      ],
      index: true,
    },
    {
      name: 'runId',
      type: 'relationship',
      relationTo: 'internal_link_runs',
      required: true,
      index: true,
    },
  ],
}
