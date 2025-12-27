#!/usr/bin/env tsx
// scripts/run-support-kb-qa.ts
// QA Test Runner for Support KB System
// Run with: npx tsx scripts/run-support-kb-qa.ts [path/to/qa_suite.json]
//
// Loads QA test suite, runs tests against /api/support/ticket, validates responses
// Outputs detailed report to support-kb-qa.report.json

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// --- Types ---

interface QATestCase {
  name: string
  app_slug: string
  message: string
  route?: string
  page_url?: string
  conversation_history?: Array<{ role: string; content: string }>
  expected: {
    resolved: boolean
    action?: 'answer_now' | 'create_ticket'
    reason?: string
    expectedTitle?: string // if resolved, this title should be in top sources
    topN?: number // default 3, how many sources to check for expectedTitle
  }
}

interface QATestSuite {
  version: string
  description?: string
  tests: QATestCase[]
}

interface TestFailure {
  testName: string
  query: string
  route?: string
  expected: QATestCase['expected']
  got: {
    resolved: boolean
    sources?: Array<{ id: string; type: string; title: string; summary?: string }>
    gate?: {
      passed: boolean
      reason: string
      lexicalScore?: number
      rankingScore?: number
    }
    triage?: {
      category: string
      action: string
      reason: string
      forced?: boolean
    }
    confidence?: number
  }
  reason: string
}

interface QAReport {
  timestamp: string
  suiteFile: string
  total: number
  passed: number
  failed: number
  failures: TestFailure[]
}

// --- Configuration ---

const PAYLOAD_URL = process.env.PAYLOAD_URL || 'https://cms.resumecoach.me'
const DEFAULT_SUITE_PATH = 'data/kb_qa_suite.phase1.json'
const REPORT_PATH = 'support-kb-qa.report.json'

// --- Helper Functions ---

function loadTestSuite(path: string): QATestSuite {
  try {
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    console.error(`Failed to load test suite from ${path}:`, err)
    process.exit(1)
  }
}

