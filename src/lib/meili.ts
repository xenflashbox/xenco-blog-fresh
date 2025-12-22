// src/lib/meili.ts
import { MeiliSearch } from 'meilisearch'

export function toMeiliArticleDoc(doc: unknown) {
  const a = doc as Record<string, unknown>
  const id = a.id
  if (typeof id !== 'string' && typeof id !== 'number') return null

  return {
    id: String(id),

    // IMPORTANT: store site as a FLAT string (prefer slug over id)
    site: asSlugOrId(a.site),

    title: typeof a.title === 'string' ? a.title : '',
    slug: typeof a.slug === 'string' ? a.slug : '',
    excerpt: typeof a.excerpt === 'string' ? a.excerpt : '',
    status: typeof a.status === 'string' ? a.status : '',

    publishedAt: a.publishedAt ? String(a.publishedAt) : null,
    updatedAt: a.updatedAt ? String(a.updatedAt) : null,

    // IMPORTANT: store categories/tags as FLAT string arrays (prefer slug over id)
    categories: asSlugOrIdArray(a.categories),
    tags: asSlugOrIdArray(a.tags),

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

    if (seen.has(obj as object)) return
    seen.add(obj as object)

    if (typeof obj.text === 'string') chunks.push(obj.text)

    if (obj.root && typeof obj.root === 'object') walk(obj.root)
    if (Array.isArray(obj.children)) walk(obj.children)
    if (obj.fields && typeof obj.fields === 'object') walk(obj.fields)
    if (obj.value && typeof obj.value === 'object') walk(obj.value)
  }

  walk(value)
  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Prefer slug when present, else id, else string/number.
 * This is what fixes your site/categories/tags filters.
 */
function asSlugOrId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)

  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (typeof v.slug === 'string' && v.slug.trim()) return v.slug
    if (typeof v.id === 'string' || typeof v.id === 'number') return String(v.id)
  }

  return null
}

function asSlugOrIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => asSlugOrId(v))
    .filter((v): v is string => Boolean(v))
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = setTimeout(() => {}, ms)
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Meili timeout')), ms)),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

let ensureSettingsPromise: Promise<void> | null = null

export async function ensureArticlesIndexSettings(): Promise<void> {
  const c = getClient()
  if (!c) return

  if (!ensureSettingsPromise) {
    ensureSettingsPromise = (async () => {
      const index = c.index(INDEX_NAME)

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (index as any).getRawInfo?.()
      } catch (e: unknown) {
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

      // Keep FLAT settings - site/categories/tags are now slugs not nested objects
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

  // IMPORTANT: site is now slug/id; must exist
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
