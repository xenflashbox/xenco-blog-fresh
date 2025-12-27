#!/usr/bin/env tsx
// scripts/verify-qa-setup.ts
// Verify QA test suite is properly configured
// Run with: npx tsx scripts/verify-qa-setup.ts [suite-path]

import { readFileSync } from 'fs'
import { join } from 'path'

const args = process.argv.slice(2)
const suitePath = args[0] || 'data/kb_qa_suite.phase1.json'
const suiteFullPath = join(process.cwd(), suitePath)

console.log(`\n🔍 Verifying QA test suite: ${suitePath}\n`)

try {
  const content = readFileSync(suiteFullPath, 'utf-8')
  const suite = JSON.parse(content)

  console.log(`✅ Valid JSON`)
  console.log(`📋 Description: ${suite.description || 'None'}`)
  console.log(`🔢 Total tests: ${suite.tests?.length || 0}`)

  if (!Array.isArray(suite.tests)) {
    console.error(`\n❌ ERROR: 'tests' must be an array`)
    process.exit(1)
  }

  let warnings = 0
  let errors = 0

  suite.tests.forEach((test: any, i: number) => {
    const num = i + 1

    // Required fields
    if (!test.name) {
      console.error(`\n❌ Test ${num}: Missing 'name'`)
      errors++
    }
    if (!test.app_slug) {
      console.error(`\n❌ Test ${num}: Missing 'app_slug'`)
      errors++
    }
    if (!test.message) {
      console.error(`\n❌ Test ${num}: Missing 'message'`)
      errors++
    }
    if (!test.expected) {
      console.error(`\n❌ Test ${num}: Missing 'expected' object`)
      errors++
    } else {
      if (typeof test.expected.resolved !== 'boolean') {
        console.error(`\n❌ Test ${num}: 'expected.resolved' must be true or false`)
        errors++
      }

      // Warn if resolved=true but no expectedTitle
      if (test.expected.resolved === true && !test.expected.expectedTitle) {
        console.warn(`\n⚠️  Test ${num} (${test.name}): resolved=true but no 'expectedTitle' - cannot validate KB ranking`)
        warnings++
      }
    }
  })

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`📊 Verification Results`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Tests:    ${suite.tests.length}`)
  console.log(`  Errors:   ${errors} ❌`)
  console.log(`  Warnings: ${warnings} ⚠️`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)

  if (errors > 0) {
    console.error(`❌ Test suite has errors. Please fix before running.\n`)
    process.exit(1)
  } else if (warnings > 0) {
    console.warn(`⚠️  Test suite has warnings. Consider adding 'expectedTitle' for better validation.\n`)
    process.exit(0)
  } else {
    console.log(`✅ Test suite is valid! Ready to run.\n`)
    console.log(`Run with: pnpm run test:kb-qa\n`)
    process.exit(0)
  }
} catch (err) {
  console.error(`\n❌ ERROR: ${err}\n`)
  process.exit(1)
}
