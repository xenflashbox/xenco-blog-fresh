#!/usr/bin/env tsx
// scripts/import-support-kb.ts
// Idempotent KB article importer with upsert strategy
// Usage: npx tsx scripts/import-support-kb.ts data/pack1.json data/pack2.json

import * as fs from 'fs'
import * as path from 'path'

interface KBArticle {
  appSlug?: string
  title: string
  summary?: string
  bodyText?: string
  stepsText?: string
  triggersText?: string
  routes?: Array<{ route: string }> | string[]
  _status?: 'draft' | 'published'
  type?: 'kb_article' | 'announcement' | 'playbook'
}

interface ImportStats {
  created: number
  updated: number
  skipped: number
  failed: number
  errors: Array<{ file: string; article: string; error: string }>
}

const stats: ImportStats = {
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
}

// Normalize article data
function normalizeArticle(article: KBArticle): KBArticle {
  const normalized = { ...article }

  // Default appSlug to 'resume-coach'
  if (!normalized.appSlug) {
    normalized.appSlug = 'resume-coach'
  }

  // Default _status to 'published'
  if (!normalized._status) {
    normalized._status = 'published'
  }

  // Normalize routes to array of objects
  if (normalized.routes) {
    if (Array.isArray(normalized.routes)) {
      // Check if it's array of strings or objects
      normalized.routes = normalized.routes.map((route) => {
        if (typeof route === 'string') {
          return { route }
        }
        return route
      }) as Array<{ route: string }>
    }
  } else {
    normalized.routes = []
  }

  return normalized
}

// Check if article exists by title + appSlug
async function findExistingArticle(
  baseUrl: string,
  token: string,
  title: string,
  appSlug: string,
): Promise<{ id: string } | null> {
  const whereClause = encodeURIComponent(
    JSON.stringify({
      and: [
        { title: { equals: title } },
        { appSlug: { equals: appSlug } },
      ],
    }),
  )

  const url = `${baseUrl}/api/support_kb_articles?where=${whereClause}&limit=1`

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `JWT ${token}`,
      },
    })

    if (!res.ok) {
      console.error(`    ⚠ Query failed: ${res.status} ${res.statusText}`)
      return null
    }

    const data = await res.json()

    if (data.docs && data.docs.length > 0) {
      return { id: data.docs[0].id }
    }

    return null
  } catch (err) {
    console.error(`    ⚠ Query error:`, err)
    return null
  }
}

// Create new article
async function createArticle(
  baseUrl: string,
  token: string,
  article: KBArticle,
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/support_kb_articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${token}`,
      },
      body: JSON.stringify(article),
    })

    if (res.ok) {
      const data = await res.json()
      console.log(`    ✓ Created (ID: ${data.doc.id})`)
      stats.created++
      return true
    } else {
      const errorText = await res.text()
      console.error(`    ✗ Create failed: ${res.status}`, errorText.substring(0, 200))
      stats.failed++
      stats.errors.push({
        file: 'N/A',
        article: article.title,
        error: `Create failed: ${res.status} - ${errorText.substring(0, 100)}`,
      })
      return false
    }
  } catch (err) {
    console.error(`    ✗ Create error:`, err)
    stats.failed++
    stats.errors.push({
      file: 'N/A',
      article: article.title,
      error: `Create exception: ${err}`,
    })
    return false
  }
}

// Update existing article
async function updateArticle(
  baseUrl: string,
  token: string,
  id: string,
  article: KBArticle,
): Promise<boolean> {
  // Fields to update (exclude title and appSlug as they're used for lookup)
  const updatePayload: Partial<KBArticle> = {}

  if (article.summary !== undefined) updatePayload.summary = article.summary
  if (article.bodyText !== undefined) updatePayload.bodyText = article.bodyText
  if (article.stepsText !== undefined) updatePayload.stepsText = article.stepsText
  if (article.triggersText !== undefined) updatePayload.triggersText = article.triggersText
  if (article.routes !== undefined) updatePayload.routes = article.routes
  if (article._status !== undefined) updatePayload._status = article._status
  if (article.type !== undefined) updatePayload.type = article.type

  try {
    const res = await fetch(`${baseUrl}/api/support_kb_articles/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `JWT ${token}`,
      },
      body: JSON.stringify(updatePayload),
    })

    if (res.ok) {
      console.log(`    ✓ Updated (ID: ${id})`)
      stats.updated++
      return true
    } else {
      const errorText = await res.text()
      console.error(`    ✗ Update failed: ${res.status}`, errorText.substring(0, 200))
      stats.failed++
      stats.errors.push({
        file: 'N/A',
        article: article.title,
        error: `Update failed: ${res.status} - ${errorText.substring(0, 100)}`,
      })
      return false
    }
  } catch (err) {
    console.error(`    ✗ Update error:`, err)
    stats.failed++
    stats.errors.push({
      file: 'N/A',
      article: article.title,
      error: `Update exception: ${err}`,
    })
    return false
  }
}

