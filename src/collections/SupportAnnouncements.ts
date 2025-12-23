// src/collections/SupportAnnouncements.ts
// Announcements for chat widget support (outages, updates, etc.)

import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from 'payload'
import { upsertSupportToMeili, deleteSupportFromMeili } from '../lib/meiliSupport'

const COLLECTION_SLUG = 'support_announcements'

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

export const SupportAnnouncements: CollectionConfig = {
  slug: COLLECTION_SLUG,
  admin: {
    group: 'Support',
    useAsTitle: 'title',
    defaultColumns: ['title', 'appSlug', 'severity', '_status', 'updatedAt'],
    listSearchableFields: ['title', 'message', 'appSlug'],
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
        description: 'App identifier (e.g., "chat-widget", "dashboard", or "*" for all)',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      admin: {
        description: 'The announcement message (shown in search results as summary)',
      },
    },
    {
      name: 'severity',
      type: 'select',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Critical', value: 'critical' },
      ],
      defaultValue: 'info',
      admin: {
        description: 'Severity level for visual styling',
      },
    },
    {
      name: 'routes',
      type: 'array',
      admin: {
        description: 'URL routes where this announcement should appear',
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
      name: 'startsAt',
      type: 'date',
      admin: {
        description: 'When this announcement becomes active',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'When this announcement should no longer appear',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
}
