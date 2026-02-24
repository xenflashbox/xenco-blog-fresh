import type { Payload } from 'payload'
import {
  INTERNAL_LINKER_DEFAULT_BATCH_LIMIT,
  INTERNAL_LINKER_DEFAULT_MAX_LINKS_PER_ARTICLE,
  INTERNAL_LINKER_DEFAULT_MAX_PER_PARAGRAPH,
  INTERNAL_LINKER_PERSIST_GENERATED_RULES,
  INTERNAL_LINKER_STRATEGY_VERSION,
  type InternalLinkRunMode,
} from './config'
import { buildContextHash } from './hash'
import { insertInBodyLinks } from './lexicalTransform'
import { upsertRelatedReadingBlock } from './relatedReading'
import { createEmptyStats } from './stats'
import type { InsertedLink, InternalLinkRuleDoc, LinkCandidate, RunRequest } from './types'
import { toID } from './types'

type RunResult = {
  runId: string
  status: 'succeeded' | 'failed' | 'partial'
  stats: ReturnType<typeof createEmptyStats>
  message: string
}

function toSafeLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit < 1) return INTERNAL_LINKER_DEFAULT_BATCH_LIMIT
  return Math.min(100, Math.max(1, Math.floor(limit)))
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

function isLexicalContent(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && 'root' in (value as object))
}

function parseTextKeywords(rule: InternalLinkRuleDoc): string[] {
  const values = Array.isArray(rule.keywords) ? rule.keywords : []
  return unique(
    values
      .map((entry) => entry?.keyword?.trim())
      .filter((value): value is string => typeof value === 'string' && value.length > 1),
  )
}

async function fetchSites(payload: Payload, site: 'all' | string) {
  if (site !== 'all') {
    const one = await payload.findByID({
      collection: 'sites',
      id: site,
      depth: 0,
      overrideAccess: true,
    })
    return one ? [one] : []
  }
  const all = await payload.find({
    collection: 'sites',
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return all.docs || []
}

async function fetchRules(payload: Payload, siteId: string): Promise<InternalLinkRuleDoc[]> {
  const res = await payload.find({
    collection: 'internal_link_rules',
    where: {
      and: [{ site: { equals: siteId } }, { enabled: { equals: true } }],
    },
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })
  return (res.docs || []) as InternalLinkRuleDoc[]
}

function sortCandidates(candidates: LinkCandidate[]): LinkCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority
    if (a.keyword.length !== b.keyword.length) return b.keyword.length - a.keyword.length
    return a.targetTitle.localeCompare(b.targetTitle)
  })
}

function buildCandidatesFromRules(rules: InternalLinkRuleDoc[], sourceArticleId: string): LinkCandidate[] {
  const out: LinkCandidate[] = []
  for (const rule of rules) {
    const targetId = toID(rule.targetArticle)
    if (!targetId || targetId === sourceArticleId) continue

    const target = typeof rule.targetArticle === 'object' ? rule.targetArticle : null
    const targetSlug = target?.slug?.trim()
    if (!targetSlug) continue

    const targetTitle = target?.title?.trim() || targetSlug
    const keywords = parseTextKeywords(rule)
    if (!keywords.length) continue

    for (const keyword of keywords) {
      out.push({
        targetArticleId: targetId,
        targetSlug,
        targetTitle,
        keyword,
        priority: Number(rule.priority ?? 100),
        caseSensitive: Boolean(rule.caseSensitive),
        partialMatch: Boolean(rule.partialMatch),
      })
    }
  }
  return sortCandidates(out)
}

