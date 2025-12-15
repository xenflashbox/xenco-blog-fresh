import type { Endpoint } from 'payload'

import { getMeiliClient, toMeiliArticleDoc } from '@/lib/meili'

export const reindexArticlesEndpoint: Endpoint = {
  path: '/reindex/articles',
  method: 'post',
  handler: async (req) => {
    const apiKey = req.headers?.get?.('x-api-key')

    if (!apiKey || apiKey !== process.env.REINDEX_API_KEY) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const meili = getMeiliClient()
    if (!meili) {
      return Response.json(
        { ok: false, error: 'MeiliSearch not configured (MEILISEARCH_HOST/KEY missing)' },
        { status: 500 },
      )
    }

    const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
    const index = meili.index(indexName)

    const limit = 100
    let page = 1
    let indexed = 0

    while (true) {
      const res = await req.payload.find({
        collection: 'articles',
        where: { status: { equals: 'published' } },
        limit,
        page,
        depth: 0,
        overrideAccess: true,
      })

      if (!res.docs?.length) break

      const docs = res.docs
        .map((d) => toMeiliArticleDoc(d))
        .filter((d): d is NonNullable<ReturnType<typeof toMeiliArticleDoc>> => Boolean(d))

      if (docs.length) {
        await index.updateDocuments(docs)
        indexed += docs.length
      }

      if (page >= (res.totalPages ?? 1)) break
      page++
    }

    return Response.json({ ok: true, indexed })
  },
}
