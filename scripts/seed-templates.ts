#!/usr/bin/env tsx
/**
 * scripts/seed-templates.ts
 *
 * Idempotent seeder for the global `templates` collection (PR #3 / prompt #02).
 *
 * INPUT — a JSON file already in Payload document shape, exported by the BlogCraft
 * API admin and relayed by Xen. NOT the original CSV: this script does no CSV
 * parsing. The file is either a top-level array of template objects, or an object
 * with a `docs` / `templates` array (Payload REST list shape — both accepted).
 *
 *   Usage (from repo root):
 *     pnpm exec tsx scripts/seed-templates.ts data/bc_templates.payload.json
 *     pnpm exec tsx scripts/seed-templates.ts data/bc_templates.payload.json --dry-run
 *
 * WHY LOCAL API (not raw pg, not REST):
 *   - Going through payload.create / payload.update fires the Templates afterChange
 *     hook, which is the intended sync path: each upsert pushes the row to
 *     api.blogcraft.app → Neon. A raw `pg` INSERT would bypass the webhook AND the
 *     slug-lock / JSON validators.
 *   - Local API runs in-process: no API-key handling, no network hop to the CMS.
 *
 * IDEMPOTENT: upsert keyed on `slug` (the canonical key). Re-runs UPDATE existing
 * rows rather than creating duplicates — matching prompt #02 Option C's note that
 * "as long as the slugs match, the Payload sync will UPDATE existing Neon rows."
 *
 * GATING: developing/structuring this script is NOT gated. The actual RUN is gated
 * on go-live coordination — the webhook must have TEMPLATES_SYNC_SECRET set in the
 * environment (and the BlogCraft endpoint live) or every upsert logs a sync skip.
 * Use --dry-run any time to validate the input file shape without writing.
 *
 * IMPORTANT: NODE_ENV must be `production` so @payloadcms/db-postgres does NOT run
 * pushDevSchema (interactive schema push can drop tables). This script forces it.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'

import type { Template } from '../src/payload-types'

// Fields accepted on a write: the collection-owned fields, minus Payload-managed
// ones (id / createdAt / updatedAt). Used to type the create/update payload.
type TemplateWriteData = Omit<Template, 'id' | 'createdAt' | 'updatedAt'>

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// ── Environment bootstrap (mirrors scripts/regenerate-site-media-sizes.ts) ──────
// Load .env then .env.production (later file does not override existing keys).
const envLocal = path.join(root, '.env')
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal })
const prodEnv = path.join(root, '.env.production')
if (fs.existsSync(prodEnv)) dotenv.config({ path: prodEnv, override: false })

// Never let db-postgres run pushDevSchema from an ops script.
if (process.env.NODE_ENV !== 'production') {
  ;(process.env as Record<string, string>).NODE_ENV = 'production'
}

// The swarm-internal hostname `payload-postgres_postgres` does not resolve on the
// host OS. PgBouncer publishes 5433 on managers; rewrite to it (same as media script).
if (
  process.env.DATABASE_URI?.includes('payload-postgres_postgres') &&
  process.env.DATABASE_URI_FALLBACK
) {
  process.env.DATABASE_URI = process.env.DATABASE_URI_FALLBACK
} else if (process.env.DATABASE_URI?.includes('payload-postgres_postgres')) {
  const pgbouncerPort = process.env.PGBOUNCER_PORT || '5433'
  const sslmode = process.env.PGSSLMODE || 'no-verify'
  process.env.DATABASE_URI = process.env.DATABASE_URI.replace(
    /payload-postgres_postgres:5432/,
    `127.0.0.1:${pgbouncerPort}`,
  )
  const sep = process.env.DATABASE_URI.includes('?') ? '&' : '?'
  if (!/sslmode=/.test(process.env.DATABASE_URI)) {
    process.env.DATABASE_URI += `${sep}sslmode=${sslmode}`
  }
}

const DRY = process.argv.includes('--dry-run')
const inputArg = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'))

// ── Input shape ─────────────────────────────────────────────────────────────
// Only the fields the Templates collection owns. Unknown keys (id, createdAt,
// updatedAt from a Payload export) are stripped before write so we never try to
// set Payload-managed columns.
const TEMPLATE_FIELDS = [
  'slug',
  'label',
  'template_type',
  'article_type',
  'article_intent',
  'prompt_key',
  'outline_version',
  'copy_primitives',
  'required_sections',
  'template_json',
  'is_active',
  'data_required',
  'payload_schema',
  'data_required_message',
] as const

type TemplateInput = Record<string, unknown> & { slug?: unknown }

interface SeedStats {
  created: number
  updated: number
  skipped: number
  failed: number
  errors: Array<{ slug: string; error: string }>
}

function loadTemplates(file: string): TemplateInput[] {
  const abs = path.isAbsolute(file) ? file : path.join(root, file)
  if (!fs.existsSync(abs)) {
    throw new Error(`Input file not found: ${abs}`)
  }
  const parsed: unknown = JSON.parse(fs.readFileSync(abs, 'utf-8'))

  // Accept: top-level array, { docs: [...] } (REST list), or { templates: [...] }.
  const list: unknown =
    Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object'
        ? ((parsed as Record<string, unknown>).docs ??
          (parsed as Record<string, unknown>).templates)
        : undefined

  if (!Array.isArray(list)) {
    throw new Error(
      'Input JSON must be an array of templates, or an object with a `docs` or `templates` array.',
    )
  }
  return list as TemplateInput[]
}

/** Keep only collection-owned fields; drop id/createdAt/updatedAt/etc. */
function pickFields(t: TemplateInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of TEMPLATE_FIELDS) {
    if (t[key] !== undefined) out[key] = t[key]
  }
  return out
}

