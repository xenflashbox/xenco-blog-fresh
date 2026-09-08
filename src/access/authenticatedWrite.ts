import type { Access } from 'payload'

/**
 * Write gate for every collection an integration writes to.
 *
 * Gates on the presence of a user only, deliberately not on the auth scheme:
 * BlogCraft's writes have been observed under both `Authorization: users
 * API-Key <key>` and `Bearer <token>`, and Payload resolves both to req.user.
 * Requiring a particular header shape here would break one of them.
 */
export const authenticatedWrite: Access = ({ req }) => Boolean(req.user)
