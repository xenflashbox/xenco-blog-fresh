// src/lib/meili.ts
import { MeiliSearch } from 'meilisearch'

const MEILI_HOST = process.env.MEILISEARCH_HOST
const MEILI_KEY = process.env.MEILISEARCH_KEY
const INDEX_NAME = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'

let client: MeiliSearch | null = null

function getClient(): MeiliSearch | null {
  if (!MEILI_HOST || !MEILI_KEY) return null
  if (!client) client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY })
  return client
}

function extractTextFromLexical(value: unknown): string {
  // Very defensive “best effort” extractor that won’t throw.
  const chunks: string[] = []

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>

    if (typeof obj.text === 'string') chunks.push(obj.text)

    const children = obj.children
    if (Array.isArray(children)) children.forEach(walk)
  }

  // Payload Lexical is usually { root: { children: [...] } } but we handle anything
  walk(value)
  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => {
      if (typeof v === 'string' || typeof v === 'number') return String(v)
      if (v && typeof v === 'object' && 'id' in (v as Record<string, unknown>)) {
        const id = (v as Record<string, unknown>).id
        if (typeof id === 'string' || typeof id === 'number') return String(id)
      }
      return null
    })
    .filter((v): v is string => Boolean(v))
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ms)

  try {
    // meilisearch client supports fetch under the hood; we can’t pass signal easily everywhere,
    // so we just race it (still prevents long hangs).
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Meili timeout')), ms)),
    ])
  } finally {
    clearTimeout(timeout)
    controller.abort()
  }
}

export async function upsertArticleToMeili(doc: unknown): Promise<void> {
  const c = getClient()
  if (!c) return

  const a = doc as Record<string, unknown>
  const id = a.id
  if (typeof id !== 'string' && typeof id !== 'number') return

  const payloadDoc = {
    id: String(id),
    title: typeof a.title === 'string' ? a.title : '',
    slug: typeof a.slug === 'string' ? a.slug : '',
    excerpt: typeof a.excerpt === 'string' ? a.excerpt : '',
    status: typeof a.status === 'string' ? a.status : '',
    publishedAt: a.publishedAt ? String(a.publishedAt) : null,
    updatedAt: a.updatedAt ? String(a.updatedAt) : null,
    categories: asStringArray(a.categories),
    tags: asStringArray(a.tags),
    contentText: extractTextFromLexical(a.content),
  }

  const index = c.index(INDEX_NAME)
  await withTimeout(index.updateDocuments([payloadDoc]), 4000)
}

export async function deleteArticleFromMeili(id: string): Promise<void> {
  const c = getClient()
  if (!c) return
  if (!id) return

  const index = c.index(INDEX_NAME)
  await withTimeout(index.deleteDocument(id), 4000)
}
