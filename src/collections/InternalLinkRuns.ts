import type { CollectionConfig } from 'payload'

export const InternalLinkRuns: CollectionConfig = {
  slug: 'internal_link_runs',
  admin: {
    useAsTitle: 'lockKey',
    defaultColumns: ['createdAt', 'site', 'mode', 'status', 'startedAt', 'endedAt'],
    group: 'SEO',
    description:
      'Run internal linker manually via endpoint: POST /api/internal-links/run?mode=dry_run|apply&site=all|<id>',
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      index: true,
      required: false,
    },
    {
      name: 'mode',
      type: 'select',
      required: true,
      options: [
        { label: 'Dry run', value: 'dry_run' },
        { label: 'Apply', value: 'apply' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Running', value: 'running' },
        { label: 'Succeeded', value: 'succeeded' },
        { label: 'Failed', value: 'failed' },
        { label: 'Partial', value: 'partial' },
      ],
    },
    {
      name: 'strategyVersion',
      type: 'text',
      required: true,
    },
    {
      name: 'trigger',
      type: 'select',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Endpoint', value: 'endpoint' },
      ],
      required: true,
    },
    { name: 'startedAt', type: 'date' },
    { name: 'endedAt', type: 'date' },
    { name: 'cursor', type: 'json' },
    { name: 'stats', type: 'json', required: true },
    {
      name: 'errors',
      type: 'array',
      fields: [
        { name: 'articleId', type: 'text' },
        { name: 'message', type: 'text', required: true },
      ],
    },
    {
      name: 'lockKey',
      type: 'text',
      index: true,
      required: true,
    },
  ],
}
