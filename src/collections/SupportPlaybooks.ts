// src/collections/SupportPlaybooks.ts
// Step-by-step playbooks for chat widget support agents

import type {
  CollectionConfig,
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
} from 'payload'
import { upsertSupportToMeili, deleteSupportFromMeili } from '../lib/meiliSupport'

const COLLECTION_SLUG = 'support_playbooks'

const afterChange: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    const objectId = `${COLLECTION_SLUG}_${String(doc?.id)}`

    if (doc?._status !== 'published') {
      await deleteSupportFromMeili(objectId)
      return doc
    }

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
    await deleteSupportFromMeili(`${COLLECTION_SLUG}_${String(id)}`)
  } catch (err) {
    req.payload.logger.error({ err }, 'MeiliSearch support delete failed (non-fatal).')
  }
}

export const SupportPlaybooks: CollectionConfig = {
  slug: COLLECTION_SLUG,
  admin: {
    group: 'Support',
    useAsTitle: 'title',
    defaultColumns: ['title', 'appSlug', 'severity', '_status', 'updatedAt'],
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
        description: 'Brief description of what this playbook handles',
      },
    },
    {
      name: 'severity',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
        { label: 'Critical', value: 'critical' },
      ],
      defaultValue: 'medium',
      admin: {
        description: 'Priority level for this playbook',
      },
    },
    {
      name: 'routes',
      type: 'array',
      admin: {
        description: 'URL routes where this playbook is relevant',
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
      name: 'triggers',
      type: 'array',
      admin: {
        description: 'Keywords/phrases that trigger this playbook',
      },
      fields: [
        {
          name: 'phrase',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'steps',
      type: 'array',
      required: true,
      admin: {
        description: 'Step-by-step instructions for handling this scenario',
      },
      fields: [
        {
          name: 'stepTitle',
          type: 'text',
          required: true,
          admin: {
            description: 'Brief title for this step',
          },
        },
        {
          name: 'stepBody',
          type: 'textarea',
          required: true,
          admin: {
            description: 'Detailed instructions for this step',
          },
        },
      ],
    },
  ],
}
