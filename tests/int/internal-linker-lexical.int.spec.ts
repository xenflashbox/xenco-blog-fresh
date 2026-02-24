import { describe, expect, it } from 'vitest'
import { insertInBodyLinks } from '@/lib/internal-linker/lexicalTransform'
import { upsertRelatedReadingBlock } from '@/lib/internal-linker/relatedReading'

function baseContent(text: string) {
  return {
    root: {
      type: 'root',
      direction: null,
      format: '',
      indent: 0,
      version: 1,
      children: [
        {
          type: 'paragraph',
          direction: null,
          format: '',
          indent: 0,
          version: 1,
          children: [
            {
              type: 'text',
              text,
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
        },
      ],
    },
  }
}

describe('internal linker lexical transforms', () => {
  it('inserts one in-body link from matching keyword', () => {
    const content = baseContent('This guide explains payload seo basics.')
    const result = insertInBodyLinks({
      content,
      candidates: [
        {
          targetArticleId: '22',
          targetSlug: 'payload-seo',
          targetTitle: 'Payload SEO',
          keyword: 'payload seo',
          priority: 100,
          caseSensitive: false,
          partialMatch: false,
        },
      ],
    })

    expect(result.inserted).toHaveLength(1)
    expect(JSON.stringify(result.content)).toContain('"type":"link"')
    expect(JSON.stringify(result.content)).toContain('/payload-seo')
  })

  it('does not touch heading blocks', () => {
    const content = {
      root: {
        type: 'root',
        direction: null,
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'heading',
            tag: 'h2',
            children: [
              {
                type: 'text',
                text: 'payload seo',
                detail: 0,
                format: 0,
                mode: 'normal',
                style: '',
                version: 1,
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            version: 1,
          },
        ],
      },
    }
    const result = insertInBodyLinks({
      content,
      candidates: [
        {
          targetArticleId: '22',
          targetSlug: 'payload-seo',
          targetTitle: 'Payload SEO',
          keyword: 'payload seo',
          priority: 100,
          caseSensitive: false,
          partialMatch: false,
        },
      ],
    })
    expect(result.inserted).toHaveLength(0)
  })

  it('replaces existing Related reading managed block', () => {
    const content = baseContent('Top paragraph')
    const first = upsertRelatedReadingBlock(content as any, [
      {
        targetArticleId: '10',
        targetSlug: 'one',
        targetTitle: 'One',
        keyword: 'one',
        priority: 1,
        caseSensitive: false,
        partialMatch: false,
      },
    ])
    const second = upsertRelatedReadingBlock(first.content as any, [
      {
        targetArticleId: '11',
        targetSlug: 'two',
        targetTitle: 'Two',
        keyword: 'two',
        priority: 1,
        caseSensitive: false,
        partialMatch: false,
      },
    ])

    const serialized = JSON.stringify(second.content)
    const count = (serialized.match(/Related reading:/g) || []).length
    expect(count).toBe(1)
    expect(serialized).toContain('/two')
  })
})
