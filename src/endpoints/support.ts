// src/endpoints/support.ts
// Support API endpoints for widget integration
// - POST /api/support/ticket - Create support ticket
// - POST /api/support/answer - Query support docs and generate AI answer

import type { Endpoint } from 'payload'
import { getSupportMeiliClient, getSupportIndexName } from '../lib/meiliSupport'

// Severity levels for tickets
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
type Severity = (typeof VALID_SEVERITIES)[number]

// --- Support search helpers ---

// Only allow lowercase alphanumeric + hyphens for app slugs (or "*" for global docs query)
const isSafeAppSlug = (s: string): boolean => s === '*' || /^[a-z0-9-]+$/.test(s)

// Escape values for Meili filter strings inside double-quotes
function escMeiliFilterValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * Removes leading question "fluff" that hurts recall:
 *  "How do I", "What is", "Can I", "Where can I", etc.
 * Keeps the meaningful tail: "fix the support widget"
 */
function stripLeadingQuestionFluff(q: string): string {
  const s = normalizeQuery(q)

  // common lead-ins
  const patterns: RegExp[] = [
    /^(how|what|where|when|why)\s+(do|does|did|can|could|would|should|is|are|was|were)\s+(i|we|you|they|it)\s+/i,
    /^(how|what|where|when|why)\s+(do|does|did|can|could|would|should|is|are|was|were)\s+/i,
    /^(can|could|would|should|may|might)\s+(i|we|you|they|it)\s+/i,
    /^(please|help)\s+/i,
  ]

  let out = s
  for (const re of patterns) {
    out = out.replace(re, '')
  }

  out = normalizeQuery(out)

  // Don't return empty/too-short query
  return out.length >= 3 ? out : s
}

function routeMatchesPattern(pattern: string, route: string): boolean {
  if (!pattern || !route) return false
  if (pattern === route) return true

  // Simple wildcard support: "/api/support/*" means prefix match
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1)
    return route.startsWith(prefix)
  }

  return false
}

