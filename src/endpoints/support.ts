// src/endpoints/support.ts
// Support API endpoints for widget integration
// - POST /api/support/ticket - Create support ticket
// - POST /api/support/answer - Query support docs and generate AI answer
//
// v1.1: LLM-Synthesized answers with conversation-aware retrieval

import type { Endpoint } from 'payload'
import { getSupportMeiliClient, getSupportIndexName } from '../lib/meiliSupport'

// Severity levels for tickets
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const
type Severity = (typeof VALID_SEVERITIES)[number]

// --- LLM Configuration (Provider-Agnostic) ---
type LLMProvider = 'anthropic' | 'openai'

const LLM_CONFIG = {
  enabled: process.env.SUPPORT_LLM_ENABLED === 'true',
  // Primary provider (default: anthropic for Haiku)
  provider: (process.env.SUPPORT_LLM_PROVIDER || 'anthropic') as LLMProvider,
  model: process.env.SUPPORT_LLM_MODEL || 'claude-3-5-haiku-20241022',
  maxTokens: parseInt(process.env.SUPPORT_LLM_MAX_TOKENS || '300', 10),
  // Fallback provider (optional)
  fallbackProvider: process.env.SUPPORT_LLM_FALLBACK_PROVIDER as LLMProvider | undefined,
  fallbackModel: process.env.SUPPORT_LLM_FALLBACK_MODEL || 'gpt-4o-mini',
}

// --- LLM Types ---
interface LLMSource {
  id: string
  type: string
  title: string
  summary?: string
}

interface LLMGate {
  passed: boolean
  reason: 'no_hits' | 'weak_match' | 'passed'
  lexicalScore?: number
  rankingScore?: number
}

interface LLMResult {
  ok: true
  answer?: string
  sources: LLMSource[]
  bestDocId?: string | null
  confidence: number
  gate: LLMGate
  queryUsed: { q1: string; q2?: string; qContext?: string }
  llmEnabled: boolean
}

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
 * Extract route from various sources with fallback logic
 * Priority: explicit route > page_url pathname > referer pathname
 */
function resolveRoute(opts: {
  route?: string | null
  pageUrl?: string | null
  referer?: string | null
}): string | null {
  // 1. If explicit route provided, use it
  if (opts.route && opts.route.trim()) {
    return opts.route.trim()
  }

  // 2. Try to extract from page_url
  if (opts.pageUrl) {
    try {
      const url = new URL(opts.pageUrl)
      if (url.pathname && url.pathname !== '/') {
        return url.pathname
      }
    } catch {
      // Invalid URL, continue to next fallback
    }
  }

  // 3. Try to extract from Referer header
  if (opts.referer) {
    try {
      const url = new URL(opts.referer)
      if (url.pathname && url.pathname !== '/') {
        return url.pathname
      }
    } catch {
      // Invalid URL, return null
    }
  }

  return null
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

// --- Relevance Gate Helpers ---

/**
 * Compute lexical overlap score between query and document text
 * Returns 0.0 - 1.0 based on how many query tokens appear in the doc
 */
function computeLexicalScore(query: string, docText: string): number {
  if (!query || !docText) return 0

  // Tokenize: lowercase, split on non-alphanumeric
  const qTokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 2)
  const docLower = docText.toLowerCase()

  if (!qTokens.length) return 0

  let matches = 0
  for (const token of qTokens) {
    if (docLower.includes(token)) matches++
  }

  return matches / qTokens.length
}

/**
 * Extract context from conversation history for improved retrieval
 * IMPORTANT: Only uses USER messages - never include assistant messages
 * This prevents the widget from drifting based on its own responses
 */
function extractConversationContext(
  history?: Array<{ role: string; content: string }>,
  currentMessage?: string
): string | null {
  if (!history?.length) return null

  // CRITICAL: Only include USER messages (role === 'user')
  // Never include assistant messages in context - they can cause drift
  const userMessages = history.filter(m => m.role === 'user')

  if (!userMessages.length) return null

  // Get last 2-3 user messages
  const recent = userMessages.slice(-3)

  // Extract key terms from user messages only
  const contextParts = recent
    .map(m => normalizeQuery(m.content))
    .filter(c => c.length > 3)

  if (!contextParts.length) return null

  // If current message is very short (e.g., "I can't find it"),
  // combine with the most recent user message for better context
  if (currentMessage && currentMessage.length < 30 && contextParts.length > 0) {
    const lastUserMsg = contextParts[contextParts.length - 1]
    return `${lastUserMsg} ${currentMessage}`
  }

  // Join with space, will be used for broader context search
  return contextParts.join(' ')
}

/**
 * Check if a doc passes the relevance gate
 * Requires: lexical score >= 0.2 OR ranking score >= 0.4
 */
