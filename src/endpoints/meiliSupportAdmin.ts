// src/endpoints/meiliSupportAdmin.ts
// Admin endpoints for Support MeiliSearch configuration and resync
// Authenticated via Payload user API key (Authorization header)

import type { Endpoint } from 'payload'
import {
  getSupportMeiliClient,
  getSupportIndexName,
  toMeiliSupportDoc,
  ensureSupportIndexSettings,
} from '../lib/meiliSupport'

const SUPPORT_COLLECTIONS = [
  'support_kb_articles',
  'support_playbooks',
  'support_announcements',
] as const

/**
 * Verify user is authenticated and has admin role
 * Uses Payload's built-in API key auth via Authorization header:
 *   Authorization: users API-Key YOUR_API_KEY
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyAdmin(req: any): Promise<{ valid: boolean; user?: any; error?: string }> {
  const user = req.user

  if (!user) {
    return {
      valid: false,
      error: 'Unauthorized. Use header: Authorization: users API-Key YOUR_API_KEY',
    }
  }

  if (user.role !== 'admin') {
    return { valid: false, error: 'User does not have admin privileges' }
  }

  return { valid: true, user }
}

/**
 * POST /api/admin/meilisearch-support/configure
 * Configure Support MeiliSearch index settings (searchable, filterable, sortable fields)
 */
export const meiliSupportConfigureEndpoint: Endpoint = {
  path: '/admin/meilisearch-support/configure',
  method: 'post',
  handler: async (req) => {
    const auth = await verifyAdmin(req)
    if (!auth.valid) {
      return Response.json({ ok: false, error: auth.error }, { status: 401 })
    }

    const meili = getSupportMeiliClient()
    if (!meili) {
      return Response.json(
        { ok: false, error: 'MeiliSearch not configured (MEILISEARCH_HOST/KEY missing)' },
        { status: 500 },
      )
    }

    try {
      const indexName = getSupportIndexName()
      const index = meili.index(indexName)

      let currentSettings = null
      try {
        currentSettings = await index.getSettings()
      } catch {
        // Index might not exist yet
      }

      await ensureSupportIndexSettings()

      const newSettings = await index.getSettings()

      return Response.json({
        ok: true,
        message: 'Support MeiliSearch index configured successfully',
        indexName,
        settings: {
          searchableAttributes: newSettings.searchableAttributes,
          filterableAttributes: newSettings.filterableAttributes,
          sortableAttributes: newSettings.sortableAttributes,
        },
        previousSettings: currentSettings
          ? {
              searchableAttributes: currentSettings.searchableAttributes,
              filterableAttributes: currentSettings.filterableAttributes,
              sortableAttributes: currentSettings.sortableAttributes,
            }
          : null,
      })
    } catch (err: unknown) {
      const error = err as { message?: string }
      return Response.json(
        { ok: false, error: error.message || 'Failed to configure Support MeiliSearch' },
        { status: 500 },
      )
    }
  },
}

/**
 * POST /api/admin/meilisearch-support/resync
 * Resync all published support documents to MeiliSearch index
 */
export const meiliSupportResyncEndpoint: Endpoint = {
  path: '/admin/meilisearch-support/resync',
  method: 'post',
  handler: async (req) => {
    const auth = await verifyAdmin(req)
    if (!auth.valid) {
      return Response.json({ ok: false, error: auth.error }, { status: 401 })
    }

    const meili = getSupportMeiliClient()
    if (!meili) {
      return Response.json(
        { ok: false, error: 'MeiliSearch not configured (MEILISEARCH_HOST/KEY missing)' },
        { status: 500 },
      )
    }

    try {
      await ensureSupportIndexSettings()

      const indexName = getSupportIndexName()
      const index = meili.index(indexName)

      // Parse optional appSlug filter from request body
      let appSlugFilter: string | null = null
      try {
        const body = await req.json?.()
        if (body?.appSlug) {
          appSlugFilter = String(body.appSlug)
        }
      } catch {
        // No body or invalid JSON - continue without filter
      }

      const results: Record<string, { indexed: number; skipped: number }> = {}
      let totalIndexed = 0

      for (const collectionSlug of SUPPORT_COLLECTIONS) {
        const limit = 100
        let page = 1
        let indexed = 0
        let skipped = 0

        while (true) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const whereClause: any = { _status: { equals: 'published' } }

          if (appSlugFilter) {
            whereClause.appSlug = { equals: appSlugFilter }
          }

          const res = await req.payload.find({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            collection: collectionSlug as any,
            where: whereClause,
            limit,
            page,
            depth: 0,
            overrideAccess: true,
          })

          if (!res.docs?.length) break

          const docs = res.docs
            .map((d) => toMeiliSupportDoc(collectionSlug, d))
            .filter(
              (d): d is NonNullable<ReturnType<typeof toMeiliSupportDoc>> =>
                d !== null && d._status === 'published',
            )

          skipped += res.docs.length - docs.length

          if (docs.length) {
            await index.updateDocuments(docs)
            indexed += docs.length
          }

          if (page >= (res.totalPages ?? 1)) break
          page++
        }

        results[collectionSlug] = { indexed, skipped }
        totalIndexed += indexed
      }

      return Response.json({
        ok: true,
        message: 'Support MeiliSearch resync completed',
        totalIndexed,
        collections: results,
        ...(appSlugFilter ? { appSlug: appSlugFilter } : {}),
      })
    } catch (err: unknown) {
      const error = err as { message?: string }
      return Response.json(
        { ok: false, error: error.message || 'Failed to resync Support MeiliSearch' },
        { status: 500 },
      )
    }
  },
}

/**
 * GET /api/admin/meilisearch-support/status
 * Check Support MeiliSearch connection and index status
 */
export const meiliSupportStatusEndpoint: Endpoint = {
  path: '/admin/meilisearch-support/status',
  method: 'get',
  handler: async (req) => {
    const auth = await verifyAdmin(req)
    if (!auth.valid) {
      return Response.json({ ok: false, error: auth.error }, { status: 401 })
    }

    const meili = getSupportMeiliClient()
    if (!meili) {
      return Response.json(
        {
          ok: false,
          error: 'MeiliSearch not configured',
          configured: false,
          host: process.env.MEILISEARCH_HOST ? '(set)' : '(missing)',
          key: process.env.MEILISEARCH_KEY ? '(set)' : '(missing)',
        },
        { status: 500 },
      )
    }

    try {
      const indexName = getSupportIndexName()

      const health = await meili.health()

      let indexStats = null
      try {
        const index = meili.index(indexName)
        indexStats = await index.getStats()
      } catch {
        // Index might not exist
      }

      return Response.json({
        ok: true,
        configured: true,
        health: health.status,
        indexName,
        indexStats: indexStats
          ? {
              numberOfDocuments: indexStats.numberOfDocuments,
              isIndexing: indexStats.isIndexing,
            }
          : null,
        collections: SUPPORT_COLLECTIONS,
      })
    } catch (err: unknown) {
      const error = err as { message?: string }
      return Response.json(
        { ok: false, error: error.message || 'Failed to check Support MeiliSearch status' },
        { status: 500 },
      )
    }
  },
}
