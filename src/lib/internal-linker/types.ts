import type { InternalLinkRunMode, InternalLinkPlacement } from './config'

export type InternalLinkKeyword = {
  keyword: string
}

export type InternalLinkRuleDoc = {
  id: string | number
  site: string | number | { id: string | number }
  targetArticle: {
    id: string | number
    slug?: string | null
    title?: string | null
    site?: string | number | { id: string | number } | null
  } | string | number
  keywords?: InternalLinkKeyword[] | null
  priority?: number | null
  maxLinksPerSource?: number | null
  caseSensitive?: boolean | null
  partialMatch?: boolean | null
  enabled?: boolean | null
  source?: 'manual' | 'generated' | null
}

export type LinkCandidate = {
  targetArticleId: string
  targetSlug: string
  targetTitle: string
  keyword: string
  priority: number
  caseSensitive: boolean
  partialMatch: boolean
}

export type InsertedLink = {
  targetArticleId: string
  keywordUsed: string
  anchorText: string
  href: string
  placement: InternalLinkPlacement
}

export type RunRequest = {
  mode: InternalLinkRunMode
  site: 'all' | string
  limit: number
  trigger: 'manual' | 'scheduled' | 'endpoint'
}

export function toID(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value && 'id' in value) {
    const id = (value as { id?: string | number }).id
    return id == null ? null : String(id)
  }
  return null
}