function buildGeneratedCandidates(source: any, peers: any[]): LinkCandidate[] {
  const sourceId = String(source.id)
  const sourceTitle = String(source.title || '')
  const sourceTags = Array.isArray(source.tags)
    ? source.tags.map((tag: any) => (typeof tag === 'object' ? tag?.id : tag)).filter(Boolean).map(String)
    : []

  const sourceCategories = Array.isArray(source.categories)
    ? source.categories.map((cat: any) => (typeof cat === 'object' ? cat?.id : cat)).filter(Boolean).map(String)
    : []

  const candidates: LinkCandidate[] = []
  for (const peer of peers) {
    if (!peer?.id || String(peer.id) === sourceId) continue
    if (!peer?.slug || !peer?.title) continue

    const peerTags = Array.isArray(peer.tags)
      ? peer.tags.map((tag: any) => (typeof tag === 'object' ? tag?.id : tag)).filter(Boolean).map(String)
      : []
    const peerCats = Array.isArray(peer.categories)
      ? peer.categories.map((cat: any) => (typeof cat === 'object' ? cat?.id : cat)).filter(Boolean).map(String)
      : []

    const overlap =
      peerTags.some((id: string) => sourceTags.includes(id)) ||
      peerCats.some((id: string) => sourceCategories.includes(id))
    if (!overlap) continue

    const keyword = String(peer.focusKeyword || peer.title || '').trim()
    if (!keyword || keyword.toLowerCase() === sourceTitle.toLowerCase()) continue

    candidates.push({
      targetArticleId: String(peer.id),
      targetSlug: String(peer.slug),
      targetTitle: String(peer.title),
      keyword,
      priority: 10,
      caseSensitive: false,
      partialMatch: false,
    })
  }
  return sortCandidates(candidates)
}

