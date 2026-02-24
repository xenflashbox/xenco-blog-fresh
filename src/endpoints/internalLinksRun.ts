import type { Endpoint } from 'payload'
import {
  INTERNAL_LINKER_DEFAULT_BATCH_LIMIT,
  INTERNAL_LINKER_REQUIRE_RECENT_DRY_RUN_HOURS,
  type InternalLinkRunMode,
} from '../lib/internal-linker/config'
import { getRunLockKey, hasActiveLock } from '../lib/internal-linker/lock'
import { hasRecentDryRun, runInternalLinker } from '../lib/internal-linker/runner'

function getHeaderValue(req: any, key: string): string | null {
  if (typeof req?.headers?.get === 'function') return req.headers.get(key)
  return req?.headers?.[key] || req?.headers?.[key.toUpperCase()] || null
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

export const internalLinksRunEndpoint: Endpoint = {
  path: '/internal-links/run',
  method: 'post',
  handler: async (req: any) => {
    const apiKey = getHeaderValue(req, 'x-api-key')
    if (!apiKey || apiKey !== process.env.INTERNAL_LINKER_API_KEY) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const mode = parseMode(req?.query?.mode)
    if (!mode) {
      return Response.json({ ok: false, error: 'Invalid mode. Use dry_run or apply.' }, { status: 400 })
    }

    const siteRaw = typeof req?.query?.site === 'string' ? req.query.site.trim() : 'all'
    const site = siteRaw && siteRaw !== 'all' ? siteRaw : 'all'
    const limit = parseLimit(req?.query?.limit)
    const lockKey = getRunLockKey(site)

    if (await hasActiveLock(req.payload, lockKey)) {
      return Response.json(
        { ok: false, status: 'running', site, mode, message: 'A run is already active for this scope.' },
        { status: 409 },
      )
    }

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

    const result = await runInternalLinker(req.payload, {
      mode,
      site,
      limit,
      trigger: 'endpoint',
    })

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
  },
}
