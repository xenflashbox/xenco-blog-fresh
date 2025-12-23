// src/lib/meiliSupport.ts
// MeiliSearch integration for Support collections (KB Articles, Playbooks, Announcements)

import { MeiliSearch } from 'meilisearch'

// --- env
const MEILI_HOST = process.env.MEILISEARCH_HOST
const MEILI_KEY = process.env.MEILISEARCH_KEY
const SUPPORT_INDEX = process.env.MEILISEARCH_SUPPORT_INDEX || 'support'

let client: MeiliSearch | null = null

function getClient(): MeiliSearch | null {
  if (!MEILI_HOST || !MEILI_KEY) return null
  if (!client) client = new MeiliSearch({ host: MEILI_HOST, apiKey: MEILI_KEY })
  return client
}

// --- reuse lexical extractor logic from meili.ts
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

export async function ensureSupportIndexSettings(): Promise<void> {
  const c = getClient()
  if (!c) return

  if (!ensureSettingsPromise) {
    ensureSettingsPromise = (async () => {
      const index = c.index(SUPPORT_INDEX)

      // create index if missing
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (index as any).getRawInfo?.()
      } catch (e: unknown) {
        const error = e as { status?: number; response?: { status?: number } }
        const status = error?.status ?? error?.response?.status
        if (status === 404) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const task = await (c as any).createIndex(SUPPORT_INDEX, { primaryKey: 'id' })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (task?.taskUid && typeof (c as any).waitForTask === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await withTimeout((c as any).waitForTask(task.taskUid), 8000)
          }
        } else {
          throw e
        }
      }

      // Common question words (both cases since MeiliSearch stop words are case-sensitive)
      const stopWords = [
        'how', 'How', 'what', 'What', 'where', 'Where', 'when', 'When', 'why', 'Why',
        'who', 'Who', 'which', 'Which', 'do', 'Do', 'does', 'Does', 'did', 'Did',
        'can', 'Can', 'could', 'Could', 'would', 'Would', 'should', 'Should',
        'is', 'Is', 'are', 'Are', 'was', 'Was', 'were', 'Were',
        'be', 'Be', 'been', 'Been', 'being', 'Being',
        'have', 'Have', 'has', 'Has', 'had', 'Had',
        'a', 'A', 'an', 'An', 'the', 'The',
        'i', 'I', 'me', 'Me', 'my', 'My',
        'to', 'To', 'for', 'For', 'of', 'Of', 'in', 'In', 'on', 'On', 'at', 'At',
        'and', 'And', 'or', 'Or', 'but', 'But', 'if', 'If',
        'it', 'It', 'its', 'Its', 'this', 'This', 'that', 'That',
        'these', 'These', 'those', 'Those', 'with', 'With',
      ]

      const task = await index.updateSettings({
        searchableAttributes: ['title', 'summary', 'bodyText', 'stepsText', 'triggersText'],
        filterableAttributes: ['appSlug', 'type', '_status', 'routes', 'severity'],
        sortableAttributes: ['updatedAt', 'title'],
        stopWords,
        displayedAttributes: [
          'id',
          'type',
          'appSlug',
          'title',
          'summary',
          'bodyText',
          'stepsText',
          'triggersText',
          'routes',
          'severity',
          '_status',
          'updatedAt',
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

// Normalizers per collection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toMeiliSupportDoc(collection: string, doc: any) {
  const id = doc?.id
  if (typeof id !== 'string' && typeof id !== 'number') return null

  const base = {
    // MeiliSearch IDs can only contain alphanumeric, hyphens, underscores (no colons)
    id: `${collection}_${String(id)}`,
    type: collection,
    appSlug: typeof doc.appSlug === 'string' ? doc.appSlug : '',
    title: typeof doc.title === 'string' ? doc.title : '',
    summary:
      typeof doc.summary === 'string'
        ? doc.summary
        : typeof doc.message === 'string'
          ? doc.message
          : '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    routes: Array.isArray(doc.routes) ? doc.routes.map((r: any) => r?.route).filter(Boolean) : [],
    severity: typeof doc.severity === 'string' ? doc.severity : null,
    _status: typeof doc._status === 'string' ? doc._status : 'draft',
    updatedAt: doc.updatedAt ? String(doc.updatedAt) : null,
  }

  // bodyText
  const bodyText =
    typeof doc.bodyText === 'string'
      ? doc.bodyText
      : doc.body
        ? extractTextFromLexical(doc.body)
        : ''

  // playbook steps/triggers
  const stepsText = Array.isArray(doc.steps)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? doc.steps.map((s: any) => `${s?.stepTitle ?? ''} ${s?.stepBody ?? ''}`).join(' ')
    : ''
  const triggersText = Array.isArray(doc.triggers)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? doc.triggers.map((t: any) => t?.phrase).filter(Boolean).join(' ')
    : ''

  return { ...base, bodyText, stepsText, triggersText }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function upsertSupportToMeili(collection: string, doc: any): Promise<void> {
  const c = getClient()
  if (!c) return
  await ensureSupportIndexSettings()

  const mapped = toMeiliSupportDoc(collection, doc)
  if (!mapped) return

  // Only index published docs (drafts should not appear)
  if (mapped._status !== 'published') return

  const index = c.index(SUPPORT_INDEX)
  await withTimeout(index.updateDocuments([mapped]), 4000)
}

export async function deleteSupportFromMeili(objectId: string): Promise<void> {
  const c = getClient()
  if (!c) return
  const index = c.index(SUPPORT_INDEX)
  await withTimeout(index.deleteDocument(objectId), 4000)
}

export function getSupportMeiliClient(): MeiliSearch | null {
  return getClient()
}

export function getSupportIndexName(): string {
  return SUPPORT_INDEX
}
