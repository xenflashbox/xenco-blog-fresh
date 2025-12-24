import type { Endpoint } from 'payload'
import { getMeiliClient, toMeiliArticleDoc, ensureArticlesIndexSettings } from '../lib/meili'

export const reindexArticlesEndpoint: Endpoint = {
  path: '/reindex/articles',
  method: 'post',
  handler: async (req) => {
    // Fix: Use dual-mode header access pattern for compatibility
    const apiKey =
      typeof req.headers?.get === 'function'
        ? req.headers.get('x-api-key')
        : (req.headers as Record<string, string>)?.['x-api-key'] ||
          (req.headers as Record<string, string>)?.['X-API-KEY']

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

    await ensureArticlesIndexSettings()

    const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
    const index = meili.index(indexName)

    const limit = 100
    let page = 1
    let indexed = 0
    let skippedMissingSite = 0

    while (true) {
      const res = await req.payload.find({
        collection: 'articles',
        where: { status: { equals: 'published' } },
        limit,
        page,
        depth: 1, // IMPORTANT: depth 1 to get site/categories/tags with slugs
        overrideAccess: true,
      })

      if (!res.docs?.length) break

      const mapped = res.docs
        .map((d) => toMeiliArticleDoc(d))
        .filter((d): d is NonNullable<ReturnType<typeof toMeiliArticleDoc>> => Boolean(d))

      const docs = mapped.filter((d) => {
        const ok = Boolean(d.site)
        if (!ok) skippedMissingSite++
        return ok
      })

      if (docs.length) {
        // Fix: Wait for task completion before continuing
        const task = await index.updateDocuments(docs)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (task?.taskUid && typeof (meili as any).waitForTask === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (meili as any).waitForTask(task.taskUid)
        }
        indexed += docs.length
      }

      if (page >= (res.totalPages ?? 1)) break
      page++
    }

    return Response.json({ ok: true, indexed, skippedMissingSite })
  },
}
