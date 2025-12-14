import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    // First user or authenticated users can do everything
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
