import type { Endpoint } from 'payload'
import {
  INTERNAL_LINKER_DEFAULT_BATCH_LIMIT,
  INTERNAL_LINKER_REQUIRE_RECENT_DRY_RUN_HOURS,
  type InternalLinkRunMode,
} from '../lib/internal-linker/config'
import { isInternalLinkerApiKeyValid } from '../lib/internal-linker/auth'
import { acquireRunScopeLock, releaseRunScopeLock } from '../lib/internal-linker/lock'
import { createInternalLinkerRun, hasRecentDryRun, runInternalLinker } from '../lib/internal-linker/runner'

function getHeaderValue(req: any, key: string): string | null {
  if (typeof req?.headers?.get === 'function') return req.headers.get(key)
  return req?.headers?.[key] || req?.headers?.[key.toUpperCase()] || null
}

function resolveApiKey(req: any): string | null {
  const explicit = getHeaderValue(req, 'x-api-key')
  if (explicit) return explicit

  const auth = getHeaderValue(req, 'authorization')
  if (!auth) return null
  const trimmed = String(auth).trim()

  if (/^bearer\s+/i.test(trimmed)) return trimmed.replace(/^bearer\s+/i, '').trim() || null
  if (/^users\s+api-key\s+/i.test(trimmed)) return trimmed.replace(/^users\s+api-key\s+/i, '').trim() || null
  return null
}

function parseMode(raw: unknown): InternalLinkRunMode | null {
  if (raw === 'dry_run' || raw === 'apply') return raw
  return null
}

function parseLimit(raw: unknown): number {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return INTERNAL_LINKER_DEFAULT_BATCH_LIMIT
  return Math.min(100, Math.max(1, Math.floor(parsed)))
}

function normalizeSiteToken(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').toLowerCase()
}

export const internalLinksRunEndpoint: Endpoint = {
  path: '/internal-links/run',
  method: 'post',
  handler: async (req: any) => {
    const apiKey = resolveApiKey(req)
    if (!isInternalLinkerApiKeyValid(apiKey)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const mode = parseMode(req?.query?.mode)
    if (!mode) {
      return Response.json({ ok: false, error: 'Invalid mode. Use dry_run or apply.' }, { status: 400 })
    }

    const siteRaw = typeof req?.query?.site === 'string' ? req.query.site.trim() : 'all'
    let site: 'all' | string = 'all'
    if (siteRaw && siteRaw !== 'all') {
      if (/^\d+$/.test(siteRaw)) {
        site = siteRaw
      } else {
        let found = await req.payload.find({
          collection: 'sites',
          where: { slug: { equals: siteRaw } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        let doc = found.docs?.[0]
        if (!doc) {
          found = await req.payload.find({
            collection: 'sites',
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })
          const wanted = normalizeSiteToken(siteRaw)
          doc = found.docs?.find((siteDoc: any) => normalizeSiteToken(String(siteDoc?.slug || '')) === wanted)
        }
        if (!doc?.id) {
          return Response.json({ ok: false, error: 'Unknown site' }, { status: 404 })
        }
        site = String(doc.id)
      }
    }
    const limit = parseLimit(req?.query?.limit)
    const lock = await acquireRunScopeLock(req.payload, site)
    if (!lock.acquired) {
      return Response.json({ ok: false, error: 'Run already in progress', site, mode }, { status: 409 })
    }

    try {
      if (mode === 'apply') {
        const ready = await hasRecentDryRun(req.payload, site, INTERNAL_LINKER_REQUIRE_RECENT_DRY_RUN_HOURS)
        if (!ready) {
          return Response.json(
            {
              ok: false,
              error: `Apply requires a successful dry_run in the last ${INTERNAL_LINKER_REQUIRE_RECENT_DRY_RUN_HOURS}h for this scope.`,
            },
            { status: 400 },
          )
        }
      }

      const runRequest = {
        mode,
        site,
        limit,
        trigger: 'endpoint',
      } as const
      const runId = await createInternalLinkerRun(req.payload, runRequest)
      const result = await runInternalLinker(req.payload, runRequest, { runId })

      return Response.json(
        {
          ok: result.status !== 'failed',
          runId: result.runId,
          status: result.status,
          site,
          mode,
          stats: result.stats,
          message: result.message,
        },
        { status: 200 },
      )
    } finally {
      await releaseRunScopeLock(req.payload, lock.scopeKey, lock.ownerToken)
    }
  },
}
