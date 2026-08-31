import type { Access, Where } from 'payload'
import { resolveSiteIdStrict } from '../lib/site'

/**
 * Read scoping for every tenant-scoped collection.
 *
 * Scope is derived from the request's Host header, not from the collection and
 * not from the caller's own site, so one rule behaves correctly for anonymous
 * frontend traffic, per-tenant API keys and the admin panel alike.
 *
 *   unresolved Host  anonymous            -> deny
 *   unresolved Host  authenticated        -> unscoped (internal/machine callers
 *                                            reaching the app directly rather
 *                                            than through the edge; traefik only
 *                                            routes hosts that do resolve)
 *   resolved Host    admin via admin panel -> unscoped (fleet management)
 *   resolved Host    everyone else         -> scoped to that site
 *
 * An explicit ?where[site] in the query is ANDed with what we return, so a
 * caller can narrow within their own site but can never widen past it.
 */
export const siteScopedRead: Access = async ({ req }) => {
  const siteId = await resolveSiteIdStrict(req.payload, req.headers)

  if (!siteId) return Boolean(req.user)

  // Admin-panel sessions keep cross-site visibility; an admin-role API key does
  // not, since that is a per-tenant credential handed to a frontend.
  if (req.user?.role === 'admin' && (req.user as { _strategy?: string })._strategy !== 'api-key') {
    return true
  }

  return { site: { equals: Number(siteId) } }
}

/** siteScopedRead, ANDed with an extra constraint for anonymous callers. */
export const siteScopedReadWith =
  (anonymousConstraint: Where): Access =>
  async (args) => {
    const scope = await siteScopedRead(args)
    if (scope === false) return false
    if (args.req.user) return scope

    return scope === true ? anonymousConstraint : { and: [scope as Where, anonymousConstraint] }
  }