function checkRelevanceGate(
  query: string,
  doc: {
    title: string
    summary: string
    bodyText?: string
    stepsText?: string
    triggersText?: string
  },
  rankingScore?: number
): { passed: boolean; lexicalScore: number; rankingScore?: number } {
  // Combine all doc text for lexical check
  const docText = [
    doc.title || '',
    doc.summary || '',
    doc.bodyText || '',
    doc.stepsText || '',
    doc.triggersText || '',
  ].join(' ')

  const lexicalScore = computeLexicalScore(query, docText)

  // Pass if lexical >= 0.2 OR ranking >= 0.4
  const passed = lexicalScore >= 0.2 || (rankingScore !== undefined && rankingScore >= 0.4)

  return { passed, lexicalScore, rankingScore }
}

/**
 * Call LLM provider (Anthropic Haiku or OpenAI) to synthesize an answer
 * Provider-agnostic: supports Anthropic Messages API and OpenAI Chat Completions
 */
async function callLLMProvider(params: {
  provider: LLMProvider
  model: string
  system: string
  user: string
  maxTokens: number
}): Promise<string> {
  const { provider, model, system, user, maxTokens } = params

  if (provider === 'anthropic') {
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) throw new Error('ANTHROPIC_API_KEY missing')

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })

    if (!resp.ok) {
      const errorText = await resp.text()
      throw new Error(`Anthropic LLM error: ${resp.status} - ${errorText}`)
    }
    const data = await resp.json()

    // content is an array; extract text blocks safely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = Array.isArray(data?.content)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? data.content.map((c: any) => c?.text).filter(Boolean).join('\n').trim()
      : ''

    return text
  }

  // provider === 'openai'
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY missing')

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })

  if (!resp.ok) {
    const errorText = await resp.text()
    throw new Error(`OpenAI LLM error: ${resp.status} - ${errorText}`)
  }
  const data = await resp.json()

  // Extract from OpenAI chat completions response
  const text = data?.choices?.[0]?.message?.content?.trim() || ''
  return text
}

/**
 * Call LLM to synthesize an answer from KB content
 * Tries primary provider first, then fallback if configured
 */
