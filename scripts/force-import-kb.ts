#!/usr/bin/env tsx
// scripts/force-import-kb.ts
// Force import KB articles (creates new, skips if title+appSlug exists)

import { readFileSync } from 'fs'
import { join } from 'path'

interface KBArticle {
  appSlug: string
  title: string
  summary?: string
  bodyText?: string
  stepsText?: string
  triggersText?: string
  routes?: Array<{ route: string }>
  _status?: string
  type?: string
}

const BASE_URL = process.env.PAYLOAD_URL || 'https://cms.resumecoach.me'
const EMAIL = process.env.PAYLOAD_ADMIN_EMAIL
const PASSWORD = process.env.PAYLOAD_ADMIN_PASSWORD

if (!EMAIL || !PASSWORD) {
  console.error('❌ Missing PAYLOAD_ADMIN_EMAIL or PAYLOAD_ADMIN_PASSWORD')
  process.exit(1)
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  const data = await res.json()
  return data.token
}

async function getExistingTitles(token: string): Promise<Set<string>> {
  const titles = new Set<string>()
  let page = 1
  let hasMore = true

  while (hasMore) {
    const res = await fetch(`${BASE_URL}/api/support_kb_articles?limit=100&page=${page}`, {
      headers: { Authorization: `JWT ${token}` },
    })
    if (!res.ok) break
    const data = await res.json()
    for (const doc of data.docs || []) {
      // Key: title|appSlug
      titles.add(`${doc.title}|${doc.appSlug}`)
    }
    hasMore = data.hasNextPage
    page++
  }

  return titles
}

async function createArticle(token: string, article: KBArticle): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/support_kb_articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${token}`,
    },
    body: JSON.stringify({
      ...article,
      _status: article._status || 'published',
    }),
  })

  if (res.ok) {
    const data = await res.json()
    console.log(`  ✓ Created: ${article.title} (ID: ${data.doc.id})`)
    return true
  } else {
    const err = await res.text()
    console.error(`  ✗ Failed: ${article.title} - ${err.slice(0, 100)}`)
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const filePath = args[0] || 'data/support-kb-all-phases.v1.json'
  const fullPath = join(process.cwd(), filePath)

  console.log('\n🚀 Force KB Import\n')
  console.log(`📡 API: ${BASE_URL}`)
  console.log(`📁 File: ${filePath}\n`)

  // Login
  console.log('🔐 Logging in...')
  const token = await login()
  console.log('✅ Logged in\n')

  // Get existing titles
  console.log('📋 Fetching existing articles...')
  const existingTitles = await getExistingTitles(token)
  console.log(`   Found ${existingTitles.size} existing articles\n`)

  // Load articles
  const content = readFileSync(fullPath, 'utf-8')
  const articles: KBArticle[] = JSON.parse(content)
  console.log(`📄 Loaded ${articles.length} articles from file\n`)

  let created = 0
  let skipped = 0
  let failed = 0

  for (const article of articles) {
    const key = `${article.title}|${article.appSlug}`

    if (existingTitles.has(key)) {
      console.log(`  ⏭ Skipped (exists): ${article.title}`)
      skipped++
      continue
    }

    // Normalize routes
    if (article.routes && Array.isArray(article.routes)) {
      article.routes = article.routes.map((r) =>
        typeof r === 'string' ? { route: r } : r
      ) as Array<{ route: string }>
    }

    const success = await createArticle(token, article)
    if (success) {
      created++
      existingTitles.add(key) // Track so we don't try to create duplicates
    } else {
      failed++
    }
  }

  console.log('\n════════════════════════════════════════')
  console.log('📊 IMPORT SUMMARY')
  console.log('════════════════════════════════════════')
  console.log(`✅ Created:  ${created}`)
  console.log(`⏭  Skipped:  ${skipped}`)
  console.log(`❌ Failed:   ${failed}`)
  console.log(`📁 Total:    ${articles.length}`)
  console.log('════════════════════════════════════════\n')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
