#!/usr/bin/env tsx
// scripts/collect-failing-cases-v2.ts
// Collect failing cases in diagnostic JSONL format for architect review
// Key: Follow-up tests use conversation_history, NOT "follow-up:" prefix

import { writeFileSync } from 'fs'

const PAYLOAD_URL = process.env.PAYLOAD_URL || 'https://cms.xencolabs.com'

interface SourceHit {
  id: string
  title: string
  rankingScore: number
  lexicalScore: number
}

interface FailingCase {
  case_id: string
  endpoint: string
  request: {
    app_slug: string
    message: string
    route: string
    page_url: string
    conversation_history?: Array<{ role: string; content: string }>
    debug: boolean
  }
  expected: {
    expectedTitle: string
    expectedBehavior: 'top1' | 'top3' | 'gate_pass' | 'fallback_ok'
  }
  actual: {
    gate: Record<string, unknown>
    bestDocId: string | null
    sources_top5: SourceHit[]
    queryUsed: Record<string, unknown>
    answerPreview: string
  }
  classification: 'no_hits' | 'weak_match' | 'wrong_top1' | 'missing_history' | 'followup_prefix' | 'other'
  notes: string
}

// Test cases with proper conversation_history for follow-ups
const testCases = [
  // === STANDARD QUERIES (no follow-up context needed) ===
  {
    message: "why am i not getting callbacks",
    route: "/results",
    expectedTitle: "What is ATS and why does my resume get rejected",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },
  {
    message: "i got a 45 is that bad",
    route: "/results",
    expectedTitle: "What does my resume score mean on the Results page",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },
  {
    message: "upload failed",
    route: "/submit",
    expectedTitle: "Fix upload failed or file rejected error on Submit page",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "unsupported file type error",
    route: "/upload",
    expectedTitle: "Fix upload failed or file rejected error on Submit page",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },
  {
    message: "white screen wont load",
    route: "/dashboard",
    expectedTitle: "Fix white screen or blank page not loading",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "page is empty",
    route: "/results",
    expectedTitle: "Fix white screen or blank page not loading",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },
  {
    message: "stuck spinning forever",
    route: "/submit",
    expectedTitle: "Fix stuck spinning or loading forever after Submit",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "loading never finishes",
    route: "/submit",
    expectedTitle: "Fix stuck spinning or loading forever after Submit",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },
  {
    message: "processing stuck",
    route: "/submit",
    expectedTitle: "Fix stuck spinning or loading forever after Submit",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },
  {
    message: "500 error",
    route: "/submit",
    expectedTitle: "Fix 500 error or Something went wrong server error",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "something went wrong",
    route: "/dashboard",
    expectedTitle: "Fix 500 error or Something went wrong server error",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "internal server error",
    route: "/results",
    expectedTitle: "Fix 500 error or Something went wrong server error",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },
  {
    message: "page not found",
    route: "/dashboard",
    expectedTitle: "Fix 404 page not found error",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "404 error",
    route: "/results",
    expectedTitle: "Fix 404 page not found error",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "this page doesnt exist",
    route: "/dashboard",
    expectedTitle: "Fix 404 page not found error",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },
  {
    message: "failed to fetch",
    route: "/submit",
    expectedTitle: "Fix failed to fetch or connection error",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "connection error",
    route: "/dashboard",
    expectedTitle: "Fix failed to fetch or connection error",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "network error",
    route: "/submit",
    expectedTitle: "Fix failed to fetch or connection error",
    expectedBehavior: 'top3' as const,
    conversationHistory: undefined
  },

  // === FOLLOW-UP QUERIES (with conversation_history, NO prefix) ===
  {
    message: "what if my score is still low after updating",
    route: "/results",
    expectedTitle: "How to improve your resume score on the Results page",
    expectedBehavior: 'top3' as const,
    conversationHistory: [
      { role: "user", content: "how do I improve my score" },
      { role: "assistant", content: "To improve your score, provide a complete job description and ensure your profile lists all relevant skills." }
    ]
  },
  {
    message: "how long is the reset link valid",
    route: "/forgot-password",
    expectedTitle: "How to reset your password using Forgot Password",
    expectedBehavior: 'top1' as const,
    conversationHistory: [
      { role: "user", content: "I forgot my password" },
      { role: "assistant", content: "Click Forgot Password on the sign-in page. Enter your email and we'll send a reset link." }
    ]
  },
  {
    message: "what info should I include in a ticket",
    route: "/submit",
    expectedTitle: "Fix stuck spinning or loading forever after Submit",
    expectedBehavior: 'top3' as const,
    conversationHistory: [
      { role: "user", content: "my submit is stuck spinning" },
      { role: "assistant", content: "If stuck over 2 minutes, refresh the page. If it persists, submit a support ticket." }
    ]
  },
  {
    message: "how do I see all my resumes",
    route: "/dashboard",
    expectedTitle: "How to view and track your job applications on the Dashboard",
    expectedBehavior: 'top1' as const,
    conversationHistory: undefined
  },
  {
    message: "I edited but still dont see changes",
    route: "/editor",
    expectedTitle: "Fix Resume Editor not saving or changes lost",
    expectedBehavior: 'top1' as const,
    conversationHistory: [
      { role: "user", content: "how do I edit my resume" },
      { role: "assistant", content: "Click on your resume from the Dashboard to open the editor. Make changes and click Save." }
    ]
  },
  {
    message: "tried different browser and search still empty",
    route: "/jobs",
    expectedTitle: "Fix job search showing no results or wrong results",
    expectedBehavior: 'top1' as const,
    conversationHistory: [
      { role: "user", content: "job search shows no results" },
      { role: "assistant", content: "Try broader search terms, check your spelling, or try a larger location area." }
    ]
  },
  {
    message: "what info to include when reporting bug",
    route: "/results",
    expectedTitle: "Fix downloaded resume has wrong formatting or looks different",
    expectedBehavior: 'top3' as const,
    conversationHistory: [
      { role: "user", content: "my downloaded resume looks different than preview" },
      { role: "assistant", content: "This can happen with PDF rendering. Try downloading as Word format instead." }
    ]
  },
]