/** Minimal pre-write validation so the failure is a clear log line, not a stack. */
function validate(t: TemplateInput): string | null {
  if (typeof t.slug !== 'string' || !t.slug.trim()) return 'missing or non-string slug'
  if (typeof t.label !== 'string' || !t.label.trim()) return 'missing or non-string label'
  for (const arrField of ['copy_primitives', 'required_sections'] as const) {
    const v = t[arrField]
    if (!Array.isArray(v) || v.length === 0 || !v.every((x) => typeof x === 'string')) {
      return `${arrField} must be a non-empty array of strings`
    }
  }
  const tj = t.template_json
  if (typeof tj !== 'object' || tj === null || Array.isArray(tj)) {
    return 'template_json must be an object'
  }
  return null
}

async function main(): Promise<void> {
  if (!inputArg) {
    throw new Error(
      'Usage: pnpm exec tsx scripts/seed-templates.ts <input.json> [--dry-run]',
    )
  }

  const templates = loadTemplates(inputArg)
  console.log(
    `[seed-templates] loaded ${templates.length} template(s) from ${inputArg}` +
      (DRY ? ' (DRY RUN — no writes)' : ''),
  )

  const stats: SeedStats = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] }

  // Dynamic import so env bootstrap above runs before Payload reads process.env.
  // Relative path (not @payload-config alias) to match scripts that run cleanly
  // under standalone tsx, where tsconfig path aliases are not resolved.
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })

  if (!process.env.TEMPLATES_SYNC_SECRET && !DRY) {
    console.warn(
      '[seed-templates] WARNING: TEMPLATES_SYNC_SECRET is not set. Rows will be written to ' +
        'Payload but the afterChange webhook will log a skip and NOT sync to Neon. This is the ' +
        'gated path — only proceed if you intend a Payload-only seed.',
    )
  }

  for (const raw of templates) {
    const slug = String(raw.slug ?? '').trim()
    const problem = validate(raw)
    if (problem) {
      stats.failed++
      stats.errors.push({ slug: slug || '(no slug)', error: problem })
      console.error(`[seed-templates] INVALID slug=${slug || '(none)'}: ${problem}`)
      continue
    }

    // validate() above has already guaranteed the required fields are present and
    // well-typed, so the cast to the write shape is safe here.
    const data = pickFields(raw) as TemplateWriteData

    try {
      // Idempotency: look up by slug (unique). overrideAccess so the script is not
      // blocked by the admin-only mutation access rules.
      const existing = await payload.find({
        collection: 'templates',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      const found = existing.docs?.[0]

      if (DRY) {
        console.log(`[seed-templates] DRY ${found ? 'UPDATE' : 'CREATE'} slug=${slug}`)
        found ? stats.updated++ : stats.created++
        continue
      }

      if (found) {
        // Slug is locked by beforeChange; it is unchanged here (we matched on it),
        // so the update is safe. Other fields refresh from the export.
        await payload.update({
          collection: 'templates',
          id: found.id,
          data,
          overrideAccess: true,
        })
        stats.updated++
        console.log(`[seed-templates] UPDATED slug=${slug}`)
      } else {
        await payload.create({
          collection: 'templates',
          data,
          overrideAccess: true,
        })
        stats.created++
        console.log(`[seed-templates] CREATED slug=${slug}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      stats.failed++
      stats.errors.push({ slug, error: message })
      console.error(`[seed-templates] FAILED slug=${slug}: ${message}`)
    }
  }

  console.log(
    `[seed-templates] done — created=${stats.created} updated=${stats.updated} ` +
      `skipped=${stats.skipped} failed=${stats.failed}`,
  )
  if (stats.errors.length) {
    console.error('[seed-templates] errors:')
    for (const e of stats.errors) console.error(`  - ${e.slug}: ${e.error}`)
  }

  // Non-zero exit on any failure so CI / operators notice.
  process.exit(stats.failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('[seed-templates] FATAL:', err instanceof Error ? err.message : err)
  process.exit(1)
})
