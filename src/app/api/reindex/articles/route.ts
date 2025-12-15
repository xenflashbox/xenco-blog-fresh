import { NextResponse } from 'next/server'
import payload from 'payload'
import { upsertArticleToMeili } from '@/lib/meili'

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-api-key')
  if (!process.env.REINDEX_API_KEY || apiKey !== process.env.REINDEX_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pageSize = 50
  let page = 1
  let indexed = 0
  let failed = 0

  while (true) {
    const res = await payload.find({
      collection: 'articles',
      limit: pageSize,
      page,
      where: { status: { equals: 'published' } },
    })

    for (const doc of res.docs) {
      try {
        await upsertArticleToMeili(doc)
        indexed++
      } catch {
        failed++
      }
    }

    if (!res.hasNextPage) break
    page++
  }

  return NextResponse.json({ indexed, failed })
}
