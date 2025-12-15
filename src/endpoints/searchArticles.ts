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

    // Resolve site using shared helper
    const site = await resolveSiteForRequest(req.payload, req.headers)

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

    return new Response(
      JSON.stringify({
        ok: true,
        q,
        siteId,
        page,
        limit,
        total: res.estimatedTotalHits ?? res.hits.length,
        results: res.hits,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  },
}