function classifyFailure(
  response: any,
  expectedTitle: string,
  expectedBehavior: string,
  hasConversationHistory: boolean
): { classification: FailingCase['classification']; notes: string } {
  const gate = response?.gate || {}
  const sources = response?.sources || []
  const topTitles = sources.slice(0, 3).map((s: any) => s.title?.toLowerCase() || '')
  const expectedLower = expectedTitle.toLowerCase()

  // Check gate.reason first
  if (gate.reason === 'no_hits' || (!gate.passed && sources.length === 0)) {
    return { classification: 'no_hits', notes: 'MeiliSearch returned zero results for query' }
  }

  if (gate.reason === 'weak_match' || (!gate.passed && sources.length > 0)) {
    return {
      classification: 'weak_match',
      notes: `Gate failed: lexical=${gate.lexicalScore?.toFixed(2)}, ranking=${gate.rankingScore?.toFixed(2)}`
    }
  }

  // Check title matching based on expectedBehavior
  if (expectedBehavior === 'top1') {
    const top1Match = topTitles[0]?.includes(expectedLower.slice(0, 30))
    if (!top1Match) {
      return {
        classification: 'wrong_top1',
        notes: `Expected "${expectedTitle}" at top1, got "${sources[0]?.title || 'none'}"`
      }
    }
  }

  if (expectedBehavior === 'top3') {
    const top3Match = topTitles.some((t: string) =>
      t.includes(expectedLower.slice(0, 30)) || expectedLower.includes(t.slice(0, 30))
    )
    if (!top3Match) {
      return {
        classification: 'wrong_top1',
        notes: `Expected "${expectedTitle}" in top3, got: ${topTitles.slice(0, 3).join(', ').slice(0, 80)}`
      }
    }
  }

  // Check if follow-up should have had history
  if (!hasConversationHistory && response?.queryUsed?.q1?.includes('follow')) {
    return { classification: 'followup_prefix', notes: 'Query contains "follow" but no conversation_history provided' }
  }

  return { classification: 'other', notes: 'Passed checks but may have edge case issues' }
}

