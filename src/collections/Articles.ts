// src/collections/Articles.ts
import type {
  AfterChangeHook,
  AfterDeleteHook,
  BeforeChangeHook,
  CollectionConfig,
} from 'payload'

import { getMeili } from '../lib/meili'

const INDEX_NAME = process.env.MEILI_ARTICLES_INDEX || 'articles'

// Best-effort Lexical -> plain text for search
function lexicalToText(value: unknown): string {
  const out: string[] = []

  const walk = (node: unknown) => {
    if (!node) return

    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }

    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>

      // Lexical text nodes typically have { text: "..." }
      if (typeof obj.text === 'string') out.push(obj.text)

      // Walk everything else
      for (const v of Object.values(obj)) walk(v)
    }
  }

  walk(value)
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

// Normalize relationship values (ids or objects)
function normalizeRel(v: unknown): Array<string> {
  if (!v) return []
  if (!Array.isArray(v)) v = [v]

  return (v as unknown[])
    .map((item) => {
      if (!item) return null
      if (typeof item === 'string' || typeof item === 'number') return String(item)
      if (typeof item === 'object' && 'id' in (item as any)) return String((item as any).id)
      return null
    })
    .filter(Boolean) as string[]
}

let settingsApplied = false
async function ensureMeiliSettings() {
  const client = getMeili()
  if (!client || settingsApplied) return

  try {
    const index = client.index(INDEX_NAME)

    // Safe defaults for filtering/sorting
    await index.updateSettings({
      filterableAttributes: ['status', 'categories', 'tags'],
      sortableAttributes: ['publishedAt', 'createdAt', 'updatedAt'],
      searchableAttributes: ['title', 'excerpt', 'contentText'],
    })

    settingsApplied = true
  } catch {
    // Don’t crash CMS if Meili is temporarily unavailable
  }
}

const setPublishedAt: BeforeChangeHook = async ({ data, originalDoc }) => {
  // Only set publishedAt when transitioning to published
  const nextStatus = data?.status
  const prevStatus = (originalDoc as any)?.status

  if (nextStatus === 'published' && prevStatus !== 'published') {
    if (!data.publishedAt) {
      data.publishedAt = new Date().toISOString()
    }
  }

  return data
}

const syncToMeili: AfterChangeHook = async ({ doc, req }) => {
  const client = getMeili()
  if (!client) return doc // env not configured: do nothing

  await ensureMeiliSettings()

  const status = (doc as any).status
  const id = String((doc as any).id)

  const index = client.index(INDEX_NAME)

  // If not published, ensure it's removed from search
  if (status !== 'published') {
    try {
      await index.deleteDocument(id)
    } catch {
      // ignore
    }
    return doc
  }

  const record = {
    id,
    title: (doc as any).title,
    slug: (doc as any).slug,
    excerpt: (doc as any).excerpt || '',
    status,
    publishedAt: (doc as any).publishedAt || null,
    createdAt: (doc as any).createdAt || null,
    updatedAt: (doc as any).updatedAt || null,

    // Filters
    categories: normalizeRel((doc as any).categories),
    tags: normalizeRel((doc as any).tags),

    // Full-text
    contentText: lexicalToText((doc as any).content),
  }

  try {
    await index.addDocuments([record], { primaryKey: 'id' })
  } catch (err) {
    req.payload.logger.warn({ err }, 'MeiliSearch indexing failed (non-fatal)')
  }

  return doc
}

const removeFromMeili: AfterDeleteHook = async ({ doc, req }) => {
  const client = getMeili()
  if (!client) return

  const index = client.index(INDEX_NAME)
  const id = String((doc as any)?.id)

  if (!id) return

  try {
    await index.deleteDocument(id)
  } catch (err) {
    req.payload.logger.warn({ err }, 'MeiliSearch delete failed (non-fatal)')
  }
}

export const Articles: CollectionConfig = {
  slug: 'articles',
  admin: { useAsTitle: 'title' },

  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },

  hooks: {
    beforeChange: [setPublishedAt],
    afterChange: [syncToMeili],
    afterDelete: [removeFromMeili],
  },

  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },

    {
      name: 'excerpt',
      type: 'textarea',
      admin: { description: 'Short summary used on listing pages / previews.' },
    },

    { name: 'content', type: 'richText' },

    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: { position: 'sidebar' },
    },

    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
      defaultValue: 'draft',
      required: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { position: 'sidebar' },
    },
  ],
}
