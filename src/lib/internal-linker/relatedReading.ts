import { INTERNAL_LINKER_FALLBACK_HEADING } from './config'
import type { LinkCandidate } from './types'

type LexicalNode = Record<string, unknown>

function textNode(text: string): LexicalNode {
  return {
    type: 'text',
    text,
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    version: 1,
  }
}

function linkNode(label: string, href: string): LexicalNode {
  return {
    type: 'link',
    fields: {
      linkType: 'custom',
      newTab: false,
      url: href,
    },
    children: [textNode(label)],
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  }
}

function paragraphNode(children: LexicalNode[]): LexicalNode {
  return {
    type: 'paragraph',
    children,
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  }
}

function firstTextValue(node: LexicalNode): string {
  const children = Array.isArray(node.children) ? (node.children as LexicalNode[]) : []
  const first = children[0]
  if (!first || first.type !== 'text' || typeof first.text !== 'string') return ''
  return first.text
}

export function upsertRelatedReadingBlock(
  content: LexicalNode,
  candidates: LinkCandidate[],
): { content: LexicalNode; inserted: boolean; links: { targetArticleId: string; anchorText: string; href: string }[] } {
  const root = content?.root as LexicalNode | undefined
  const rootChildren = Array.isArray(root?.children) ? (root?.children as LexicalNode[]) : null
  if (!root || !rootChildren) {
    return { content, inserted: false, links: [] }
  }

  const chosen = candidates.slice(0, 3)
  if (!chosen.length) return { content, inserted: false, links: [] }

  const links = chosen.map((candidate) => ({
    targetArticleId: candidate.targetArticleId,
    anchorText: candidate.targetTitle,
    href: `/${candidate.targetSlug}`,
  }))

  const newBlock = paragraphNode([
    textNode(`${INTERNAL_LINKER_FALLBACK_HEADING}: `),
    ...links.flatMap((link, idx) => {
      const nodes: LexicalNode[] = [linkNode(link.anchorText, link.href)]
      if (idx < links.length - 1) nodes.push(textNode(', '))
      return nodes
    }),
  ])

  let replaced = false
  const nextChildren = rootChildren.map((child) => {
    if (child?.type !== 'paragraph') return child
    const firstText = firstTextValue(child)
    if (firstText.startsWith(`${INTERNAL_LINKER_FALLBACK_HEADING}:`)) {
      replaced = true
      return newBlock
    }
    return child
  })

  if (!replaced) {
    nextChildren.push(newBlock)
  }

  return {
    content: {
      ...content,
      root: {
        ...root,
        children: nextChildren,
      },
    },
    inserted: true,
    links,
  }
}
