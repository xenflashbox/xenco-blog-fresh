// src/lib/meili.ts
import { MeiliSearch } from 'meilisearch'

export function toMeiliArticleDoc(doc: unknown) {
  const a = doc as Record<string, unknown>
  const id = a.id
  if (typeof id !== 'string' && typeof id !== 'number') return null

  return {
    id: String(id),
    site: asString(a.site),
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
}

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
  const chunks: string[] = []
  const seen = new WeakSet<object>()

  const walk = (node: unknown) => {
    if (!node) return

    if (Array.isArray(node)) {
      for (const n of node) walk(n)
      return
    }

    if (typeof node !== 'object') return
    const obj = node as Record<string, unknown>

    // Prevent re-walking the same object
    if (seen.has(obj as object)) return
    seen.add(obj as object)

    // Text nodes usually store actual text here
    if (typeof obj.text === 'string') chunks.push(obj.text)

    // Payload Lexical content commonly nests under root.children
    if (obj.root && typeof obj.root === 'object') walk(obj.root)

    // Standard Lexical trees use children arrays
    if (Array.isArray(obj.children)) walk(obj.children)

    // Only walk specific known nested fields to avoid re-walking
    if (obj.fields && typeof obj.fields === 'object') walk(obj.fields)
    if (obj.value && typeof obj.value === 'object') walk(obj.value)
  }

  walk(value)

  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    const id = (value as Record<string, unknown>).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
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

let ensureSettingsPromise: Promise<void> | null = null

export async function ensureArticlesIndexSettings(): Promise<void> {
  const c = getClient()
  if (!c) return

  if (!ensureSettingsPromise) {
    ensureSettingsPromise = (async () => {
      const index = c.index(INDEX_NAME)

      // Ensure index exists (create if missing)
      try {
        // Works in most Meili versions
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (index as any).getRawInfo?.()
      } catch (e: unknown) {
        // Create index if it doesn't exist
        const error = e as { status?: number; response?: { status?: number } }
        const status = error?.status ?? error?.response?.status
        if (status === 404) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const task = await (c as any).createIndex(INDEX_NAME, { primaryKey: 'id' })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (task?.taskUid && typeof (c as any).waitForTask === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await withTimeout((c as any).waitForTask(task.taskUid), 8000)
          }
        } else {
          throw e
        }
      }

      // Set best-practice search settings for Articles
      // (site/status/categories/tags filterable; dates sortable; content searchable)
      const task = await index.updateSettings({
        searchableAttributes: ['title', 'excerpt', 'contentText'],
        filterableAttributes: ['site', 'status', 'categories', 'tags'],
        sortableAttributes: ['publishedAt', 'updatedAt', 'title'],
        displayedAttributes: [
          'id',
          'site',
          'title',
          'slug',
          'excerpt',
          'status',
          'publishedAt',
          'updatedAt',
          'categories',
          'tags',
          'contentText',
        ],
      })

      // Wait if supported (helps make tests deterministic)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (task?.taskUid && typeof (c as any).waitForTask === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await withTimeout((c as any).waitForTask(task.taskUid), 8000)
      }
    })()
  }

  return ensureSettingsPromise
}

export async function upsertArticleToMeili(doc: unknown): Promise<void> {
  const c = getClient()
  if (!c) return

  await ensureArticlesIndexSettings()

  const payloadDoc = toMeiliArticleDoc(doc)
  if (!payloadDoc) return
  if (!payloadDoc.site) return

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
export function getMeiliClient(): MeiliSearch | null {
  return getClient()
}
