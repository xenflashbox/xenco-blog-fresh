import {
  INTERNAL_LINKER_DEFAULT_MAX_LINKS_PER_ARTICLE,
  INTERNAL_LINKER_DEFAULT_MAX_PER_PARAGRAPH,
} from './config'
import type { InsertedLink, LinkCandidate } from './types'

type LexicalNode = Record<string, any>

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildMatcher(keyword: string, partialMatch: boolean, caseSensitive: boolean): RegExp {
  const pattern = partialMatch ? escapeRegex(keyword) : `\\b${escapeRegex(keyword)}\\b`
  return new RegExp(pattern, caseSensitive ? '' : 'i')
}

function cloneTextNode(source: LexicalNode, text: string): LexicalNode {
  return {
    ...source,
    type: 'text',
    text,
  }
}

function linkTextNode(label: string, href: string): LexicalNode {
  return {
    type: 'link',
    fields: {
      linkType: 'custom',
      newTab: false,
      url: href,
    },
    children: [
      {
        type: 'text',
        text: label,
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
  }
}

function isParagraphLike(node: LexicalNode): boolean {
  return node?.type === 'paragraph' || node?.type === 'listitem'
}

function hasExistingLink(node: LexicalNode): boolean {
  const children = Array.isArray(node.children) ? node.children : []
  return children.some((child: LexicalNode) => child?.type === 'link')
}

function isRestrictedBlock(node: LexicalNode): boolean {
  if (node?.type !== 'paragraph') return false
  const children = Array.isArray(node.children) ? node.children : []
  const first = children[0]
  const text = first?.type === 'text' && typeof first.text === 'string' ? first.text.trim().toLowerCase() : ''
  return text === 'sources' || text === 'references' || text.startsWith('related reading:')
}

export function insertInBodyLinks(args: {
  content: LexicalNode
  candidates: LinkCandidate[]
  maxLinksPerArticle?: number
  maxPerParagraph?: number
}): { content: LexicalNode; inserted: InsertedLink[] } {
  const maxLinksPerArticle = args.maxLinksPerArticle ?? INTERNAL_LINKER_DEFAULT_MAX_LINKS_PER_ARTICLE
  const maxPerParagraph = args.maxPerParagraph ?? INTERNAL_LINKER_DEFAULT_MAX_PER_PARAGRAPH

  const root = args.content?.root as LexicalNode | undefined
  const rootChildren = Array.isArray(root?.children) ? (root.children as LexicalNode[]) : null
  if (!root || !rootChildren) {
    return { content: args.content, inserted: [] }
  }

  const inserted: InsertedLink[] = []
  const usedTargets = new Set<string>()

  const nextChildren = rootChildren.map((node) => {
    if (inserted.length >= maxLinksPerArticle) return node
    if (!isParagraphLike(node)) return node
    if (isRestrictedBlock(node)) return node
    if (hasExistingLink(node)) return node

    const children = Array.isArray(node.children) ? (node.children as LexicalNode[]) : []
    if (!children.length) return node

    let paragraphInsertions = 0
    const rewrittenChildren: LexicalNode[] = []

    for (const child of children) {
      if (
        paragraphInsertions >= maxPerParagraph ||
        inserted.length >= maxLinksPerArticle ||
        child?.type !== 'text' ||
        typeof child?.text !== 'string'
      ) {
        rewrittenChildren.push(child)
        continue
      }

      let replaced = false
      for (const candidate of args.candidates) {
        if (usedTargets.has(candidate.targetArticleId)) continue
        const matcher = buildMatcher(candidate.keyword, candidate.partialMatch, candidate.caseSensitive)
        const match = child.text.match(matcher)
        if (!match || match.index == null) continue

        const start = match.index
        const matched = match[0]
        const end = start + matched.length
        const before = child.text.slice(0, start)
        const after = child.text.slice(end)
        if (before) rewrittenChildren.push(cloneTextNode(child, before))
        rewrittenChildren.push(linkTextNode(matched, `/${candidate.targetSlug}`))
        if (after) rewrittenChildren.push(cloneTextNode(child, after))

        inserted.push({
          targetArticleId: candidate.targetArticleId,
          keywordUsed: candidate.keyword,
          anchorText: matched,
          href: `/${candidate.targetSlug}`,
          placement: 'in_body',
        })
        usedTargets.add(candidate.targetArticleId)
        paragraphInsertions++
        replaced = true
        break
      }

      if (!replaced) {
        rewrittenChildren.push(child)
      }
    }

    return {
      ...node,
      children: rewrittenChildren,
    }
  })

  return {
    content: {
      ...args.content,
      root: {
        ...root,
        children: nextChildren,
      },
    },
    inserted,
  }
}