async function callLLM(
  userMessage: string,
  kbContent: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<string | null> {
  if (!LLM_CONFIG.enabled) {
    return null
  }

  // Build system prompt with strict KB-only instructions
  const systemPrompt = `You are a helpful support assistant. Answer the user's question using ONLY the KB content provided below. Be concise (2-3 sentences max). If the KB content doesn't fully answer the question, say so and suggest they create a support ticket. Do NOT use any knowledge outside of the provided KB content.

KB Content:
${kbContent}`

  // Build user message with conversation context
  const contextParts: string[] = []
  if (conversationHistory?.length) {
    const recentUserMsgs = conversationHistory
      .filter(m => m.role === 'user')
      .slice(-2)
      .map(m => m.content)
    if (recentUserMsgs.length) {
      contextParts.push(`Previous questions: ${recentUserMsgs.join(' | ')}`)
    }
  }
  contextParts.push(`Current question: ${userMessage}`)
  const fullUserMessage = contextParts.join('\n\n')

  // Try primary provider
  try {
    const result = await callLLMProvider({
      provider: LLM_CONFIG.provider,
      model: LLM_CONFIG.model,
      system: systemPrompt,
      user: fullUserMessage,
      maxTokens: LLM_CONFIG.maxTokens,
    })
    if (result) return result
  } catch (err) {
    console.error(`Primary LLM (${LLM_CONFIG.provider}) failed:`, err)
  }

  // Try fallback provider if configured
  if (LLM_CONFIG.fallbackProvider && LLM_CONFIG.fallbackModel) {
    try {
      const result = await callLLMProvider({
        provider: LLM_CONFIG.fallbackProvider,
        model: LLM_CONFIG.fallbackModel,
        system: systemPrompt,
        user: fullUserMessage,
        maxTokens: LLM_CONFIG.maxTokens,
      })
      if (result) return result
    } catch (err) {
      console.error(`Fallback LLM (${LLM_CONFIG.fallbackProvider}) failed:`, err)
    }
  }

  return null
}

/**
 * getSupportAnswerWithLLM - Shared function for LLM-synthesized answers
 *
 * Features:
 * - Conversation-aware retrieval (uses history for context)
 * - Relevance gate (lexical + ranking score)
 * - LLM synthesis when enabled
 */
async function getSupportAnswerWithLLM(opts: {
  appSlug: string
  message: string
  route?: string | null
  pageUrl?: string | null
  conversationHistory?: Array<{ role: string; content: string }>
}): Promise<LLMResult> {
  const { appSlug, message, route, conversationHistory } = opts

  const meili = getSupportMeiliClient()
  if (!meili) {
    return {
      ok: true,
      sources: [],
      confidence: 0,
      gate: { passed: false, reason: 'no_hits' },
      queryUsed: { q1: message },
      llmEnabled: LLM_CONFIG.enabled,
    }
  }

  const index = meili.index(getSupportIndexName())
  const filter = `_status = "published" AND (appSlug = "${escMeiliFilterValue(appSlug)}" OR appSlug = "*")`

  // Query 1: Original message
  const q1 = normalizeQuery(message)
  // Query 2: Stripped question fluff
  const q2 = stripLeadingQuestionFluff(q1)
  // Query 3: Conversation context (if available) - USER messages only
  const qContext = extractConversationContext(conversationHistory, message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let hits: any[] = []

  try {
    // Run all queries and merge results
    const queries = [q1]
    if (q2 && q2 !== q1) queries.push(q2)
    if (qContext) queries.push(qContext)

    for (const query of queries) {
      const result = await index.search(query, {
        limit: 8,
        filter,
        showRankingScore: true,
        attributesToRetrieve: [
          'id', 'type', 'title', 'summary', 'bodyText',
          'stepsText', 'triggersText', 'routes', 'appSlug',
        ],
      })
      hits = hits.concat(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result.hits || []).map((h: any) => ({
          ...h,
          _rankingScore: h._rankingScore,
        }))
      )
    }
  } catch {
    return {
      ok: true,
      sources: [],
      confidence: 0,
      gate: { passed: false, reason: 'no_hits' },
      queryUsed: { q1, q2: q2 !== q1 ? q2 : undefined, qContext: qContext || undefined },
      llmEnabled: LLM_CONFIG.enabled,
    }
  }

  // Dedupe and normalize
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
      _rankingScore: typeof h?._rankingScore === 'number' ? h._rankingScore : undefined,
    }))
  )

  if (!hits.length) {
    return {
      ok: true,
      sources: [],
      confidence: 0,
      gate: { passed: false, reason: 'no_hits' },
      queryUsed: { q1, q2: q2 !== q1 ? q2 : undefined, qContext: qContext || undefined },
      llmEnabled: LLM_CONFIG.enabled,
    }
  }

  // Re-rank: app-specific > global, then route match
  hits.sort((a, b) => {
    const aApp = a.docAppSlug === appSlug ? 1 : 0
    const bApp = b.docAppSlug === appSlug ? 1 : 0
    if (aApp !== bApp) return bApp - aApp

    if (route) {
      const aRoute = (a.routes || []).some((p: string) => routeMatchesPattern(p, route))
      const bRoute = (b.routes || []).some((p: string) => routeMatchesPattern(p, route))
      if (aRoute !== bRoute) return Number(bRoute) - Number(aRoute)
    }
    return 0
  })

  const bestDoc = hits[0]

  // Check relevance gate
  const gateResult = checkRelevanceGate(q1, bestDoc, bestDoc._rankingScore)

  if (!gateResult.passed) {
    return {
      ok: true,
      sources: hits.slice(0, 5).map(d => ({
        id: d.id,
        type: d.type,
        title: d.title,
        summary: d.summary,
      })),
      bestDocId: bestDoc.id,
      confidence: gateResult.lexicalScore,
      gate: {
        passed: false,
        reason: 'weak_match',
        lexicalScore: gateResult.lexicalScore,
        rankingScore: gateResult.rankingScore,
      },
      queryUsed: { q1, q2: q2 !== q1 ? q2 : undefined, qContext: qContext || undefined },
      llmEnabled: LLM_CONFIG.enabled,
    }
  }

  // Gate passed - prepare answer
  const kbContent = [
    bestDoc.title ? `Title: ${bestDoc.title}` : '',
    bestDoc.summary ? `Summary: ${bestDoc.summary}` : '',
    bestDoc.stepsText ? `Steps: ${bestDoc.stepsText}` : '',
    bestDoc.bodyText ? `Details: ${bestDoc.bodyText}` : '',
  ].filter(Boolean).join('\n\n')

  let answer: string | undefined

  // Try LLM synthesis if enabled
  if (LLM_CONFIG.enabled) {
    const llmAnswer = await callLLM(message, kbContent, conversationHistory)
    if (llmAnswer) {
      answer = llmAnswer
    }
  }

  // Fallback to KB content if LLM not enabled or failed
  if (!answer) {
    answer = bestDoc.summary || bestDoc.bodyText || bestDoc.stepsText || undefined
  }

  return {
    ok: true,
    answer,
    sources: hits.slice(0, 5).map(d => ({
      id: d.id,
      type: d.type,
      title: d.title,
      summary: d.summary,
    })),
    bestDocId: bestDoc.id,
    confidence: Math.max(gateResult.lexicalScore, gateResult.rankingScore || 0),
    gate: {
      passed: true,
      reason: 'passed',
      lexicalScore: gateResult.lexicalScore,
      rankingScore: gateResult.rankingScore,
    },
    queryUsed: { q1, q2: q2 !== q1 ? q2 : undefined, qContext: qContext || undefined },
    llmEnabled: LLM_CONFIG.enabled,
  }
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

      // Resolve route with fallback: explicit route > page_url > Referer header
      const routeRaw =
        typeof body.route === 'string'
          ? body.route
          : typeof detailsObj.route === 'string'
            ? String(detailsObj.route)
            : null
      const referer = req.headers.get('referer') || null
      const route = resolveRoute({ route: routeRaw, pageUrl: pageUrl, referer })

      // Support force_ticket from both top-level and details
      const forceTicket =
        body.force_ticket === true ||
        (typeof detailsObj.force_ticket === 'boolean' && detailsObj.force_ticket === true)

      // Parse conversation_history for LLM context
      const conversationHistory = Array.isArray(body.conversation_history)
        ? body.conversation_history
            .filter((m): m is { role: string; content: string } =>
              typeof m === 'object' &&
              m !== null &&
              typeof (m as Record<string, unknown>).role === 'string' &&
              typeof (m as Record<string, unknown>).content === 'string'
            )
        : undefined

      // Detect message signals
      const hasHardSignal = hasHardSystemSignal(message)
      const hasSoftSignal = hasSoftSystemSignal(message)
      const isBug = looksLikeBugReport(message)
      const isFeature = looksLikeFeatureRequest(message)

      // ANSWER-FIRST: if no bug/feature signals and not forced, try KB first with LLM
      if (!forceTicket && !hasHardSignal && !isBug && !isFeature) {
        const llmResult = await getSupportAnswerWithLLM({
          appSlug,
          message,
          route,
          pageUrl,
          conversationHistory,
        })

        // Only return KB answer if gate passed and we have content
        if (llmResult.gate.passed && llmResult.answer) {
          return Response.json({
            ok: true,
            resolved: true,
            answer: llmResult.answer,
            sources: llmResult.sources,
            triage: {
              category: 'user_error' as TriageCategory,
              action: 'answer_now' as TriageAction,
              reason: 'kb_hit' as TriageReason,
              confidence: llmResult.confidence,
              route,
            },
            gate: llmResult.gate,
            queryUsed: llmResult.queryUsed,
            llmEnabled: llmResult.llmEnabled,
          })
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
 * v1.1: Now uses getSupportAnswerWithLLM with conversation context and relevance gate
 *
 * Body: {
 *   app_slug: string (required)
 *   message: string (required)
 *   route?: string
 *   page_url?: string
 *   user_id?: string
 *   conversation_history?: Array<{ role: string; content: string }>
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
      const routeRaw = typeof body.route === 'string' ? body.route : null
      const pageUrl = typeof body.page_url === 'string' ? body.page_url : null
      const userId = typeof body.user_id === 'string' ? body.user_id : null

      // Resolve route with fallback: explicit route > page_url > Referer header
      const referer = req.headers.get('referer') || null
      const route = resolveRoute({ route: routeRaw, pageUrl, referer })

      // Parse conversation_history for LLM context
      const conversationHistory = Array.isArray(body.conversation_history)
        ? body.conversation_history
            .filter((m): m is { role: string; content: string } =>
              typeof m === 'object' &&
              m !== null &&
              typeof (m as Record<string, unknown>).role === 'string' &&
              typeof (m as Record<string, unknown>).content === 'string'
            )
        : undefined

      // Use the new LLM-aware answer function
      const result = await getSupportAnswerWithLLM({
        appSlug,
        message: messageRaw.trim(),
        route,
        pageUrl,
        conversationHistory,
      })

      // Check if gate didn't pass (no hits or weak match)
      if (!result.gate.passed) {
        const fallbackReason = result.gate.reason === 'no_hits'
          ? "I couldn't find specific documentation for your question."
          : "I found some related content, but it may not fully address your question."

        return Response.json({
          ok: true,
          answer: `${fallbackReason} Please create a support ticket for further assistance.`,
          sources: result.sources,
          fallback: true,
          gate: result.gate,
          queryUsed: result.queryUsed,
          appSlug,
          ...(route ? { route } : {}),
          ...(userId ? { userId } : {}),
          llmEnabled: result.llmEnabled,
        })
      }

      // Gate passed - return the answer
      return Response.json({
        ok: true,
        answer: result.answer || 'Please see the documentation linked below.',
        sources: result.sources,
        bestDocId: result.bestDocId,
        confidence: result.confidence,
        gate: result.gate,
        queryUsed: result.queryUsed,
        appSlug,
        ...(route ? { route } : {}),
        ...(userId ? { userId } : {}),
        llmEnabled: result.llmEnabled,
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
