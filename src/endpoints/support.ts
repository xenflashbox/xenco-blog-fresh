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

// --- Smart Ticket triage helpers ---

type TriageCategory =
  | 'user_error'
  | 'false_bug'
  | 'valid_bug'
  | 'system_failure'
  | 'feature_request'

type TriageAction = 'answer_now' | 'create_ticket'
type TriageReason = 'kb_hit' | 'system_signal' | 'bug_signal' | 'feature_signal' | 'forced' | 'no_kb_match'

// Hard system signals: definitely infrastructure/system issues
function hasHardSystemSignal(s: string): boolean {
  const t = s.toLowerCase()
  return [
    '500',
    '502',
    '503',
    '504',
    '404',
    'timeout',
    'failed to fetch',
    'unable to connect',
    'network error',
    'connection refused',
    'dns error',
  ].some((k) => t.includes(k))
}

// Soft system signals: could be system or just a bug
function hasSoftSystemSignal(s: string): boolean {
  const t = s.toLowerCase()
  return [
    'stuck',
    'spin',
    'spinning',
    'loading forever',
    'never finishes',
    'hang',
    'hanging',
    'blank page',
    'white screen',
    'frozen',
    'unresponsive',
  ].some((k) => t.includes(k))
}

function looksLikeBugReport(s: string): boolean {
  const t = s.toLowerCase()
  return [
    'error',
    'broken',
    "doesn't work",
    'doesnt work',
    'crash',
    'crashed',
    'failed',
    'upload failed',
    'payment failed',
    'checkout failed',
    'processing loop',
    'bug',
    'glitch',
  ].some((k) => t.includes(k))
}

function looksLikeFeatureRequest(s: string): boolean {
  const t = s.toLowerCase()
  return [
    'feature request',
    'please add',
    'can you add',
    'would be nice',
    'suggestion',
    'enhancement',
    'wish list',
    'wishlist',
  ].some((k) => t.includes(k))
}

// --- Slack alerting ---

interface SlackAlertPayload {
  ticketId: string
  createdAt: string
  appSlug: string
  category: TriageCategory
  reason: TriageReason
  forced: boolean
  severity: string
  route: string | null
  pageUrl: string | null
  message: string
  userId: string | null
  userAgent: string | null
}

/**
 * Send a Slack alert for high-priority tickets (best-effort, non-blocking)
 */
async function sendSlackAlert(payload: SlackAlertPayload): Promise<boolean> {
  const webhookUrl = process.env.SUPPORT_SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return false // Alerts disabled
  }

  try {
    // Truncate message to 500 chars
    const truncatedMessage =
      payload.message.length > 500 ? payload.message.slice(0, 497) + '...' : payload.message

    // Build Slack blocks
    const severityEmoji =
      payload.severity === 'critical'
        ? '🔴'
        : payload.severity === 'high'
          ? '🟠'
          : payload.severity === 'medium'
            ? '🟡'
            : '🟢'

    const categoryEmoji =
      payload.category === 'system_failure'
        ? '💥'
        : payload.category === 'valid_bug'
          ? '🐛'
          : payload.category === 'feature_request'
            ? '✨'
            : '❓'

    const slackPayload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${categoryEmoji} Support Ticket #${payload.ticketId}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*App:*\n${payload.appSlug}`,
            },
            {
              type: 'mrkdwn',
              text: `*Severity:*\n${severityEmoji} ${payload.severity}`,
            },
            {
              type: 'mrkdwn',
              text: `*Category:*\n${payload.category}`,
            },
            {
              type: 'mrkdwn',
              text: `*Reason:*\n${payload.reason}${payload.forced ? ' (forced)' : ''}`,
            },
          ],
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Message:*\n\`\`\`${truncatedMessage}\`\`\``,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: [
                payload.route ? `Route: \`${payload.route}\`` : null,
                payload.pageUrl ? `Page: ${payload.pageUrl}` : null,
                payload.userId ? `User: ${payload.userId}` : null,
                `Created: ${payload.createdAt}`,
              ]
                .filter(Boolean)
                .join(' • '),
            },
          ],
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload),
    })

    return response.ok
  } catch (err) {
    console.error('Slack alert failed (non-fatal):', err)
    return false
  }
}

/**
 * Internal helper to search support docs (reuses /support/answer logic)
 */
