import type { Access, CollectionConfig, PayloadRequest } from 'payload'
import { resolveSiteIdStrict } from '../lib/site'

const isAdmin = ({ req }: { req: { user?: { role?: string } | null } }): boolean =>
  req.user?.role === 'admin'

const FALLBACK_ORIGIN = (
  process.env.PAYLOAD_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_PAYLOAD_URL ||
  'https://cms.xencolabs.com'
).replace(/\/+$/, '')

// One app serves 30+ hosts and serverURL is deliberately unset (see payload.config.ts),
// so the reset link has to come from the request. The Host header is attacker-controlled
// in principle, so it is only trusted when it resolves to a known Site.
const resetOrigin = async (req: PayloadRequest): Promise<string> => {
  const host = req.headers?.get('host')
  if (!host || !/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return FALLBACK_ORIGIN
  const siteId = await resolveSiteIdStrict(req.payload, req.headers)
  return siteId ? `https://${host}` : FALLBACK_ORIGIN
}

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
    forgotPassword: {
      generateEmailSubject: () => 'Reset your Xenco Labs CMS password',
      generateEmailHTML: async (args) => {
        const req = (args as { req?: PayloadRequest } | undefined)?.req
        const token = (args as { token?: string } | undefined)?.token ?? ''
        const origin = req ? await resetOrigin(req) : FALLBACK_ORIGIN
        const url = `${origin}/admin/reset/${encodeURIComponent(token)}`

        return [
          '<p>A password reset was requested for this Xenco Labs CMS account.</p>',
          `<p><a href="${url}">Reset your password</a></p>`,
          `<p>Or paste this into your browser:<br>${url}</p>`,
          '<p>This link expires in one hour. If you did not request it, ignore this email — nothing changes.</p>',
        ].join('\n')
      },
    },
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
