// src/collections/SupportKBArticles.ts
// Knowledge Base articles for chat widget support

import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from 'payload'
import { upsertSupportToMeili, deleteSupportFromMeili } from '../lib/meiliSupport'

const COLLECTION_SLUG = 'support_kb_articles'

const afterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    await upsertSupportToMeili(COLLECTION_SLUG, doc)
  } catch (err) {
    req.payload.logger.error(
      { err },
      'MeiliSearch support indexing failed (non-fatal). Document save succeeded.',
    )
  }
  return doc
}

const afterDelete: CollectionAfterDeleteHook = async ({ id, req }) => {
  try {
    await deleteSupportFromMeili(`${COLLECTION_SLUG}:${String(id)}`)
  } catch (err) {
    req.payload.logger.error({ err }, 'MeiliSearch support delete failed (non-fatal).')
  }
}

export const SupportKBArticles: CollectionConfig = {
  slug: COLLECTION_SLUG,
  admin: {
    group: 'Support',
    useAsTitle: 'title',
    defaultColumns: ['title', 'appSlug', '_status', 'updatedAt'],
    listSearchableFields: ['title', 'summary', 'appSlug'],
  },
  versions: {
    drafts: true,
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    afterChange: [afterChange],
    afterDelete: [afterDelete],
  },
  fields: [
    {
      name: 'appSlug',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'App identifier (e.g., "chat-widget", "dashboard")',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'summary',
      type: 'textarea',
      admin: {
        description: 'Brief description shown in search results',
      },
    },
    {
      name: 'routes',
      type: 'array',
      admin: {
        description: 'URL routes where this article is relevant',
      },
      fields: [
        {
          name: 'route',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
  ],
}
