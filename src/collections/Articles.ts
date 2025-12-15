// src/collections/Articles.ts
import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
} from 'payload'

import { upsertArticleToMeili, deleteArticleFromMeili } from '../lib/meili'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const beforeChange: CollectionBeforeChangeHook = async ({ data }) => {
  if (!data) return data

  // Auto-slug if missing
  if (typeof data.title === 'string' && (!data.slug || typeof data.slug !== 'string')) {
    data.slug = slugify(data.title)
  }

  // If publishing and publishedAt not set, set it
  if (data.status === 'published' && !data.publishedAt) {
    data.publishedAt = new Date().toISOString()
  }

  return data
}

const afterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  // Only index published docs; delete from index if it was published and is no longer published
  const isPublishedNow = (doc as { status?: unknown })?.status === 'published'
  const wasPublished = (previousDoc as { status?: unknown } | undefined)?.status === 'published'

  try {
    if (isPublishedNow) {
      await upsertArticleToMeili(doc)
    } else if (wasPublished) {
      await deleteArticleFromMeili(String((doc as { id?: unknown })?.id ?? ''))
    }
  } catch (err) {
    // IMPORTANT: never break the CMS UI for search indexing issues
    req.payload.logger.error(
      { err },
      'MeiliSearch indexing failed (non-fatal). Article save succeeded.'
    )
  }

  return doc
}

const afterDelete: CollectionAfterDeleteHook = async ({ id, req }) => {
  try {
    await deleteArticleFromMeili(String(id))
  } catch (err) {
    req.payload.logger.error({ err }, 'MeiliSearch delete failed (non-fatal).')
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
    beforeChange: [beforeChange],
    afterChange: [afterChange],
    afterDelete: [afterDelete],
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
