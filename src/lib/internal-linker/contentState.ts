import { stableHash } from './hash'

type LexicalNode = Record<string, any>

const CONTEXT_WINDOW = 60

export type ContentLinkOccurrence = {
  href: string
  anchorText: string
  leftContext: string
  rightContext: string
  fingerprint: string
}

export type RevertEdgeCandidate = {
  id: string
  targetUrl?: string | null
  anchorText?: string | null
  fingerprint?: string | null
  targetSlug?: string | null
}

function textFromNode(node: LexicalNode): string {
  if (!node) return ''
  if (Array.isArray(node)) return node.map((item) => textFromNode(item)).join('')
  if (node.type === 'text' && typeof node.text === 'string') return node.text
  if (Array.isArray(node.children)) return node.children.map((item: LexicalNode) => textFromNode(item)).join('')
  return ''
}

export function normalizeInternalHref(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null
  const value = input.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value)
      return parsed.pathname || null
    } catch {
      return null
    }
  }
  if (value.startsWith('/')) return value
  if (value.startsWith('#') || value.startsWith('?')) return null
  return `/${value}`
}

function buildFingerprint(href: string, anchorText: string, leftContext: string, rightContext: string): string {
  return stableHash(
    [href, anchorText.trim().toLowerCase(), leftContext.trim().toLowerCase(), rightContext.trim().toLowerCase()].join('|'),
  )
}

function collectOccurrencesFromChildren(children: LexicalNode[]): ContentLinkOccurrence[] {
  const pieces: { kind: 'text' | 'link'; value: string; href?: string }[] = []

  for (const child of children) {
    if (!child) continue
    if (child.type === 'text' && typeof child.text === 'string') {
      pieces.push({ kind: 'text', value: child.text })
      continue
    }
    if (child.type === 'link') {
      const href = normalizeInternalHref(child?.fields?.url)
      if (!href) {
        pieces.push({ kind: 'text', value: textFromNode(child) })
        continue
      }
      const anchorText = textFromNode(child)
      if (!anchorText) continue
      pieces.push({ kind: 'link', value: anchorText, href })
      continue
    }
    const value = textFromNode(child)
    if (value) pieces.push({ kind: 'text', value })
  }

  let fullText = ''
  const spans: Array<{ href: string; anchorText: string; start: number; end: number }> = []
  for (const piece of pieces) {
    const start = fullText.length
    fullText += piece.value
    if (piece.kind === 'link' && piece.href) {
      spans.push({ href: piece.href, anchorText: piece.value, start, end: fullText.length })
    }
  }

  return spans.map((span) => {
    const leftContext = fullText.slice(Math.max(0, span.start - CONTEXT_WINDOW), span.start)
    const rightContext = fullText.slice(span.end, Math.min(fullText.length, span.end + CONTEXT_WINDOW))
    return {
      href: span.href,
      anchorText: span.anchorText,
      leftContext,
      rightContext,
      fingerprint: buildFingerprint(span.href, span.anchorText, leftContext, rightContext),
    }
  })
}

function traverseNodesForOccurrences(node: LexicalNode, out: ContentLinkOccurrence[]) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((item) => traverseNodesForOccurrences(item, out))
    return
  }
  const children = Array.isArray(node.children) ? (node.children as LexicalNode[]) : null
  if (!children?.length) return

  if (node.type === 'paragraph' || node.type === 'listitem') {
    out.push(...collectOccurrencesFromChildren(children))
  }
  for (const child of children) {
    traverseNodesForOccurrences(child, out)
  }
}

export function collectInternalLinkOccurrences(content: unknown): ContentLinkOccurrence[] {
  if (!content || typeof content !== 'object') return []
  const root = (content as LexicalNode).root
  if (!root || typeof root !== 'object') return []
  const out: ContentLinkOccurrence[] = []
  traverseNodesForOccurrences(root as LexicalNode, out)
  return out
}

function edgeTargetHref(edge: RevertEdgeCandidate): string | null {
  return normalizeInternalHref(edge.targetUrl || (edge.targetSlug ? `/${edge.targetSlug}` : null))
}

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase()
}

