// src/endpoints/support.ts
// Support API endpoints for widget integration
// - POST /api/support/ticket - Create support ticket
// - POST /api/support/answer - Query support docs and generate AI answer

import type { Endpoint } from 'payload'
import { getSupportMeiliClient, getSupportIndexName } from '../lib/meiliSupport'

// Severity levels for tickets
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
type Severity = (typeof VALID_SEVERITIES)[number]

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
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      if (!message) {
        return Response.json({ ok: false, error: 'message is required' }, { status: 400 })
      }

      // Optional fields
      const route = typeof body.route === 'string' ? body.route : null
      const userId = typeof body.user_id === 'string' ? body.user_id : null

      // Get MeiliSearch client
      const meili = getSupportMeiliClient()
      if (!meili) {
        return Response.json(
          { ok: false, error: 'MeiliSearch not configured' },
          { status: 500 },
        )
      }

      // Query support index
      const indexName = getSupportIndexName()
      const index = meili.index(indexName)

      // Build filter: appSlug and published status (uses _status not status)
      const filter = `appSlug = "${appSlug}" AND _status = "published"`

      // Search for relevant support docs
      const searchResult = await index.search(message, {
        limit: 5,
        filter,
      })

      // Extract context from search results (matches meiliSupport.ts document structure)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contextDocs = searchResult.hits.map((hit: any) => ({
        id: hit.id || '',
        type: hit.type || '',
        title: hit.title || '',
        summary: hit.summary || '',
        content: hit.bodyText || hit.stepsText || '',
      }))

      // If no docs found, return a fallback response
      if (contextDocs.length === 0) {
        return Response.json({
          ok: true,
          answer: "I couldn't find specific documentation for your question. Please create a support ticket for further assistance.",
          sources: [],
          fallback: true,
        })
      }

      // TODO: Call LLM gateway to generate answer from context
      // For now, return the top matching doc as the answer
      //
      // To implement LLM integration, you'll need:
      // 1. Set env var for your LLM API key (e.g., OPENAI_API_KEY or ANTHROPIC_API_KEY)
      // 2. Call the LLM with the user's message and context docs
      // 3. Return the generated answer
      //
      // Example with OpenAI:
      // const completion = await openai.chat.completions.create({
      //   model: 'gpt-4',
      //   messages: [
      //     { role: 'system', content: 'You are a helpful support assistant. Answer based on the provided documentation.' },
      //     { role: 'user', content: `Context:\n${contextDocs.map(d => d.content).join('\n\n')}\n\nQuestion: ${message}` }
      //   ]
      // })

      // For now, return the best matching doc content
      const bestMatch = contextDocs[0]

      return Response.json({
        ok: true,
        answer: bestMatch.summary || bestMatch.content || 'Please see the documentation linked below.',
        sources: contextDocs.map((doc: { id: string; type: string; title: string; summary: string; content: string }) => ({
          id: doc.id,
          type: doc.type,
          title: doc.title,
          summary: doc.summary,
        })),
        query: message,
        appSlug,
        ...(route ? { route } : {}),
        ...(userId ? { userId } : {}),
        // Flag indicating LLM integration is pending
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
