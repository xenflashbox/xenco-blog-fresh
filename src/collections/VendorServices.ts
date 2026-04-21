import type { CollectionConfig } from 'payload'

export const VendorServices: CollectionConfig = {
  slug: 'vendor-services',
  admin: {
    useAsTitle: 'service_type',
    defaultColumns: ['vendor', 'service_type', 'description'],
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
    {
      name: 'service_type',
      type: 'select',
      required: true,
      options: [
        { label: 'IT Asset Disposition (ITAD)', value: 'itad' },
        { label: 'Hard Drive / Media Destruction', value: 'media-destruction' },
        { label: 'Data Wiping / Sanitization', value: 'data-wiping' },
        { label: 'Asset Remarketing / Resale', value: 'remarketing' },
        { label: 'Recycling / E-waste', value: 'recycling' },
        { label: 'Refurbishment', value: 'refurbishment' },
        { label: 'Logistics / Reverse Logistics', value: 'logistics' },
        { label: 'Leased Equipment Return', value: 'leased-equipment-return' },
        { label: 'IT Asset Management', value: 'itam' },
        { label: 'Certificate of Destruction', value: 'cod' },
        { label: 'On-Site Services', value: 'on-site' },
        { label: 'Cloud / Server Decommission', value: 'cloud-decommission' },
        { label: 'Other', value: 'other' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'description', type: 'textarea' },
    { name: 'service_url', type: 'text' },
  ],
}