function uniqById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of arr) {
    if (!item?.id) continue
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

/**
 * Get database pool from Payload's db adapter
 * Payload uses @payloadcms/db-postgres which exposes the pool
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getDbPool(payload: any): any {
  // Payload's postgres adapter stores the pool in payload.db.pool
  return payload?.db?.pool
}

/**
 * POST /api/support/ticket
 * Create a support ticket in the database
 *
 * Body: {
 *   app_slug: string (required)
 *   message: string (required)
 *   severity?: 'low' | 'medium' | 'high' | 'critical'
 *   page_url?: string
 *   user_agent?: string
 *   sentry_event_id?: string
 *   user_id?: string
 *   details?: object
 * }
 */
export const supportTicketEndpoint: Endpoint = {
  path: '/support/ticket',
  method: 'post',
  handler: async (req) => {
    try {
      // Parse request body
      let body: Record<string, unknown> = {}
      try {
        body = await req.json?.() || {}
      } catch {
        return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
      }

      // Validate required fields
      const appSlug = typeof body.app_slug === 'string' ? body.app_slug.trim() : ''
      const message = typeof body.message === 'string' ? body.message.trim() : ''

      if (!appSlug) {
        return Response.json({ ok: false, error: 'app_slug is required' }, { status: 400 })
      }
      if (!isSafeAppSlug(appSlug)) {
        return Response.json({ ok: false, error: 'Invalid app_slug format' }, { status: 400 })
      }
      if (!message) {
        return Response.json({ ok: false, error: 'message is required' }, { status: 400 })
      }

      // Parse optional fields
      const severityInput = typeof body.severity === 'string' ? body.severity.toLowerCase() : 'medium'
      const severity: Severity = VALID_SEVERITIES.includes(severityInput as Severity)
        ? (severityInput as Severity)
        : 'medium'

      const pageUrl = typeof body.page_url === 'string' ? body.page_url : null
      const userAgent = typeof body.user_agent === 'string' ? body.user_agent : null
      const sentryEventId = typeof body.sentry_event_id === 'string' ? body.sentry_event_id : null
      const userId = typeof body.user_id === 'string' ? body.user_id : null
      const details = typeof body.details === 'object' && body.details !== null ? body.details : {}

      // Get database pool
      const pool = getDbPool(req.payload)
      if (!pool) {
        return Response.json(
          { ok: false, error: 'Database connection not available' },
          { status: 500 },
        )
      }

      // Insert ticket into database
      const result = await pool.query(
        `INSERT INTO support_tickets
         (app_slug, message, severity, page_url, user_agent, sentry_event_id, user_id, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id, created_at`,
        [appSlug, message, severity, pageUrl, userAgent, sentryEventId, userId, JSON.stringify(details)],
      )

      const ticket = result.rows[0]

      return Response.json({
        ok: true,
        ticket: {
          id: ticket.id,
          created_at: ticket.created_at,
          app_slug: appSlug,
          severity,
        },
      })
    } catch (err: unknown) {
      const error = err as Error
      console.error('Support ticket creation error:', error)
      return Response.json(
        { ok: false, error: error.message || 'Failed to create ticket' },
        { status: 500 },
      )
    }
  },
}

/**
 * POST /api/support/answer
 * Query support docs from MeiliSearch and generate AI answer
 *
 * Body: {
 *   app_slug: string (required)
 *   message: string (required)
 *   route?: string
 *   user_id?: string
 * }
 */
export const supportAnswerEndpoint: Endpoint = {
  path: '/support/answer',
  method: 'post',
  handler: async (req) => {
    try {
      // Parse request body
      let body: Record<string, unknown> = {}
      try {
        body = (await req.json?.()) || {}
      } catch {
        return Response.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
      }

      const appSlug = typeof body.app_slug === 'string' ? body.app_slug.trim() : ''
      const messageRaw = typeof body.message === 'string' ? body.message : ''

      if (!appSlug) {
        return Response.json({ ok: false, error: 'app_slug is required' }, { status: 400 })
      }
      if (!messageRaw?.trim()) {
        return Response.json({ ok: false, error: 'message is required' }, { status: 400 })
      }

      // Strongly recommend enforcing safe slug (prevents filter injection + bad data)
      if (!isSafeAppSlug(appSlug)) {
        return Response.json({ ok: false, error: 'Invalid app_slug format' }, { status: 400 })
      }

      // Optional fields
      const route = typeof body.route === 'string' ? body.route : null
      const userId = typeof body.user_id === 'string' ? body.user_id : null

      // Meili client
      const meili = getSupportMeiliClient()
      if (!meili) {
        return Response.json({ ok: false, error: 'MeiliSearch not configured' }, { status: 500 })
      }

      const indexName = getSupportIndexName()
      const index = meili.index(indexName)

      // Normalize + fallback query
      const q1 = normalizeQuery(messageRaw)
      const q2 = stripLeadingQuestionFluff(q1)

      // Include global docs (appSlug = "*") in results for any app query
      const filter = `_status = "published" AND (appSlug = "${escMeiliFilterValue(appSlug)}" OR appSlug = "*")`

      // Search (run up to 2 queries, merge results)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hits: any[] = []
      try {
        const r1 = await index.search(q1, {
          limit: 8,
          filter,
          attributesToRetrieve: [
            'id',
            'type',
            'title',
            'summary',
            'bodyText',
            'stepsText',
            'triggersText',
            'routes',
            'severity',
            '_status',
            'appSlug',
            'updatedAt',
          ],
        })

        hits = hits.concat(r1.hits || [])

        if (q2 && q2 !== q1) {
          const r2 = await index.search(q2, {
            limit: 8,
            filter,
            attributesToRetrieve: [
              'id',
              'type',
              'title',
              'summary',
              'bodyText',
              'stepsText',
              'triggersText',
              'routes',
              'severity',
              '_status',
              'appSlug',
              'updatedAt',
            ],
          })
          hits = hits.concat(r2.hits || [])
        }
      } catch (e: unknown) {
        const err = e as Error
        const msg = String(err?.message || '')
        if (msg.includes('Index') && msg.includes('not found')) {
          return Response.json(
            {
              ok: false,
              error:
                'Support search index not ready. Run /api/admin/meilisearch-support/configure then /api/admin/meilisearch-support/resync.',
            },
            { status: 503 },
          )
        }
        throw e
      }

      // De-dupe hits
      hits = uniqById(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hits.map((h: any) => ({
          id: String(h?.id || ''),
          type: String(h?.type || ''),
          title: String(h?.title || ''),
          summary: String(h?.summary || ''),
          bodyText: String(h?.bodyText || ''),
          stepsText: String(h?.stepsText || ''),
          triggersText: String(h?.triggersText || ''),
          routes: Array.isArray(h?.routes) ? h.routes.map(String) : [],
          docAppSlug: String(h?.appSlug || ''),
        })),
      )

      if (!hits.length) {
        return Response.json({
          ok: true,
          answer:
            "I couldn't find specific documentation for your question. Please create a support ticket for further assistance.",
          sources: [],
          fallback: true,
          query: q1,
          appSlug,
        })
      }

      // Re-rank: app-specific docs beat global "*" docs, then route matches
      hits.sort((a, b) => {
        // 1. App-specific docs (exact match) rank higher than global "*"
        const aAppSpecific = a.docAppSlug === appSlug ? 1 : 0
        const bAppSpecific = b.docAppSlug === appSlug ? 1 : 0
        if (aAppSpecific !== bAppSpecific) {
          return bAppSpecific - aAppSpecific
        }

        // 2. If route provided, prefer docs whose routes match
        if (route) {
          const aRouteMatch = (a.routes || []).some((p: string) => routeMatchesPattern(p, route))
          const bRouteMatch = (b.routes || []).some((p: string) => routeMatchesPattern(p, route))
          if (aRouteMatch !== bRouteMatch) {
            return Number(bRouteMatch) - Number(aRouteMatch)
          }
        }

        return 0
      })

      const bestMatch = hits[0]
      const bestContent =
        bestMatch.summary ||
        bestMatch.bodyText ||
        bestMatch.stepsText ||
        bestMatch.triggersText ||
        ''

      return Response.json({
        ok: true,
        answer: bestContent || 'Please see the documentation linked below.',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sources: hits.slice(0, 5).map((doc: any) => ({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          summary: doc.summary,
        })),
        query: q1,
        ...(q2 && q2 !== q1 ? { queryFallback: q2 } : {}),
        appSlug,
        ...(route ? { route } : {}),
        ...(userId ? { userId } : {}),
        llmEnabled: false,
      })
    } catch (err: unknown) {
      const error = err as Error
      console.error('Support answer error:', error)
      return Response.json(
        { ok: false, error: error.message || 'Failed to generate answer' },
        { status: 500 },
      )
    }
  },
}
