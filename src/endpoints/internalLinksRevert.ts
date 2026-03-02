import type { Endpoint } from 'payload'
import { INTERNAL_LINKER_STRATEGY_VERSION } from '../lib/internal-linker/config'
import { isInternalLinkerApiKeyValid } from '../lib/internal-linker/auth'
import { acquireRunScopeLock, releaseRunScopeLock } from '../lib/internal-linker/lock'
import { revertLinksFromContent } from '../lib/internal-linker/contentState'
import { createEmptyStats } from '../lib/internal-linker/stats'

function getHeaderValue(req: any, key: string): string | null {
  if (typeof req?.headers?.get === 'function') return req.headers.get(key)
  return req?.headers?.[key] || req?.headers?.[key.toUpperCase()] || null
}

function parseRunId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return null
  return value
}

function extractSiteScope(run: any): 'all' | string {
  if (!run?.site) return 'all'
  if (typeof run.site === 'object' && run.site?.id != null) return String(run.site.id)
  return String(run.site)
}

export const internalLinksRevertEndpoint: Endpoint = {
  path: '/internal-links/revert',
  method: 'post',
  handler: async (req: any) => {
    const apiKey = getHeaderValue(req, 'x-api-key')
    if (!isInternalLinkerApiKeyValid(apiKey)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const runId = parseRunId(req?.query?.runId)
    if (!runId) {
      return Response.json({ ok: false, error: 'Missing or invalid runId' }, { status: 400 })
    }

    let sourceRun: any
    try {
      sourceRun = await req.payload.findByID({
        collection: 'internal_link_runs',
        id: Number(runId),
        depth: 1,
        overrideAccess: true,
      })
    } catch {
      return Response.json({ ok: false, error: 'Run not found' }, { status: 404 })
    }

    const siteScope = extractSiteScope(sourceRun)
    const lock = await acquireRunScopeLock(req.payload, siteScope)
    if (!lock.acquired) {
      return Response.json({ ok: false, error: 'Run already in progress' }, { status: 409 })
    }

    const stats = {
      ...createEmptyStats(),
      revertedCount: 0,
      failedCount: 0,
    }

    const revertRun = await req.payload.create({
      collection: 'internal_link_runs',
      data: {
        site: siteScope === 'all' ? null : Number(siteScope),
        mode: 'apply',
        action: 'revert',
        status: 'running',
        strategyVersion: INTERNAL_LINKER_STRATEGY_VERSION,
        trigger: 'endpoint',
        startedAt: new Date().toISOString(),
        lockKey: `internal-linker:revert:${runId}`,
        stats,
        errors: [],
      },
      overrideAccess: true,
    })
    const revertRunId = String(revertRun.id)

    try {
      const edgesPage = await req.payload.find({
        collection: 'internal_link_edges',
        where: {
          and: [
            { runId: { equals: Number(runId) } },
            {
              or: [{ status: { equals: 'active' } }, { status: { exists: false } }],
            },
          ],
        },
        limit: 2000,
        depth: 1,
        overrideAccess: true,
      })
      const edges = edgesPage.docs || []
      const bySource = new Map<string, any[]>()
      for (const edge of edges) {
        const sourceId =
          typeof edge?.sourceArticle === 'object' && edge?.sourceArticle?.id != null
            ? String(edge.sourceArticle.id)
            : String(edge?.sourceArticle || '')
        if (!sourceId) continue
        if (!bySource.has(sourceId)) bySource.set(sourceId, [])
        bySource.get(sourceId)!.push(edge)
      }

      const errors: Array<{ articleId: string | null; message: string }> = []

      for (const [sourceArticleId, sourceEdges] of bySource.entries()) {
        stats.scanned += 1
        try {
          const article = await req.payload.findByID({
            collection: 'articles',
            id: Number(sourceArticleId),
            depth: 0,
            overrideAccess: true,
          })
          if (!article?.content) continue

          const revertCandidates = sourceEdges.map((edge) => {
            const targetSlug =
              typeof edge?.targetArticle === 'object' && edge?.targetArticle?.slug
                ? String(edge.targetArticle.slug)
                : null
            return {
              id: String(edge.id),
              targetUrl: edge?.targetUrl || (targetSlug ? `/${targetSlug}` : null),
              anchorText: edge?.anchorText || null,
              fingerprint: edge?.fingerprint || null,
              targetSlug,
            }
          })

          const reverted = revertLinksFromContent(article.content, revertCandidates)
          if (!reverted.revertedEdgeIds.length) continue

          await req.payload.update({
            collection: 'articles',
            id: Number(sourceArticleId),
            data: {
              content: reverted.content,
            },
            overrideAccess: true,
          })
          stats.updated += 1

          for (const edgeId of reverted.revertedEdgeIds) {
            await req.payload.update({
              collection: 'internal_link_edges',
              id: Number(edgeId),
              data: {
                status: 'reverted',
                lastSeenRunId: Number(revertRunId),
                revertRunId: Number(revertRunId),
              },
              overrideAccess: true,
            })
            stats.revertedCount += 1
          }
        } catch (err) {
          stats.failedCount += 1
          const message = err instanceof Error ? err.message : 'Failed to revert links for article.'
          errors.push({ articleId: sourceArticleId, message })
        }
      }

      const finalStatus = stats.failedCount > 0 ? 'partial' : 'reverted'
      await req.payload.update({
        collection: 'internal_link_runs',
        id: Number(revertRunId),
        data: {
          status: finalStatus,
          endedAt: new Date().toISOString(),
          stats,
          errors,
        },
        overrideAccess: true,
      })

      return Response.json(
        {
          ok: stats.failedCount === 0,
          runId: revertRunId,
          status: finalStatus,
          revertedCount: stats.revertedCount,
          failedCount: stats.failedCount,
        },
        { status: 200 },
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected revert error'
      await req.payload.update({
        collection: 'internal_link_runs',
        id: Number(revertRunId),
        data: {
          status: 'failed',
          endedAt: new Date().toISOString(),
          stats: {
            ...stats,
            failedCount: stats.failedCount + 1,
          },
          errors: [{ articleId: null, message }],
        },
        overrideAccess: true,
      })
      return Response.json({ ok: false, runId: revertRunId, error: message }, { status: 500 })
    } finally {
      await releaseRunScopeLock(req.payload, lock.scopeKey, lock.ownerToken)
    }
  },
}
