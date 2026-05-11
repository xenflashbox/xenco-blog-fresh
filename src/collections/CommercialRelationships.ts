import type { CollectionConfig } from 'payload'

/**
 * CommercialRelationships — Compare ITAD material connection disclosure.
 *
 * Every record in this collection is rendered in the /commercial-model page's
 * "Material Connections" table. The table renders in empty-state when there are
 * zero active records, and shows a row per active relationship when records exist.
 *
 * Access: public read (required for /commercial-model transparency page to work
 * without auth). All write operations require a logged-in user.
 */
export const CommercialRelationships: CollectionConfig = {
  slug: 'commercial-relationships',
  admin: {
    useAsTitle: 'vendor',
    defaultColumns: ['vendor', 'connection_type', 'effective_date', 'is_active'],
    group: 'Compare ITAD',
    description:
      'Material commercial connections between Compare ITAD and listed vendors. ' +
      'Every active record renders in the /commercial-model transparency page. ' +
      'Add a record only when a real commercial relationship exists. ' +
      'Set is_active to false to remove from the public table without deleting the audit record.',
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
      admin: {
        description:
          'The vendor with whom this commercial relationship exists. Must be an active listing in the Compare ITAD directory.',
      },
    },
    {
      name: 'connection_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Referral partner', value: 'referral-partner' },
        { label: 'Premium placement', value: 'premium-placement' },
        { label: 'Sponsored content', value: 'sponsored-content' },
      ],
      admin: {
        description:
          'The nature of the commercial relationship. Renders verbatim in the ' +
          'Material Connections table on /commercial-model. Use the label that ' +
          'most accurately describes the actual arrangement.',
      },
    },
    {
      name: 'effective_date',
      type: 'date',
      required: true,
      admin: {
        description:
          'The date this commercial relationship took effect. Used for the ' +
          '"effective as of" column on the transparency table. Required.',
        date: { displayFormat: 'MMM d, yyyy' },
      },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Active relationships render on /commercial-model. Uncheck to remove ' +
          'from the public table without losing the audit record. The /commercial-model ' +
          'page queries where[is_active][equals]=true.',
      },
    },
    {
      name: 'internal_notes',
      type: 'textarea',
      admin: {
        description:
          'Internal editorial notes about this relationship. Never rendered publicly. ' +
          'Use to document contract references, review cadences, or escalation contacts.',
      },
    },
  ],
  timestamps: true,
}
