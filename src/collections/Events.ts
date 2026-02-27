import type { CollectionConfig } from 'payload'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'startDate', 'category', 'site', 'status'],
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'description', type: 'richText', required: true },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    { name: 'startDate', type: 'date', required: true, index: true },
    { name: 'endDate', type: 'date' },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Music & Concerts', value: 'music' },
        { label: 'Wine & Food', value: 'wine-food' },
        { label: 'Arts & Culture', value: 'arts-culture' },
        { label: 'Seasonal', value: 'seasonal' },
        { label: 'Community', value: 'community' },
        { label: 'Festivals', value: 'festivals' },
      ],
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        { name: 'venueName', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
      ],
    },
    { name: 'externalUrl', type: 'text' },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
      ],
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Past', value: 'past' },
      ],
      defaultValue: 'active',
      admin: { position: 'sidebar' },
    },
    { name: 'sourceUrl', type: 'text' },
    { name: 'lastCrawledAt', type: 'date' },
  ],
}
