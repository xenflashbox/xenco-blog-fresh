import type { Endpoint } from 'payload'
import { isInternalLinkerApiKeyValid } from '../lib/internal-linker/auth'

function getHeaderValue(req: any, key: string): string | null {
  if (typeof req?.headers?.get === 'function') return req.headers.get(key)
  return req?.headers?.[key] || req?.headers?.[key.toUpperCase()] || null
}

function getRunId(req: any): string | null {
  const fromRoute = req?.routeParams?.id
  if (fromRoute) return String(fromRoute)

  const fromQuery = req?.query?.id
  if (typeof fromQuery === 'string' && fromQuery.trim()) return fromQuery.trim()
  return null
}

export const internalLinksRunStatusEndpoint: Endpoint = {
  path: '/internal-links/runs/:id',
  method: 'get',
  handler: async (req: any) => {
    const apiKey = getHeaderValue(req, 'x-api-key')
    if (!isInternalLinkerApiKeyValid(apiKey)) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const runId = getRunId(req)
    if (!runId) {
      return Response.json({ ok: false, error: 'Missing run ID.' }, { status: 400 })
    }

    try {
      const run = await req.payload.findByID({
        collection: 'internal_link_runs',
        id: runId,
        depth: 1,
        overrideAccess: true,
      })
      return Response.json({ ok: true, run }, { status: 200 })
    } catch {
      return Response.json({ ok: false, error: 'Run not found.' }, { status: 404 })
    }
  },
}
