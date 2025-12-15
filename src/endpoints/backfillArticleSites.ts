import type { Endpoint } from 'payload'

export const backfillArticleSitesEndpoint: Endpoint = {
  path: '/backfill/articles/site',
  method: 'post',
  handler: async (req) => {
    const apiKey = req.headers?.get?.('x-api-key')

    if (!apiKey || apiKey !== process.env.REINDEX_API_KEY) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Resolve default site id (must exist)
    const defaultSites = await req.payload.find({
      collection: 'sites',
      where: { isDefault: { equals: true } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const defaultSite = defaultSites.docs?.[0]
    if (!defaultSite?.id) {
      return Response.json(
        { ok: false, error: 'No default site found. Create a Site with isDefault=true.' },
        { status: 500 }
      )
    }

    const defaultSiteId = String(defaultSite.id)

    // Find Articles where site is missing/null
    const limit = 100
    let page = 1
    let updated = 0
    let scanned = 0

    while (true) {
      const res = await req.payload.find({
        collection: 'articles',
        where: {
          or: [
            { site: { exists: false } },
            { site: { equals: null } },
          ],
        },
        limit,
        page,
        depth: 0,
        overrideAccess: true,
      })

      if (!res.docs?.length) break

      scanned += res.docs.length

      // Update each article to set site = defaultSiteId
      for (const doc of res.docs) {
        try {
          await req.payload.update({
            collection: 'articles',
            id: String(doc.id),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: { site: defaultSiteId } as any,
            overrideAccess: true,
          })
          updated++
        } catch (err) {
          req.payload.logger.error({ err, articleId: doc.id }, 'Failed to update article site')
        }
      }

      if (page >= (res.totalPages ?? 1)) break
      page++
    }

    return Response.json({ ok: true, updated, scanned })
  },
}

