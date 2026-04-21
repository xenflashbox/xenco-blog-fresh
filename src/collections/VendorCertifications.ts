import type { CollectionConfig } from 'payload'

export const VendorCertifications: CollectionConfig = {
  slug: 'vendor-certifications',
  admin: {
    useAsTitle: 'certification_name',
    defaultColumns: ['vendor', 'certification_name', 'certification_body', 'verification_status', 'valid_through'],
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
    { name: 'certification_name', type: 'text', required: true },
    { name: 'certification_body', type: 'text' },
    { name: 'cert_number', type: 'text' },
    { name: 'valid_from', type: 'date' },
    { name: 'valid_through', type: 'date' },
    {
      name: 'verification_status',
      type: 'select',
      options: [
        { label: 'Self-Reported', value: 'self-reported' },
        { label: 'Verified', value: 'verified' },
        { label: 'Expired', value: 'expired' },
        { label: 'Unverifiable', value: 'unverifiable' },
      ],
      defaultValue: 'self-reported',
      admin: { position: 'sidebar' },
    },
    { name: 'verification_url', type: 'text' },
    { name: 'verification_notes', type: 'textarea' },
  ],
}
