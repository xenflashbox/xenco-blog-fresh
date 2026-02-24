import { describe, expect, it } from 'vitest'
import { buildContextHash } from '@/lib/internal-linker/hash'
import { getRunLockKey } from '@/lib/internal-linker/lock'

describe('internal linker core helpers', () => {
  it('creates deterministic lock key', () => {
    expect(getRunLockKey('all')).toBe('internal-linker:all')
    expect(getRunLockKey('3')).toBe('internal-linker:3')
  })

  it('creates deterministic context hash', () => {
    const one = buildContextHash({
      sourceArticleId: '1',
      targetArticleId: '2',
      keyword: 'Payload SEO',
      anchorText: 'Payload SEO',
      strategyVersion: 'v1',
    })
    const two = buildContextHash({
      sourceArticleId: '1',
      targetArticleId: '2',
      keyword: 'payload seo',
      anchorText: 'payload seo',
      strategyVersion: 'v1',
    })
    expect(one).toBe(two)
  })
})