// Upsert article (create or update)
async function upsertArticle(
  baseUrl: string,
  token: string,
  article: KBArticle,
  fileName: string,
): Promise<void> {
  const normalized = normalizeArticle(article)

  console.log(`  Processing: ${normalized.title}`)
  console.log(`    App: ${normalized.appSlug}, Status: ${normalized._status}`)

  // Check if exists
  const existing = await findExistingArticle(
    baseUrl,
    token,
    normalized.title,
    normalized.appSlug!,
  )

  if (existing) {
    // Update existing
    await updateArticle(baseUrl, token, existing.id, normalized)
  } else {
    // Create new
    await createArticle(baseUrl, token, normalized)
  }
}

// Process a single JSON file
async function processFile(
  baseUrl: string,
  token: string,
  filePath: string,
): Promise<void> {
  console.log(`\n📄 Processing file: ${filePath}`)

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`  ✗ File not found: ${filePath}`)
    stats.failed++
    stats.errors.push({
      file: filePath,
      article: 'N/A',
      error: 'File not found',
    })
    return
  }

  try {
    // Read and parse JSON
    const fileContent = fs.readFileSync(filePath, 'utf-8')
    let articles: KBArticle[]

    try {
      const parsed = JSON.parse(fileContent)
      // Handle both single object and array of objects
      articles = Array.isArray(parsed) ? parsed : [parsed]
    } catch (parseErr) {
      console.error(`  ✗ JSON parse error:`, parseErr)
      stats.failed++
      stats.errors.push({
        file: filePath,
        article: 'N/A',
        error: `JSON parse error: ${parseErr}`,
      })
      return
    }

    console.log(`  Found ${articles.length} article(s) in file`)

    // Process each article
    for (const article of articles) {
      if (!article.title) {
        console.error(`  ✗ Skipping article without title`)
        stats.skipped++
        continue
      }

      await upsertArticle(baseUrl, token, article, path.basename(filePath))
    }
  } catch (err) {
    console.error(`  ✗ File processing error:`, err)
    stats.failed++
    stats.errors.push({
      file: filePath,
      article: 'N/A',
      error: `File processing error: ${err}`,
    })
  }
}

// Main function
async function main() {
  console.log('🚀 KB Article Importer (Idempotent Upsert Strategy)\n')

  // Get file paths from CLI args
  const filePaths = process.argv.slice(2)

  if (filePaths.length === 0) {
    console.error('❌ No file paths provided')
    console.log('\nUsage: npx tsx scripts/import-support-kb.ts <file1.json> [file2.json] ...')
    console.log('\nExample:')
    console.log('  npx tsx scripts/import-support-kb.ts data/pack1.json data/pack2.json')
    process.exit(1)
  }

  // Environment configuration
  const baseUrl = process.env.PAYLOAD_URL || 'https://cms.resumecoach.me'
  const email = process.env.PAYLOAD_ADMIN_EMAIL
  const password = process.env.PAYLOAD_ADMIN_PASSWORD

  if (!email || !password) {
    console.error('❌ Missing credentials')
    console.log('Required environment variables:')
    console.log('  - PAYLOAD_ADMIN_EMAIL')
    console.log('  - PAYLOAD_ADMIN_PASSWORD')
    console.log('  - PAYLOAD_URL (optional, defaults to https://cms.resumecoach.me)')
    process.exit(1)
  }

  console.log(`📡 API Base URL: ${baseUrl}`)
  console.log(`👤 Admin Email: ${email}`)
  console.log(`📁 Files to process: ${filePaths.length}\n`)

  // Login
  console.log('🔐 Logging in to Payload...')
  try {
    const loginRes = await fetch(`${baseUrl}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!loginRes.ok) {
      const errorText = await loginRes.text()
      console.error('❌ Login failed:', loginRes.status, errorText)
      process.exit(1)
    }

    const { token } = await loginRes.json()
    console.log('✅ Logged in successfully\n')

    // Process each file
    for (const filePath of filePaths) {
      await processFile(baseUrl, token, filePath)
    }
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }

  // Print summary
  console.log('\n' + '='.repeat(60))
  console.log('📊 IMPORT SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Created:  ${stats.created}`)
  console.log(`🔄 Updated:  ${stats.updated}`)
  console.log(`⏭️  Skipped:  ${stats.skipped}`)
  console.log(`❌ Failed:   ${stats.failed}`)
  console.log(`📁 Total:    ${stats.created + stats.updated + stats.skipped + stats.failed}`)

  if (stats.errors.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('⚠️  ERRORS')
    console.log('='.repeat(60))
    stats.errors.forEach((err, idx) => {
      console.log(`\n${idx + 1}. File: ${err.file}`)
      console.log(`   Article: ${err.article}`)
      console.log(`   Error: ${err.error}`)
    })
  }

  console.log('\n✨ Import complete!\n')

  // Exit with error code if any failures
  process.exit(stats.failed > 0 ? 1 : 0)
}

// Run main function
main()
