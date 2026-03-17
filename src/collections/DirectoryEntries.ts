import type { CollectionConfig } from 'payload'

export const DirectoryEntries: CollectionConfig = {
  slug: 'directory-entries',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'subcategory', 'site', 'status'],
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
    {
      name: 'category',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Wineries & Tasting Rooms', value: 'wineries' },
        { label: 'Restaurants & Dining', value: 'restaurants' },
        { label: 'Activities & Experiences', value: 'activities' },
        { label: 'Wedding & Event Venues', value: 'venues' },
      ],
    },
    { name: 'subcategory', type: 'text' },
    {
      name: 'tags',
      type: 'array',
      fields: [
        { name: 'tag', type: 'text' },
      ],
    },
    { name: 'featuredImage', type: 'upload', relationTo: 'media' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    {
      name: 'location',
      type: 'group',
      fields: [
        { name: 'address', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'distanceFromProperty', type: 'text' },
        { name: 'driveTimeMinutes', type: 'number' },
      ],
    },
    {
      name: 'contact',
      type: 'group',
      fields: [
        { name: 'website', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'text' },
      ],
    },
    {
      name: 'details',
      type: 'group',
      fields: [
        {
          name: 'priceRange',
          type: 'select',
          options: [
            { label: '$', value: '$' },
            { label: '$$', value: '$$' },
            { label: '$$$', value: '$$$' },
            { label: '$$$$', value: '$$$$' },
          ],
        },
        { name: 'hours', type: 'textarea' },
        { name: 'reservationRequired', type: 'checkbox', defaultValue: false },
        { name: 'tastingFeeRange', type: 'text' },
        { name: 'cuisineType', type: 'text' },
        { name: 'capacity', type: 'text' },
      ],
    },
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
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Published', value: 'published' },
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'published',
      admin: { position: 'sidebar' },
    },
    { name: 'sourceUrl', type: 'text' },
    { name: 'lastCrawledAt', type: 'date' },
  ],
}