async function searchSupportDocs(opts: {
  appSlug: string
  message: string
  route?: string | null
}) {
  const meili = getSupportMeiliClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!meili) return { hits: [] as any[], q1: '', q2: '' }

  const index = meili.index(getSupportIndexName())

  const q1 = normalizeQuery(opts.message)
  const q2 = stripLeadingQuestionFluff(q1)

  const filter = `_status = "published" AND (appSlug = "${escMeiliFilterValue(opts.appSlug)}" OR appSlug = "*")`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let hits: any[] = []
  try {
    const r1 = await index.search(q1, { limit: 8, filter })
    hits = hits.concat(r1.hits || [])
    if (q2 && q2 !== q1) {
      const r2 = await index.search(q2, { limit: 8, filter })
      hits = hits.concat(r2.hits || [])
    }
  } catch {
    // Index might not exist yet, return empty
    return { hits: [], q1, q2 }
  }

  // Normalize + dedupe
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

  // Re-rank: app-specific > global, then route match (same as /answer)
  hits.sort((a, b) => {
    const aApp = a.docAppSlug === opts.appSlug ? 1 : 0
    const bApp = b.docAppSlug === opts.appSlug ? 1 : 0
    if (aApp !== bApp) return bApp - aApp

    if (opts.route) {
      const aRoute = (a.routes || []).some((p: string) => routeMatchesPattern(p, opts.route!))
      const bRoute = (b.routes || []).some((p: string) => routeMatchesPattern(p, opts.route!))
      if (aRoute !== bRoute) return Number(bRoute) - Number(aRoute)
    }
    return 0
  })

  return { hits, q1, q2 }
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

      // Smart Ticket: triage and answer-first logic
      const detailsObj =
        typeof details === 'object' && details !== null ? (details as Record<string, unknown>) : {}

      const route =
        typeof body.route === 'string'
          ? body.route
          : typeof detailsObj.route === 'string'
            ? String(detailsObj.route)
            : null

      // Support force_ticket from both top-level and details
      const forceTicket =
        body.force_ticket === true ||
        (typeof detailsObj.force_ticket === 'boolean' && detailsObj.force_ticket === true)

      // Detect message signals
      const hasHardSignal = hasHardSystemSignal(message)
      const hasSoftSignal = hasSoftSystemSignal(message)
      const isBug = looksLikeBugReport(message)
      const isFeature = looksLikeFeatureRequest(message)

      // ANSWER-FIRST: if no bug/feature signals and not forced, try KB first
      if (!forceTicket && !hasHardSignal && !isBug && !isFeature) {
        const { hits } = await searchSupportDocs({ appSlug, message, route })

        if (hits.length) {
          const best = hits[0]
          const answer =
            best.summary || best.bodyText || best.stepsText || best.triggersText || ''

          if (answer) {
            return Response.json({
              ok: true,
              resolved: true,
              answer,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              sources: hits.slice(0, 5).map((d: any) => ({
                id: d.id,
                type: d.type,
                title: d.title,
                summary: d.summary,
              })),
              triage: {
                category: 'user_error' as TriageCategory,
                action: 'answer_now' as TriageAction,
                reason: 'kb_hit' as TriageReason,
                confidence: 0.75,
                route,
              },
            })
          }
        }
      }

      // Determine triage category and reason
      let category: TriageCategory = 'user_error'
      let reason: TriageReason = 'no_kb_match'

      if (forceTicket) {
        // Forced ticket - still categorize but note it was forced
        reason = 'forced'
        if (hasHardSignal) category = 'system_failure'
        else if (isFeature) category = 'feature_request'
        else if (isBug || hasSoftSignal) category = 'valid_bug'
        else category = 'user_error'
      } else if (hasHardSignal) {
        // Hard system signals always mean system_failure
        category = 'system_failure'
        reason = 'system_signal'
      } else if (isFeature) {
        category = 'feature_request'
        reason = 'feature_signal'
      } else if (isBug) {
        // Bug signals (error, broken, crash) without hard system signals
        category = 'valid_bug'
        reason = 'bug_signal'
      } else if (hasSoftSignal) {
        // Soft signals (stuck, spinning) without KB match = system_failure
        category = 'system_failure'
        reason = 'system_signal'
      }

      const detailsFinal = {
        ...detailsObj,
        route: route ?? detailsObj.route ?? null,
        triage: {
          category,
          action: 'create_ticket' as TriageAction,
          reason,
          route,
          page_url: pageUrl,
          severity,
          forced: forceTicket,
          confidence: hasHardSignal || isBug || isFeature ? 0.7 : hasSoftSignal ? 0.6 : 0.5,
        },
      }

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
        [appSlug, message, severity, pageUrl, userAgent, sentryEventId, userId, JSON.stringify(detailsFinal)],
      )

      const ticket = result.rows[0]

      // Slack alerting for high-priority tickets
      // Criteria: action=create_ticket AND (category=system_failure OR severity=high/critical)
      let slackAlerted = false
      const shouldAlert =
        (category === 'system_failure' || severity === 'high' || severity === 'critical') &&
        !detailsObj.alerted_at // Idempotency: skip if already alerted

      if (shouldAlert) {
        const alertSent = await sendSlackAlert({
          ticketId: String(ticket.id),
          createdAt: ticket.created_at,
          appSlug,
          category,
          reason,
          forced: forceTicket,
          severity,
          route,
          pageUrl,
          message,
          userId,
          userAgent,
        })

        if (alertSent) {
          slackAlerted = true
          // Update ticket with alerted_at timestamp for idempotency
          try {
            await pool.query(
              `UPDATE support_tickets
               SET details = details || $1::jsonb
               WHERE id = $2`,
              [JSON.stringify({ alerted_at: new Date().toISOString() }), ticket.id],
            )
          } catch (updateErr) {
            console.error('Failed to update alerted_at (non-fatal):', updateErr)
          }
        }
      }

      return Response.json({
        ok: true,
        ticket: {
          id: ticket.id,
          created_at: ticket.created_at,
          app_slug: appSlug,
          severity,
          triage: {
            category,
            action: 'create_ticket' as TriageAction,
            reason,
            forced: forceTicket,
          },
          ...(slackAlerted ? { slack_alerted: true } : {}),
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

/**
 * GET /api/support/health
 * Health check endpoint for monitoring DB and MeiliSearch status
 * Optional auth via SUPPORT_HEALTH_TOKEN env var (Bearer token)
 */
export const supportHealthEndpoint: Endpoint = {
  path: '/support/health',
  method: 'get',
  handler: async (req) => {
    const startedAt = Date.now()

    // Optional auth: if SUPPORT_HEALTH_TOKEN is set, require it
    const token = process.env.SUPPORT_HEALTH_TOKEN?.trim()
    if (token) {
      const authHeader = req.headers.get('authorization') || ''
      if (authHeader !== `Bearer ${token}`) {
        return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
      }
    }

    // --- DB health ---
    let dbOk = false
    let dbError: string | null = null
    try {
      const pool = getDbPool(req.payload)
      if (!pool) throw new Error('Database pool not available')
      await pool.query('SELECT 1 AS ok')
      dbOk = true
    } catch (e: unknown) {
      dbError = (e as Error)?.message || 'DB check failed'
    }

    // --- Meili health ---
    let meiliOk = false
    let meiliError: string | null = null
    const indexName = getSupportIndexName()

    try {
      const meili = getSupportMeiliClient()
      if (!meili) throw new Error('MeiliSearch not configured')

      const index = meili.index(indexName)

      // getStats is a quick way to confirm the index exists and is reachable
      await index.getStats()
      meiliOk = true
    } catch (e: unknown) {
      meiliError = (e as Error)?.message || 'Meili check failed'
    }

    const overallOk = dbOk && meiliOk
    const durationMs = Date.now() - startedAt

    return Response.json(
      {
        ok: overallOk,
        status: overallOk ? 'ok' : 'degraded',
        checks: {
          db: { ok: dbOk, error: dbError },
          meili: { ok: meiliOk, error: meiliError, index: indexName },
        },
        duration_ms: durationMs,
        ts: new Date().toISOString(),
      },
      { status: overallOk ? 200 : 503 },
    )
  },
}

/**
 * GET /api/support/uptime
 * Lightweight public endpoint for uptime monitors
 * Returns { ok: true } and nothing else
 */
export const supportUptimeEndpoint: Endpoint = {
  path: '/support/uptime',
  method: 'get',
  handler: async () => {
    return Response.json({ ok: true })
  },
}
