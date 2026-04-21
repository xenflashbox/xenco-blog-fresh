import type { CollectionConfig } from 'payload'

export const Vendors: CollectionConfig = {
  slug: 'vendors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'is_published', 'claim_status', 'hq_city', 'hq_state'],
    group: 'Compare ITAD',
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'website', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'hq_city', type: 'text' },
    { name: 'hq_state', type: 'text' },
    { name: 'hq_country', type: 'text', defaultValue: 'US' },
    { name: 'phone', type: 'text' },
    { name: 'email', type: 'email' },
    { name: 'founded_year', type: 'number' },
    { name: 'employee_count_range', type: 'text' },
    {
      name: 'industries_served',
      type: 'relationship',
      relationTo: 'industries',
      hasMany: true,
    },

    {
      name: 'is_published',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'claim_status',
      type: 'select',
      options: [
        { label: 'Unclaimed', value: 'unclaimed' },
        { label: 'Pending Claim', value: 'pending-claim' },
        { label: 'Claimed', value: 'claimed' },
      ],
      defaultValue: 'unclaimed',
      admin: { position: 'sidebar' },
    },

    {
      name: 'provenance',
      type: 'group',
      fields: [
        { name: 'primary_source_url', type: 'text' },
        { name: 'crawled_at', type: 'date' },
        { name: 'last_verified_at', type: 'date' },
        { name: 'crawler_version', type: 'text' },
        { name: 'verification_notes', type: 'textarea' },
      ],
    },

    // Parent company / acquisition (addendum fields — paste immediately after provenance, before claim_status)
    {
      name: 'parent_company',
      type: 'relationship',
      relationTo: 'vendors',
      hasMany: false,
      admin: {
        description: 'Set when this vendor is a known subsidiary of another ITAD company.',
      },
    },
    {
      name: 'acquisition',
      type: 'group',
      admin: {
        description: 'Populate once parent_company is set.',
        condition: (data) => Boolean(data?.parent_company),
      },
      fields: [
        { name: 'acquired_date', type: 'date' },
        { name: 'announcement_url', type: 'text' },
        {
          name: 'subsidiary_status',
          type: 'select',
          options: [
            { label: 'Operating as Brand', value: 'operating-as-brand' },
            { label: 'Merged Into Parent', value: 'merged-into-parent' },
            { label: 'Winding Down', value: 'winding-down' },
          ],
        },
        { name: 'acquired_entity_notes', type: 'textarea' },
      ],
    },

    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'meta_title', type: 'text' },
        { name: 'meta_description', type: 'textarea' },
      ],
    },
  ],
}
