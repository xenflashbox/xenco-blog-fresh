import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },

  // ✅ Enable per-user API keys
  auth: {
    useAPIKey: true,
  },

  access: {
    // NOTE: this is currently wide-open (OK for dev, risky for prod)
    create: () => true,
    read: () => true,
    update: () => true,
    delete: () => true,
    admin: () => true,
  },

  fields: [
    {
      name: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      defaultValue: 'admin',
      required: true,
    },
  ],
}
