import type { Access, CollectionConfig } from 'payload'

const isAdmin = ({ req }: { req: { user?: { role?: string } | null } }): boolean =>
  req.user?.role === 'admin'

// Admins see the whole fleet; any other authenticated user sees only their own
// record. Anonymous requests match nothing.
const readAccess: Access = ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  return { id: { equals: req.user.id } }
}

const updateAccess: Access = ({ req }) => {
  if (!req.user) return false
  if (req.user.role === 'admin') return true
  return { id: { equals: req.user.id } }
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },

  auth: {
    useAPIKey: true,
  },

  access: {
    create: isAdmin,
    read: readAccess,
    update: updateAccess,
    delete: isAdmin,
    admin: ({ req }) => Boolean(req.user),
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
      // Only admins may grant or change roles; without this an editor could
      // promote themselves via their own self-update access.
      access: {
        create: isAdmin,
        update: isAdmin,
      },
    },
    {
      // Merged over Payload's built-in apiKey field (mergeBaseFields deep-merges
      // by name, so the encrypt/decrypt hooks are preserved). Never serialized on
      // read, for anyone — collection access alone would let a future permissive
      // rule re-publish live credentials. API-key auth is unaffected: the strategy
      // matches on apiKeyIndex with overrideAccess.
      name: 'apiKey',
      type: 'text',
      access: {
        read: () => false,
      },
    },
  ],

  hooks: {
    // Belt and braces behind the field-level rule above.
    afterRead: [
      ({ doc }) => {
        if (doc && typeof doc === 'object' && 'apiKey' in doc) delete (doc as any).apiKey
        return doc
      },
    ],
  },
}
