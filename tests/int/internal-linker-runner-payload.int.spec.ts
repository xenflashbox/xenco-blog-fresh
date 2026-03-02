import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/internal-linker/lexicalTransform', () => ({
  insertInBodyLinks: () => ({
    content: { root: { type: 'root', children: [] } },
    inserted: [
      {
        targetArticleId: '12',
        keywordUsed: 'Applicant Tracking Systems',
        anchorText: 'Applicant Tracking Systems',
        href: '/ats-guide',
        placement: 'in_body',
      },
    ],
  }),
}))

vi.mock('@/lib/internal-linker/contentState', () => ({
  collectInternalLinkOccurrences: () => [],
  normalizeInternalHref: (href: string | null | undefined) => (typeof href === 'string' ? href : null),
}))

import { runInternalLinker } from '@/lib/internal-linker/runner'

describe('internal linker article patch payload', () => {
  it('updates articles with content-only payload keys', async () => {
    const updateCalls: any[] = []

    const payload: any = {
      logger: { error: vi.fn(), warn: vi.fn() },
      create: vi.fn(async ({ collection }: any) => {
        if (collection === 'internal_link_runs') return { id: 999 }
        if (collection === 'internal_link_edges') return { id: 1 }
        return { id: 1 }
      }),
      findByID: vi.fn(async ({ collection }: any) => {
        if (collection === 'sites') return { id: 1 }
        return null
      }),
      find: vi.fn(async ({ collection }: any) => {
        if (collection === 'internal_link_rules') {
          return {
            docs: [
              {
                id: 1,
                targetArticle: { id: 12, slug: 'ats-guide', title: 'ATS Guide' },
                keywords: [{ keyword: 'Applicant Tracking Systems' }],
                priority: 100,
                caseSensitive: false,
                partialMatch: false,
                enabled: true,
              },
            ],
          }
        }
        if (collection === 'articles') {
          return {
            docs: [
              {
                id: 7,
                title: 'Source Article',
                slug: 'source-article',
                content: { root: { type: 'root', children: [] } },
                status: 'published',
                site: 1,
              },
            ],
            totalPages: 1,
          }
        }
        if (collection === 'internal_link_edges') {
          return { docs: [] }
        }
        if (collection === 'internal_link_runs') {
          return { docs: [] }
        }
        return { docs: [], totalPages: 1 }
      }),
      update: vi.fn(async (args: any) => {
        updateCalls.push(args)
        return { id: args.id || 1 }
      }),
    }

    const result = await runInternalLinker(payload, {
      mode: 'apply',
      site: '1',
      limit: 1,
      trigger: 'endpoint',
    })

    expect(result.status).not.toBe('failed')

    const articleUpdate = updateCalls.find((call) => call.collection === 'articles')
    expect(articleUpdate).toBeTruthy()
    const keys = Object.keys(articleUpdate.data || {}).sort()
    expect(keys).toContain('content')
    expect(keys.every((key) => key === 'content' || key === 'internalLinkedAt')).toBe(true)
  })
})
