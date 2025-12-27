#!/usr/bin/env tsx
// scripts/collect-failing-cases.ts
// Collect failing cases with proper labeling based on gate.reason and expected vs actual

import { writeFileSync } from 'fs'

const PAYLOAD_URL = process.env.PAYLOAD_URL || 'https://cms.xencolabs.com'

interface FailingCase {
  case_id: string
  endpoint: string
  request: {
    app_slug: string
    message: string
    route?: string
    page_url?: string
    conversation_history?: Array<{ role: string; content: string }>
    debug: boolean
  }
  expected: string
  actual_response: unknown
  why_failed: string
  failure_category: 'no_hits' | 'weak_match' | 'title_mismatch' | 'missing_context'
}

// Test cases with proper expected titles
const testCases = [
  { query: "why am i not getting callbacks", route: "/results", expected: "What is ATS and why does my resume get rejected" },
  { query: "i got a 45 is that bad", route: "/results", expected: "What does my resume score mean on the Results page" },
  { query: "upload failed", route: "/submit", expected: "Fix upload failed or file rejected error on Submit page" },
  { query: "unsupported file type error", route: "/upload", expected: "Fix upload failed or file rejected error on Submit page" },
  { query: "white screen wont load", route: "/dashboard", expected: "Fix white screen or blank page not loading" },
  { query: "page is empty", route: "/results", expected: "Fix white screen or blank page not loading" },
  { query: "stuck spinning forever", route: "/submit", expected: "Fix stuck spinning or loading forever after Submit" },
  { query: "loading never finishes", route: "/submit", expected: "Fix stuck spinning or loading forever after Submit" },
  { query: "processing stuck", route: "/submit", expected: "Fix stuck spinning or loading forever after Submit" },
  { query: "500 error", route: "/submit", expected: "Fix 500 error or Something went wrong server error" },
  { query: "something went wrong", route: "/dashboard", expected: "Fix 500 error or Something went wrong server error" },
  { query: "internal server error", route: "/results", expected: "Fix 500 error or Something went wrong server error" },
  { query: "page not found", route: "/dashboard", expected: "Fix 404 page not found error" },
  { query: "404 error", route: "/results", expected: "Fix 404 page not found error" },
  { query: "this page doesnt exist", route: "/dashboard", expected: "Fix 404 page not found error" },
  { query: "failed to fetch", route: "/submit", expected: "Fix failed to fetch or connection error" },
  { query: "connection error", route: "/dashboard", expected: "Fix failed to fetch or connection error" },
  { query: "network error", route: "/submit", expected: "Fix failed to fetch or connection error" },
  { query: "follow-up: what if my score is still low after updating", route: "/results", expected: "How to improve your resume score on the Results page" },
  { query: "follow-up: how long is the reset link valid", route: "/forgot-password", expected: "How to reset your password using Forgot Password" },
  { query: "follow-up: what info should I include in a ticket", route: "/submit", expected: "Fix stuck spinning or loading forever after Submit" },
  { query: "how do I see all my resumes", route: "/dashboard", expected: "How to view and track your job applications on the Dashboard" },
  { query: "follow-up: I edited but still dont see changes", route: "/editor", expected: "Fix Resume Editor not saving or changes lost" },
  { query: "follow-up: tried different browser and search still empty", route: "/jobs", expected: "Fix job search showing no results or wrong results" },
  { query: "follow-up: what info to include when reporting bug", route: "/results", expected: "Fix downloaded resume has wrong formatting or looks different" },
]

/**
 * Classify failure based on response data
 */
function classifyFailure(
  response: any,
  expectedTitle: string,
  hasConversationHistory: boolean
): { why: string; category: FailingCase['failure_category'] } {
  // Check gate.reason
  const gateReason = response?.gate?.reason

  if (gateReason === 'no_hits' || (response?.fallback && !response?.sources?.length)) {
    return {
      why: `gate.reason=no_hits: MeiliSearch returned zero results`,
      category: 'no_hits'
    }
  }

  if (gateReason === 'weak_match') {
    return {
      why: `gate.reason=weak_match: lexicalScore=${response.gate?.lexicalScore?.toFixed(2)}, rankingScore=${response.gate?.rankingScore?.toFixed(2)}`,
      category: 'weak_match'
    }
  }

  // Check if expected title is in sources
  const sources = response?.sources || []
  const topTitle = sources[0]?.title || ''
  const top3Titles = sources.slice(0, 3).map((s: any) => s.title)

  if (!top3Titles.some((t: string) => t.toLowerCase().includes(expectedTitle.toLowerCase().slice(0, 30)))) {
    return {
      why: `title_mismatch: Expected "${expectedTitle}" not in top 3. Got: ${top3Titles.join(', ').slice(0, 100)}`,
      category: 'title_mismatch'
    }
  }

  // Check for follow-up queries missing conversation_history
  if (!hasConversationHistory && response?.queryUsed?.q1?.includes('follow')) {
    return {
      why: `missing_context: Follow-up query sent without conversation_history`,
      category: 'missing_context'
    }
  }

  // Default
  return {
    why: `unknown: Response looks valid but test failed`,
    category: 'title_mismatch'
  }
}

async function fetchWithDebug(query: string, route: string): Promise<unknown> {
  const res = await fetch(`${PAYLOAD_URL}/api/support/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_slug: 'resume-coach',
      message: query,
      route: route,
      debug: true
    })
  })
  return res.json()
}

async function main() {
  const results: FailingCase[] = []

  console.log(`\n🧪 Collecting failing cases with debug mode\n`)
  console.log(`📡 API: ${PAYLOAD_URL}\n`)

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i]
    console.log(`[${i + 1}/${testCases.length}] Fetching: ${tc.query.slice(0, 40)}...`)

    try {
      const response = await fetchWithDebug(tc.query, tc.route)
      const hasHistory = tc.query.startsWith('follow')
      const { why, category } = classifyFailure(response, tc.expected, hasHistory)

      results.push({
        case_id: `FC-${String(i + 1).padStart(3, '0')}`,
        endpoint: '/api/support/answer',
        request: {
          app_slug: 'resume-coach',
          message: tc.query,
          route: tc.route,
          debug: true
        },
        expected: `Should return KB doc: "${tc.expected}"`,
        actual_response: response,
        why_failed: why,
        failure_category: category
      })
    } catch (err) {
      results.push({
        case_id: `FC-${String(i + 1).padStart(3, '0')}`,
        endpoint: '/api/support/answer',
        request: {
          app_slug: 'resume-coach',
          message: tc.query,
          route: tc.route,
          debug: true
        },
        expected: `Should return KB doc: "${tc.expected}"`,
        actual_response: { error: String(err) },
        why_failed: `fetch_error: ${String(err)}`,
        failure_category: 'no_hits'
      })
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200))
  }

  // Write JSONL format
  const jsonl = results.map(r => JSON.stringify(r)).join('\n')
  const outputPath = 'data/failing_cases.jsonl'
  writeFileSync(outputPath, jsonl, 'utf-8')

  // Summary by category
  const byCategory = results.reduce((acc, r) => {
    acc[r.failure_category] = (acc[r.failure_category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`\n✅ Wrote ${results.length} cases to ${outputPath}\n`)
  console.log('📊 Failure breakdown:')
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`   ${cat}: ${count}`)
  }
}

main().catch(console.error)