async function runTestCase(test: QATestCase): Promise<{ passed: boolean; failure?: TestFailure }> {
  const topN = test.expected.topN ?? 3

  // Build request payload
  const payload: Record<string, unknown> = {
    app_slug: test.app_slug,
    message: test.message,
  }

  if (test.route) payload.route = test.route
  if (test.page_url) payload.page_url = test.page_url
  if (test.conversation_history) payload.conversation_history = test.conversation_history

  // Make API call
  let response: Response
  try {
    response = await fetch(`${PAYLOAD_URL}/api/support/ticket`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    return {
      passed: false,
      failure: {
        testName: test.name,
        query: test.message,
        route: test.route,
        expected: test.expected,
        got: { resolved: false },
        reason: `API call failed: ${err}`,
      },
    }
  }

  if (!response.ok) {
    return {
      passed: false,
      failure: {
        testName: test.name,
        query: test.message,
        route: test.route,
        expected: test.expected,
        got: { resolved: false },
        reason: `API returned ${response.status}: ${await response.text()}`,
      },
    }
  }

  // Parse response
  let data: Record<string, unknown>
  try {
    data = await response.json()
  } catch (err) {
    return {
      passed: false,
      failure: {
        testName: test.name,
        query: test.message,
        route: test.route,
        expected: test.expected,
        got: { resolved: false },
        reason: `Failed to parse JSON response: ${err}`,
      },
    }
  }

  // Extract response fields
  const resolved = data.resolved === true
  const sources = Array.isArray(data.sources)
    ? (data.sources as Array<{ id: string; type: string; title: string; summary?: string }>)
    : []
  const gate = typeof data.gate === 'object' && data.gate !== null ? (data.gate as Record<string, unknown>) : undefined
  const triage = typeof data.triage === 'object' && data.triage !== null ? (data.triage as Record<string, unknown>) : undefined
  const confidence = typeof data.confidence === 'number' ? data.confidence : undefined

  const got = {
    resolved,
    sources,
    gate: gate
      ? {
          passed: gate.passed === true,
          reason: String(gate.reason || ''),
          lexicalScore: typeof gate.lexicalScore === 'number' ? gate.lexicalScore : undefined,
          rankingScore: typeof gate.rankingScore === 'number' ? gate.rankingScore : undefined,
        }
      : undefined,
    triage: triage
      ? {
          category: String(triage.category || ''),
          action: String(triage.action || ''),
          reason: String(triage.reason || ''),
          forced: triage.forced === true,
        }
      : undefined,
    confidence,
  }

  // --- Validation Logic ---

  // 1. Check resolved status
  if (resolved !== test.expected.resolved) {
    return {
      passed: false,
      failure: {
        testName: test.name,
        query: test.message,
        route: test.route,
        expected: test.expected,
        got,
        reason: `Expected resolved=${test.expected.resolved}, got resolved=${resolved}`,
      },
    }
  }

  // 2. Check triage action (if specified)
  if (test.expected.action && got.triage) {
    if (got.triage.action !== test.expected.action) {
      return {
        passed: false,
        failure: {
          testName: test.name,
          query: test.message,
          route: test.route,
          expected: test.expected,
          got,
          reason: `Expected action="${test.expected.action}", got action="${got.triage.action}"`,
        },
      }
    }
  }

  // 3. Check triage reason (if specified)
  if (test.expected.reason && got.triage) {
    if (got.triage.reason !== test.expected.reason) {
      return {
        passed: false,
        failure: {
          testName: test.name,
          query: test.message,
          route: test.route,
          expected: test.expected,
          got,
          reason: `Expected reason="${test.expected.reason}", got reason="${got.triage.reason}"`,
        },
      }
    }
  }

  // 4. Check expectedTitle in top N sources (if resolved=true and expectedTitle specified)
  if (test.expected.resolved && test.expected.expectedTitle) {
    const topSources = sources.slice(0, topN)
    const titleFound = topSources.some((s) =>
      s.title.toLowerCase().includes(test.expected.expectedTitle!.toLowerCase()),
    )

    if (!titleFound) {
      return {
        passed: false,
        failure: {
          testName: test.name,
          query: test.message,
          route: test.route,
          expected: test.expected,
          got,
          reason: `Expected title "${test.expected.expectedTitle}" not found in top ${topN} sources. Got: ${topSources.map((s) => s.title).join(', ')}`,
        },
      }
    }
  }

  return { passed: true }
}

// --- Main Test Runner ---

async function runQASuite(suitePath: string): Promise<void> {
  console.log(`\n🧪 Loading QA test suite from: ${suitePath}`)
  const suite = loadTestSuite(suitePath)

  console.log(`📋 Test suite: ${suite.description || 'No description'}`)
  console.log(`🔢 Total tests: ${suite.tests.length}`)
  console.log(`🌐 API endpoint: ${PAYLOAD_URL}/api/support/ticket\n`)

  const failures: TestFailure[] = []
  let passed = 0
  let failed = 0

  for (let i = 0; i < suite.tests.length; i++) {
    const test = suite.tests[i]
    const testNum = i + 1

    process.stdout.write(`  [${testNum}/${suite.tests.length}] ${test.name}... `)

    const result = await runTestCase(test)

    if (result.passed) {
      console.log('✅ PASS')
      passed++
    } else {
      console.log('❌ FAIL')
      failed++
      if (result.failure) {
        failures.push(result.failure)
        console.log(`      Reason: ${result.failure.reason}`)
      }
    }
  }

  // --- Generate Report ---

  const report: QAReport = {
    timestamp: new Date().toISOString(),
    suiteFile: suitePath,
    total: suite.tests.length,
    passed,
    failed,
    failures,
  }

  // Write report to file
  const reportFullPath = join(process.cwd(), REPORT_PATH)
  writeFileSync(reportFullPath, JSON.stringify(report, null, 2), 'utf-8')

  // --- Summary ---

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📊 Test Results Summary`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Total:  ${report.total}`)
  console.log(`  Passed: ${report.passed} ✅`)
  console.log(`  Failed: ${report.failed} ❌`)
  console.log(`  Report: ${reportFullPath}`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  if (failures.length > 0) {
    console.log(`❌ ${failures.length} test(s) failed. See ${REPORT_PATH} for details.\n`)
    process.exit(1)
  } else {
    console.log(`✅ All tests passed!\n`)
    process.exit(0)
  }
}

// --- Entry Point ---

const args = process.argv.slice(2)
const suitePathArg = args[0] || DEFAULT_SUITE_PATH
const suiteFullPath = join(process.cwd(), suitePathArg)

runQASuite(suiteFullPath).catch((err) => {
  console.error('Fatal error running QA suite:', err)
  process.exit(1)
})
