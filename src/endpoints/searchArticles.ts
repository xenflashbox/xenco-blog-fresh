import type { Endpoint } from 'payload'
import { getMeiliClient, ensureArticlesIndexSettings } from '../lib/meili'
import { resolveSiteForRequest } from '../lib/site'

export const searchArticlesEndpoint: Endpoint = {
  path: '/search',
  method: 'get',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: async (req: any) => {
    const q = typeof req?.query?.q === 'string' ? req.query.q.trim() : ''
    const limit = Math.min(50, Math.max(1, Number(req?.query?.limit ?? 10) || 10))
    const page = Math.max(1, Number(req?.query?.page ?? 1) || 1)

    if (!q) {
      return new Response(JSON.stringify({ ok: true, q, results: [], page, limit, total: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    // Resolve site: try siteSlug query param, then x-site-slug header, then fallback to host resolution
    let site: { id: string } | null = null

    const siteSlug = typeof req?.query?.siteSlug === 'string' ? req.query.siteSlug.trim() : null
    const siteSlugHeader =
      typeof req?.headers?.get === 'function'
        ? req.headers.get('x-site-slug')
        : req?.headers?.['x-site-slug'] || req?.headers?.['X-Site-Slug'] || null

    if (siteSlug) {
      // Lookup by slug
      const bySlug = await req.payload.find({
        collection: 'sites',
        where: { slug: { equals: siteSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (bySlug.docs?.[0]?.id) {
        site = { id: String(bySlug.docs[0].id) }
      }
    } else if (siteSlugHeader) {
      // Lookup by slug from header
      const bySlug = await req.payload.find({
        collection: 'sites',
        where: { slug: { equals: siteSlugHeader } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (bySlug.docs?.[0]?.id) {
        site = { id: String(bySlug.docs[0].id) }
      }
    }

    // Fallback to host-based resolution
    if (!site) {
      site = await resolveSiteForRequest(req.payload, req.headers)
    }

    if (!site?.id) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'No site found. Create a default Site (isDefault=true).',
        }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      )
    }

    const meili = getMeiliClient()
    if (!meili) {
      return new Response(JSON.stringify({ ok: false, error: 'MeiliSearch not configured.' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }

    await ensureArticlesIndexSettings()

    const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
    const index = meili.index(indexName)

    const siteId = String(site.id)
    const offset = (page - 1) * limit

    // Use single AND string filter (critical for multi-site safety)
    const filter = `site = "${siteId}" AND status = "published"`

    const res = await index.search(q, {
      limit,
      offset,
      filter,
    })

    // Shape results: exclude large contentText, keep essential fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shapedResults = res.hits.map((hit: any) => {
      const { contentText, ...rest } = hit
      // Optionally include a snippet if needed
      const contentTextSnippet =
        typeof contentText === 'string' && contentText.length > 0
          ? contentText.substring(0, 300).trim() + (contentText.length > 300 ? '...' : '')
          : null
      return {
        ...rest,
        ...(contentTextSnippet ? { contentTextSnippet } : {}),
      }
    })

    return new Response(
      JSON.stringify({
        ok: true,
        q,
        siteId,
        page,
        limit,
        total: res.estimatedTotalHits ?? res.hits.length,
        results: shapedResults,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  },
}
