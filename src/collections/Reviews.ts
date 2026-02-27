import type { CollectionConfig } from 'payload'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'reviewerName',
    defaultColumns: ['reviewerName', 'suite', 'rating', 'date', 'site'],
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
    { name: 'reviewerName', type: 'text', required: true },
    { name: 'reviewerLocation', type: 'text' },
    {
      name: 'suite',
      type: 'relationship',
      relationTo: 'suites',
      required: true,
      index: true,
    },
    { name: 'rating', type: 'number', min: 1, max: 5, required: true },
    { name: 'title', type: 'text' },
    { name: 'content', type: 'textarea', required: true },
    { name: 'date', type: 'date', required: true, index: true },
    {
      name: 'highlights',
      type: 'array',
      fields: [
        { name: 'item', type: 'text' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      options: [
        { label: 'Airbnb', value: 'airbnb' },
        { label: 'VRBO', value: 'vrbo' },
        { label: 'Booking.com', value: 'booking' },
        { label: 'Direct', value: 'direct' },
        { label: 'Google', value: 'google' },
      ],
      defaultValue: 'direct',
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
        { label: 'Hidden', value: 'hidden' },
      ],
      defaultValue: 'active',
      admin: { position: 'sidebar' },
    },
  ],
}
