import type { CollectionConfig } from 'payload'

export const VendorFacilities: CollectionConfig = {
  slug: 'vendor-facilities',
  admin: {
    useAsTitle: 'city',
    defaultColumns: ['vendor', 'facility_name', 'city', 'state', 'country', 'ownership', 'is_headquarters'],
    group: 'Compare ITAD',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'vendors',
      required: true,
      index: true,
    },
    { name: 'facility_name', type: 'text' },
    { name: 'address', type: 'text' },
    { name: 'city', type: 'text', required: true },
    { name: 'state', type: 'text' },
    { name: 'country', type: 'text', defaultValue: 'US' },
    { name: 'postal_code', type: 'text' },
    { name: 'lat', type: 'number' },
    { name: 'lng', type: 'number' },
    {
      name: 'ownership',
      type: 'select',
      options: [
        { label: 'Owned', value: 'owned' },
        { label: 'Leased', value: 'leased' },
        { label: 'Partner', value: 'partner' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'is_headquarters',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    { name: 'sq_footage', type: 'number' },
    { name: 'notes', type: 'textarea' },
  ],
}
