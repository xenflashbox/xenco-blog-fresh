// src/endpoints/meiliAdmin.ts
// Admin endpoints for MeiliSearch configuration and resync
// Authenticated via Payload user API key (x-api-key header)

import type { Endpoint } from 'payload'
import { getMeiliClient, toMeiliArticleDoc, ensureArticlesIndexSettings } from '../lib/meili'

/**
 * Verify API key from header against Users collection
 */
async function verifyApiKey(req: any): Promise<{ valid: boolean; user?: any; error?: string }> {
  const apiKeyHeader = req.headers?.get?.('x-api-key') || req.headers?.['x-api-key']

  if (!apiKeyHeader) {
    return { valid: false, error: 'Missing x-api-key header' }
  }

  // Find user by API key
  const result = await req.payload.find({
    collection: 'users',
    where: {
      apiKey: { equals: apiKeyHeader },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (!result.docs?.length) {
    return { valid: false, error: 'Invalid API key' }
  }

  const user = result.docs[0]

  // Check if user has admin role
  if (user.role !== 'admin') {
    return { valid: false, error: 'API key does not have admin privileges' }
  }

  return { valid: true, user }
}

/**
 * POST /api/admin/meilisearch/configure
 * Configure MeiliSearch index settings (searchable, filterable, sortable fields)
 */
export const meiliConfigureEndpoint: Endpoint = {
  path: '/admin/meilisearch/configure',
  method: 'post',
  handler: async (req) => {
    // Verify API key
    const auth = await verifyApiKey(req)
    if (!auth.valid) {
      return Response.json({ ok: false, error: auth.error }, { status: 401 })
    }

    const meili = getMeiliClient()
    if (!meili) {
      return Response.json(
        { ok: false, error: 'MeiliSearch not configured (MEILISEARCH_HOST/KEY missing)' },
        { status: 500 },
      )
    }

    try {
      const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
      const index = meili.index(indexName)

      // Get current settings first
      let currentSettings = null
      try {
        currentSettings = await index.getSettings()
      } catch {
        // Index might not exist yet
      }

      // Apply settings (ensureArticlesIndexSettings handles creation if needed)
      await ensureArticlesIndexSettings()

      // Get updated settings
      const newSettings = await index.getSettings()

      return Response.json({
        ok: true,
        message: 'MeiliSearch index configured successfully',
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
    } catch (err: any) {
      return Response.json(
        { ok: false, error: err.message || 'Failed to configure MeiliSearch' },
        { status: 500 },
      )
    }
  },
}

/**
 * POST /api/admin/meilisearch/resync
 * Resync all published articles to MeiliSearch index
 */
export const meiliResyncEndpoint: Endpoint = {
  path: '/admin/meilisearch/resync',
  method: 'post',
  handler: async (req) => {
    // Verify API key
    const auth = await verifyApiKey(req)
    if (!auth.valid) {
      return Response.json({ ok: false, error: auth.error }, { status: 401 })
    }

    const meili = getMeiliClient()
    if (!meili) {
      return Response.json(
        { ok: false, error: 'MeiliSearch not configured (MEILISEARCH_HOST/KEY missing)' },
        { status: 500 },
      )
    }

    try {
      // Ensure index settings are configured
      await ensureArticlesIndexSettings()

      const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
      const index = meili.index(indexName)

      // Parse optional siteId from request body
      let siteFilter: number | null = null
      try {
        const body = await req.json?.()
        if (body?.siteId) {
          siteFilter = Number(body.siteId)
        }
      } catch {
        // No body or invalid JSON - continue without site filter
      }

      const limit = 100
      let page = 1
      let indexed = 0
      let skippedMissingSite = 0
      let skippedWrongSite = 0

      while (true) {
        const whereClause: any = { status: { equals: 'published' } }

        // If site filter provided, only fetch articles for that site
        if (siteFilter) {
          whereClause.site = { equals: siteFilter }
        }

        const res = await req.payload.find({
          collection: 'articles',
          where: whereClause,
          limit,
          page,
          depth: 0,
          overrideAccess: true,
        })

        if (!res.docs?.length) break

        const mapped = res.docs
          .map((d) => toMeiliArticleDoc(d))
          .filter((d): d is NonNullable<ReturnType<typeof toMeiliArticleDoc>> => Boolean(d))

        const docs = mapped.filter((d) => {
          if (!d.site) {
            skippedMissingSite++
            return false
          }
          return true
        })

        if (docs.length) {
          await index.updateDocuments(docs)
          indexed += docs.length
        }

        if (page >= (res.totalPages ?? 1)) break
        page++
      }

      return Response.json({
        ok: true,
        message: 'MeiliSearch resync completed',
        indexed,
        skippedMissingSite,
        ...(siteFilter ? { siteId: siteFilter } : {}),
      })
    } catch (err: any) {
      return Response.json(
        { ok: false, error: err.message || 'Failed to resync MeiliSearch' },
        { status: 500 },
      )
    }
  },
}

/**
 * GET /api/admin/meilisearch/status
 * Check MeiliSearch connection and index status
 */
export const meiliStatusEndpoint: Endpoint = {
  path: '/admin/meilisearch/status',
  method: 'get',
  handler: async (req) => {
    // Verify API key
    const auth = await verifyApiKey(req)
    if (!auth.valid) {
      return Response.json({ ok: false, error: auth.error }, { status: 401 })
    }

    const meili = getMeiliClient()
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
      const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'

      // Check health
      const health = await meili.health()

      // Get index stats
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
      })
    } catch (err: any) {
      return Response.json(
        { ok: false, error: err.message || 'Failed to check MeiliSearch status' },
        { status: 500 },
      )
    }
  },
}
