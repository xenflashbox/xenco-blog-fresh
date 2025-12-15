import { MeiliSearch } from 'meilisearch'

function extractPlainText(value: any): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  const parts: string[] = []

  const visit = (node: any) => {
    if (!node) return
    if (typeof node.text === 'string') parts.push(node.text)
    if (Array.isArray(node.children)) node.children.forEach(visit)
  }

  // Lexical usually stores under { root: { children: [...] } }
  visit(value.root ?? value)

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export const reindexArticlesEndpoint = {
  path: '/reindex/articles',
  method: 'post',
  handler: async (req: any, res: any) => {
    // --- auth ---
    const provided =
      (req.headers?.['x-api-key'] as string | undefined) ??
      (req.headers?.['X-API-KEY'] as string | undefined) ??
      (typeof req.header === 'function' ? req.header('x-api-key') : undefined)

    const expected = process.env.REINDEX_API_KEY
    if (!expected || provided !== expected) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // --- meili ---
    const host =
      process.env.MEILI_HOST ||
      process.env.MEILI_URL ||
      process.env.MEILISEARCH_HOST ||
      process.env.MEILISEARCH_URL

    const apiKey =
      process.env.MEILI_API_KEY ||
      process.env.MEILISEARCH_API_KEY ||
      process.env.MEILI_MASTER_KEY

    if (!host || !apiKey) {
      return res.status(500).json({ error: 'Missing Meili env vars (host/apiKey)' })
    }

    const client = new MeiliSearch({ host, apiKey })
    const index = client.index('articles')

    // --- payload query + index ---
    let page = 1
    const limit = 100
    let indexed = 0

    while (true) {
      // req.payload is available in custom endpoints :contentReference[oaicite:1]{index=1}
      const result = await req.payload.find({
        collection: 'articles',
        where: { status: { equals: 'published' } },
        page,
        limit,
        depth: 0,
        overrideAccess: true, // helpful for internal/system calls :contentReference[oaicite:2]{index=2}
      })

      const docs = (result?.docs ?? []).map((a: any) => ({
        id: String(a.id),
        title: a.title ?? '',
        slug: a.slug ?? '',
        excerpt: a.excerpt ?? '',
        status: a.status ?? 'draft',
        publishedAt: a.publishedAt ?? null,
        updatedAt: a.updatedAt ?? null,
        categories: Array.isArray(a.categories) ? a.categories.map((x: any) => String(x)) : [],
        tags: Array.isArray(a.tags) ? a.tags.map((x: any) => String(x)) : [],
        contentText: extractPlainText(a.content),
      }))

      if (docs.length) {
        await index.addDocuments(docs)
        indexed += docs.length
      }

      if (!result?.hasNextPage) break
      page += 1
    }

    return res.status(200).json({ ok: true, indexed })
  },
}