function revertChildren(
  children: LexicalNode[],
  edges: RevertEdgeCandidate[],
  consumedEdgeIds: Set<string>,
): { children: LexicalNode[]; changed: boolean } {
  const pieces: { childIndex: number; href: string; anchorText: string; leftContext: string; rightContext: string; fingerprint: string }[] =
    []

  let fullText = ''
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    if (!child) continue
    if (child.type === 'text' && typeof child.text === 'string') {
      fullText += child.text
      continue
    }
    if (child.type === 'link') {
      const href = normalizeInternalHref(child?.fields?.url)
      const anchorText = textFromNode(child)
      if (!href || !anchorText) {
        fullText += anchorText
        continue
      }
      const start = fullText.length
      fullText += anchorText
      const end = fullText.length
      const leftContext = fullText.slice(Math.max(0, start - CONTEXT_WINDOW), start)
      const rightContext = fullText.slice(end, Math.min(fullText.length, end + CONTEXT_WINDOW))
      pieces.push({
        childIndex: index,
        href,
        anchorText,
        leftContext,
        rightContext,
        fingerprint: buildFingerprint(href, anchorText, leftContext, rightContext),
      })
      continue
    }
    fullText += textFromNode(child)
  }

  const indexesToUnwrap = new Set<number>()
  for (const piece of pieces) {
    const matched = edges.find((edge) => {
      if (consumedEdgeIds.has(edge.id)) return false
      const href = edgeTargetHref(edge)
      if (!href || href !== piece.href) return false
      if (edge.fingerprint && edge.fingerprint === piece.fingerprint) return true
      if (edge.anchorText && normalizeText(edge.anchorText) !== normalizeText(piece.anchorText)) return false
      return true
    })
    if (!matched) continue
    indexesToUnwrap.add(piece.childIndex)
    consumedEdgeIds.add(matched.id)
  }

  if (!indexesToUnwrap.size) return { children, changed: false }

  const nextChildren: LexicalNode[] = []
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (!indexesToUnwrap.has(i) || child?.type !== 'link') {
      nextChildren.push(child)
      continue
    }
    const linkChildren = Array.isArray(child.children) ? (child.children as LexicalNode[]) : []
    if (linkChildren.length) {
      nextChildren.push(...linkChildren)
      continue
    }
    nextChildren.push({ type: 'text', text: textFromNode(child), detail: 0, format: 0, mode: 'normal', style: '', version: 1 })
  }

  return { children: nextChildren, changed: true }
}

function walkAndRevert(node: LexicalNode, edges: RevertEdgeCandidate[], consumedEdgeIds: Set<string>): { node: LexicalNode; changed: boolean } {
  if (!node || typeof node !== 'object') return { node, changed: false }
  if (Array.isArray(node)) {
    let changed = false
    const next = node.map((item) => {
      const result = walkAndRevert(item, edges, consumedEdgeIds)
      changed = changed || result.changed
      return result.node
    })
    return { node: next as unknown as LexicalNode, changed }
  }

  const children = Array.isArray(node.children) ? (node.children as LexicalNode[]) : null
  if (!children?.length) return { node, changed: false }

  let changed = false
  let nextChildren = children

  if (node.type === 'paragraph' || node.type === 'listitem') {
    const reverted = revertChildren(nextChildren, edges, consumedEdgeIds)
    nextChildren = reverted.children
    changed = changed || reverted.changed
  }

  const deepChildren = nextChildren.map((child) => {
    const result = walkAndRevert(child, edges, consumedEdgeIds)
    changed = changed || result.changed
    return result.node
  })

  return {
    node: {
      ...node,
      children: deepChildren,
    },
    changed,
  }
}

export function revertLinksFromContent(content: unknown, edges: RevertEdgeCandidate[]): { content: unknown; revertedEdgeIds: string[] } {
  if (!content || typeof content !== 'object') return { content, revertedEdgeIds: [] }
  const root = (content as LexicalNode).root
  if (!root || typeof root !== 'object') return { content, revertedEdgeIds: [] }
  if (!edges.length) return { content, revertedEdgeIds: [] }

  const consumedEdgeIds = new Set<string>()
  const result = walkAndRevert(root as LexicalNode, edges, consumedEdgeIds)
  if (!result.changed) return { content, revertedEdgeIds: [] }

  return {
    content: {
      ...(content as LexicalNode),
      root: result.node,
    },
    revertedEdgeIds: Array.from(consumedEdgeIds),
  }
}