async function fetchWithDebug(
  message: string,
  route: string,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<any> {
  const body: any = {
    app_slug: 'resume-coach',
    message,
    route,
    page_url: `https://resumecoach.me${route}`,
    debug: true
  }

  if (conversationHistory?.length) {
    body.conversation_history = conversationHistory
  }

  const res = await fetch(`${PAYLOAD_URL}/api/support/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

async function main() {
  const results: FailingCase[] = []

  console.log(`\n🧪 Collecting 25 failing cases (v2 format with conversation_history)\n`)
  console.log(`📡 API: ${PAYLOAD_URL}\n`)

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i]
    const hasHistory = !!tc.conversationHistory?.length
    console.log(`[${i + 1}/${testCases.length}] ${hasHistory ? '💬' : '📝'} ${tc.message.slice(0, 50)}...`)

    try {
      const response = await fetchWithDebug(tc.message, tc.route, tc.conversationHistory)
      const { classification, notes } = classifyFailure(
        response,
        tc.expectedTitle,
        tc.expectedBehavior,
        hasHistory
      )

      // Build sources_top5 with scores
      const debugHits = response?.debug?.topHits || []
      const sources = response?.sources || []
      const sources_top5: SourceHit[] = sources.slice(0, 5).map((s: any, idx: number) => ({
        id: s.id || '',
        title: s.title || '',
        rankingScore: debugHits[idx]?._rankingScore ?? 0,
        lexicalScore: debugHits[idx]?.lexicalScore ?? 0
      }))

      results.push({
        case_id: `FC-${String(i + 1).padStart(3, '0')}`,
        endpoint: '/api/support/answer',
        request: {
          app_slug: 'resume-coach',
          message: tc.message,
          route: tc.route,
          page_url: `https://resumecoach.me${tc.route}`,
          ...(tc.conversationHistory ? { conversation_history: tc.conversationHistory } : {}),
          debug: true
        },
        expected: {
          expectedTitle: tc.expectedTitle,
          expectedBehavior: tc.expectedBehavior
        },
        actual: {
          gate: response?.gate || {},
          bestDocId: response?.bestDocId || null,
          sources_top5,
          queryUsed: response?.queryUsed || {},
          answerPreview: (response?.answer || '').slice(0, 160)
        },
        classification,
        notes
      })
    } catch (err) {
      results.push({
        case_id: `FC-${String(i + 1).padStart(3, '0')}`,
        endpoint: '/api/support/answer',
        request: {
          app_slug: 'resume-coach',
          message: tc.message,
          route: tc.route,
          page_url: `https://resumecoach.me${tc.route}`,
          ...(tc.conversationHistory ? { conversation_history: tc.conversationHistory } : {}),
          debug: true
        },
        expected: {
          expectedTitle: tc.expectedTitle,
          expectedBehavior: tc.expectedBehavior
        },
        actual: {
          gate: {},
          bestDocId: null,
          sources_top5: [],
          queryUsed: {},
          answerPreview: `ERROR: ${String(err)}`
        },
        classification: 'other',
        notes: `Fetch failed: ${String(err)}`
      })
    }

    await new Promise(r => setTimeout(r, 300))
  }

  // Write JSONL
  const jsonl = results.map(r => JSON.stringify(r)).join('\n')
  const outputPath = 'data/failing_cases_v2.jsonl'
  writeFileSync(outputPath, jsonl, 'utf-8')

  // Summary
  const byClass = results.reduce((acc, r) => {
    acc[r.classification] = (acc[r.classification] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  console.log(`\n✅ Wrote ${results.length} cases to ${outputPath}\n`)
  console.log('📊 Classification breakdown:')
  for (const [cls, count] of Object.entries(byClass)) {
    console.log(`   ${cls}: ${count}`)
  }
  console.log('')
}

main().catch(console.error)