async function alreadyLinked(payload: Payload, args: {
  siteId: string
  sourceArticleId: string
  targetArticleId: string
  placement?: 'in_body' | 'related_reading'
}): Promise<boolean> {
  const where: any = {
    and: [
      { site: { equals: args.siteId } },
      { sourceArticle: { equals: args.sourceArticleId } },
      { targetArticle: { equals: args.targetArticleId } },
    ],
  }
  if (args.placement) {
    where.and.push({ placement: { equals: args.placement } })
  }

  const res = await payload.find({
    collection: 'internal_link_edges',
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return Boolean(res.docs?.length)
}

async function writeEdge(payload: Payload, args: {
  siteId: string
  sourceArticleId: string
  link: InsertedLink
  runId: string
  strategyVersion: string
}) {
  const contextHash = buildContextHash({
    sourceArticleId: args.sourceArticleId,
    targetArticleId: args.link.targetArticleId,
    keyword: args.link.keywordUsed,
    anchorText: args.link.anchorText,
    strategyVersion: args.strategyVersion,
  })

  await payload.create({
    collection: 'internal_link_edges',
    data: {
      site: Number(args.siteId),
      sourceArticle: Number(args.sourceArticleId),
      targetArticle: Number(args.link.targetArticleId),
      keywordUsed: args.link.keywordUsed,
      anchorText: args.link.anchorText,
      contextHash,
      placement: args.link.placement,
      runId: Number(args.runId),
    },
    overrideAccess: true,
  })
}

export async function runInternalLinker(payload: Payload, request: RunRequest): Promise<RunResult> {
  const stats = createEmptyStats()
  const limit = toSafeLimit(request.limit || INTERNAL_LINKER_DEFAULT_BATCH_LIMIT)
  const lockKey = `internal-linker:${request.site}`

  const runDoc = await payload.create({
    collection: 'internal_link_runs',
    data: {
      site: request.site === 'all' ? null : Number(request.site),
      mode: request.mode,
      status: 'running',
      strategyVersion: INTERNAL_LINKER_STRATEGY_VERSION,
      trigger: request.trigger,
      startedAt: new Date().toISOString(),
      lockKey,
      stats,
      errors: [],
    },
    overrideAccess: true,
  })
  const runId = String(runDoc.id)

  try {
    const sites = await fetchSites(payload, request.site)
    if (!sites.length) {
      await payload.update({
        collection: 'internal_link_runs',
        id: runId,
        data: {
          status: 'failed',
          endedAt: new Date().toISOString(),
          errors: [{ articleId: null, message: 'No sites found for requested scope.' }],
          stats,
        },
        overrideAccess: true,
      })
      return { runId, status: 'failed', stats, message: 'No sites found.' }
    }

    for (const site of sites) {
      const siteId = String(site.id)
      const rules = await fetchRules(payload, siteId)

      let page = 1
      while (true) {
        const articlePage = await payload.find({
          collection: 'articles',
          where: {
            and: [
              { site: { equals: Number(siteId) } },
              { status: { equals: 'published' } },
            ],
          },
          page,
          limit,
          depth: 1,
          overrideAccess: true,
        })
        const docs = articlePage.docs || []
        if (!docs.length) break

        for (const source of docs) {
          const sourceArticleId = String(source.id)
          stats.scanned++

          if (!isLexicalContent(source.content)) {
            stats.skippedNoMatch++
            continue
          }

          let candidates = buildCandidatesFromRules(rules, sourceArticleId)
          if (!candidates.length) {
            candidates = buildGeneratedCandidates(source, docs)
            if (!INTERNAL_LINKER_PERSIST_GENERATED_RULES && request.mode === 'dry_run') {
              // Keep suggestions transient in v1.
            }
          }

          if (!candidates.length) {
            stats.skippedNoMatch++
            continue
          }

          const filteredCandidates: LinkCandidate[] = []
          for (const candidate of candidates) {
            const already = await alreadyLinked(payload, {
              siteId,
              sourceArticleId,
              targetArticleId: candidate.targetArticleId,
            })
            if (already) {
              stats.skippedAlreadyLinked++
              continue
            }
            filteredCandidates.push(candidate)
          }

          if (!filteredCandidates.length) {
            stats.skippedNoMatch++
            continue
          }

          const inBody = insertInBodyLinks({
            content: source.content,
            candidates: filteredCandidates,
            maxLinksPerArticle: INTERNAL_LINKER_DEFAULT_MAX_LINKS_PER_ARTICLE,
            maxPerParagraph: INTERNAL_LINKER_DEFAULT_MAX_PER_PARAGRAPH,
          })

          let nextContent = inBody.content
          let insertedLinks = inBody.inserted

          if (!insertedLinks.length) {
            const fallback = upsertRelatedReadingBlock(source.content as Record<string, any>, filteredCandidates)
            if (fallback.inserted) {
              nextContent = fallback.content
              insertedLinks = fallback.links.map((link) => ({
                targetArticleId: link.targetArticleId,
                keywordUsed: link.anchorText,
                anchorText: link.anchorText,
                href: link.href,
                placement: 'related_reading',
              }))
              stats.fallbackInserted += insertedLinks.length
            }
          }

          if (!insertedLinks.length) {
            stats.skippedNoMatch++
            continue
          }

          if (request.mode === 'apply') {
            await payload.update({
              collection: 'articles',
              id: Number(sourceArticleId),
              data: {
                content: nextContent,
              },
              overrideAccess: true,
            })
            stats.updated++

            for (const link of insertedLinks) {
              await writeEdge(payload, {
                siteId,
                sourceArticleId,
                link,
                runId,
                strategyVersion: INTERNAL_LINKER_STRATEGY_VERSION,
              })
            }
          }

          stats.linksInserted += insertedLinks.filter((item) => item.placement === 'in_body').length
        }

        await payload.update({
          collection: 'internal_link_runs',
          id: Number(runId),
          data: {
            cursor: { siteId, page },
            stats,
          },
          overrideAccess: true,
        })

        if (page >= (articlePage.totalPages ?? 1)) break
        page++
      }
    }

    const status: 'succeeded' | 'partial' = stats.updated > 0 || request.mode === 'dry_run' ? 'succeeded' : 'partial'
    await payload.update({
      collection: 'internal_link_runs',
      id: Number(runId),
      data: {
        status,
        endedAt: new Date().toISOString(),
        stats,
      },
      overrideAccess: true,
    })

    return {
      runId,
      status,
      stats,
      message: status === 'succeeded' ? 'Internal linker run completed.' : 'Run completed with no updates.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected internal linker error.'
    await payload.update({
      collection: 'internal_link_runs',
      id: Number(runId),
      data: {
        status: 'failed',
        endedAt: new Date().toISOString(),
        stats,
        errors: [{ articleId: null, message }],
      },
      overrideAccess: true,
    })

    payload.logger.error({ err }, 'Internal linker run failed')
    return { runId, status: 'failed', stats, message }
  }
}

export async function hasRecentDryRun(payload: Payload, site: 'all' | string, withinHours: number): Promise<boolean> {
  const threshold = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString()
  const where: any = {
    and: [
      { mode: { equals: 'dry_run' as InternalLinkRunMode } },
      { status: { equals: 'succeeded' } },
      { startedAt: { greater_than_equal: threshold } },
    ],
  }
  if (site === 'all') {
    where.and.push({ site: { exists: false } })
  } else {
    where.and.push({ site: { equals: Number(site) } })
  }

  const found = await payload.find({
    collection: 'internal_link_runs',
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return Boolean(found.docs?.length)
}
