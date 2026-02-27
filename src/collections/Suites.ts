import type { CollectionConfig } from 'payload'

export const Suites: CollectionConfig = {
  slug: 'suites',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'site', 'status'],
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
    { name: 'tagline', type: 'text', required: true },
    { name: 'description', type: 'richText', required: true },
    { name: 'shortDescription', type: 'textarea' },
    {
      name: 'details',
      type: 'group',
      fields: [
        { name: 'bedrooms', type: 'number', required: true },
        { name: 'bathrooms', type: 'number', required: true },
        { name: 'maxGuests', type: 'number', required: true },
        { name: 'sqft', type: 'number' },
        {
          name: 'floor',
          type: 'select',
          options: [
            { label: 'Ground Floor', value: 'ground' },
            { label: 'Upper Floor', value: 'upper' },
          ],
        },
        { name: 'hasPatio', type: 'checkbox', defaultValue: false },
        { name: 'hasEnSuite', type: 'checkbox', defaultValue: false },
        { name: 'isADACompliant', type: 'checkbox', defaultValue: false },
      ],
    },
    {
      name: 'amenities',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'icon', type: 'text' },
      ],
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        { name: 'image', type: 'upload', relationTo: 'media', required: true },
        { name: 'alt', type: 'text', required: true },
        { name: 'caption', type: 'text' },
        { name: 'isPrimary', type: 'checkbox', defaultValue: false },
      ],
    },
    { name: 'lodgifyPropertyId', type: 'text', required: true },
    {
      name: 'pricing',
      type: 'group',
      fields: [
        { name: 'baseNightlyRate', type: 'number' },
        { name: 'cleaningFee', type: 'number' },
        { name: 'directBookingDiscount', type: 'number' },
      ],
    },
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'metaTitle', type: 'text' },
        { name: 'metaDescription', type: 'textarea' },
        { name: 'ogImage', type: 'upload', relationTo: 'media' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      defaultValue: 'active',
      admin: { position: 'sidebar' },
    },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
}
