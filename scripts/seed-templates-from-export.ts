#!/usr/bin/env tsx
/**
 * scripts/seed-templates-from-export.ts
 *
 * One-off, idempotent seeder for the global `templates` collection. Seeds Payload
 * with the 12 live BlogCraft writing templates from the API admin's export file,
 * then verifies the webhook synced each row through to Neon. This is the first
 * end-to-end test of the Payload → api.blogcraft.app → Neon sync path (PR #3 /
 * prompts #02 + #03).
 *
 *   Usage (from repo root, on the operator host):
 *     pnpm exec tsx scripts/seed-templates-from-export.ts <path-to-export-file>
 *     pnpm exec tsx scripts/seed-templates-from-export.ts <export> --dry-run
 *     EXPECTED_COUNT=12 pnpm exec tsx scripts/seed-templates-from-export.ts <export>
 *
 * DESIGN NOTES (reconciling prompt #03 with the agreed architecture):
 *
 *   - UPSERTS use Payload's LOCAL API (getPayload), not REST. Agreed in review:
 *     Local API still fires the Templates afterChange hook (the sync path) while
 *     skipping API-key handling and a network hop. NOTE: because the hook runs IN
 *     THIS PROCESS, the webhook it fires uses THIS process's TEMPLATES_SYNC_SECRET
 *     / BLOGCRAFT_API_URL — so they must be set in the operator's environment
 *     (preflight enforces this).
 *
 *   - VERIFICATION goes through the API server's read endpoint, NOT a direct Neon
 *     connection. We deliberately do NOT take NEON_DATABASE_URL here, to keep
 *     BlogCraft's DB credentials off the Payload host. We capture a `before`
 *     timestamp, upsert, wait for webhook fan-out, then
 *     GET /internal/templates/sync/status?since=<before> (X-Sync-Secret header)
 *     and confirm every expected slug appears with a fresh synced_from_payload_at.
 *     Endpoint response shape: { ok, rows: [{ slug, synced_from_payload_at,
 *     is_active }], count }.
 *
 *   - The /sync/status endpoint is being built in parallel; the live verification
 *     run is gated on it. Everything else (parse, upsert, --dry-run) works now.
 *
 * IDEMPOTENT: upsert keyed on `slug` (unique). Re-runs UPDATE, never duplicate.
 *
 * IMPORTANT: NODE_ENV is forced to `production` so @payloadcms/db-postgres does
 * NOT run pushDevSchema (interactive schema push can drop tables).
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'

import type { Template } from '../src/payload-types'

// Fields accepted on a write: collection-owned fields, minus Payload-managed ones.
type TemplateWriteData = Omit<Template, 'id' | 'createdAt' | 'updatedAt'>

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// ── Environment bootstrap (mirrors scripts/regenerate-site-media-sizes.ts) ──────
const envLocal = path.join(root, '.env')
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal })
const prodEnv = path.join(root, '.env.production')
if (fs.existsSync(prodEnv)) dotenv.config({ path: prodEnv, override: false })

if (process.env.NODE_ENV !== 'production') {
  ;(process.env as Record<string, string>).NODE_ENV = 'production'
}

// Swarm-internal hostname does not resolve on the host OS — rewrite to PgBouncer.
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

// ── Config ──────────────────────────────────────────────────────────────────
const DRY = process.argv.includes('--dry-run')
const inputArg = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'))
const EXPECTED_COUNT = process.env.EXPECTED_COUNT ? Number(process.env.EXPECTED_COUNT) : 12
const SYNC_SECRET = process.env.TEMPLATES_SYNC_SECRET
const API_SERVER_URL = (process.env.BLOGCRAFT_API_URL || 'https://api.blogcraft.app').replace(
  /\/$/,
  '',
)
const SYNC_STATUS_URL = `${API_SERVER_URL}/internal/templates/sync/status`
const SYNC_HEALTH_URL = `${API_SERVER_URL}/internal/templates/sync/health`
const WEBHOOK_FANOUT_MS = Number(process.env.WEBHOOK_FANOUT_MS || 3000)

// Only collection-owned fields. Unknown keys (id/createdAt/updatedAt) are stripped.
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

// JSONB fields that may arrive as strings (from CSV / column-inserts) and must be parsed.
const JSON_FIELDS = ['copy_primitives', 'required_sections', 'template_json', 'payload_schema']
// Booleans that may arrive as strings ("true"/"f"/"1").
const BOOL_FIELDS = ['is_active', 'data_required']
// Numbers that may arrive as strings.
const NUM_FIELDS = ['outline_version']

type TemplateInput = Record<string, unknown> & { slug?: unknown }

interface SeedStats {
  created: number
  updated: number
  failed: number
  errors: Array<{ slug: string; error: string }>
}

function log(line: string): void {
  console.log(`[seed-templates] ${new Date().toISOString()} ${line}`)
}
function errLog(line: string): void {
  console.error(`[seed-templates] ${new Date().toISOString()} ${line}`)
}

// ── Export parsing ────────────────────────────────────────────────────────────
// Handles whatever the API admin delivers: JSON (array or {docs|templates|rows}),
// JSONL (one object per line), CSV (header row), or pg_dump --column-inserts.

function coerceTypes(t: TemplateInput): TemplateInput {
  const out: TemplateInput = { ...t }
  for (const f of JSON_FIELDS) {
    if (typeof out[f] === 'string') {
      const s = (out[f] as string).trim()
      if (s === '' || s.toLowerCase() === 'null') {
        if (f === 'payload_schema') out[f] = null
      } else {
        try {
          out[f] = JSON.parse(s)
        } catch {
          /* leave as-is; validate() will reject it with a clear message */
        }
      }
    }
  }
  for (const f of BOOL_FIELDS) {
    if (typeof out[f] === 'string') {
      const s = (out[f] as string).trim().toLowerCase()
      if (['true', 't', '1', 'yes'].includes(s)) out[f] = true
      else if (['false', 'f', '0', 'no'].includes(s)) out[f] = false
    }
  }
  for (const f of NUM_FIELDS) {
    if (typeof out[f] === 'string' && (out[f] as string).trim() !== '') {
      const n = Number(out[f])
      if (!Number.isNaN(n)) out[f] = n
    }
  }
  return out
}

function parseCsv(raw: string): TemplateInput[] {
  // Minimal RFC-4180-ish parser: handles quoted fields, escaped quotes, commas
  // and newlines inside quotes. Avoids a dependency for a one-off script.
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (inQuotes) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && raw[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    if (row.some((v) => v !== '')) rows.push(row)
  }
  if (rows.length < 2) return []
  const header = rows[0]
  return rows.slice(1).map((r) => {
    const obj: TemplateInput = {}
    header.forEach((h, idx) => {
      obj[h.trim()] = r[idx] ?? ''
    })
    return obj
  })
}

function parsePgDumpInserts(raw: string): TemplateInput[] {
  // Parse `INSERT INTO ... (col, col) VALUES (v, v);` from pg_dump --column-inserts.
  const out: TemplateInput[] = []
  const insertRe = /INSERT INTO\s+(?:[\w".]+\.)?"?\w+"?\s*\(([^)]+)\)\s*VALUES\s*\((.*?)\);/gis
  let m: RegExpExecArray | null
  while ((m = insertRe.exec(raw)) !== null) {
    const cols = m[1].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const vals = splitSqlValues(m[2])
    if (cols.length !== vals.length) continue
    const obj: TemplateInput = {}
    cols.forEach((c, i) => {
      obj[c] = vals[i]
    })
    out.push(obj)
  }
  return out
}

/** Split a SQL VALUES tuple body, respecting single-quoted strings and '' escapes. */
function splitSqlValues(body: string): unknown[] {
  const result: unknown[] = []
  let cur = ''
  let inStr = false
  let wasQuoted = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (inStr) {
      if (c === "'") {
        if (body[i + 1] === "'") {
          cur += "'"
          i++
        } else {
          inStr = false
        }
      } else {
        cur += c
      }
    } else if (c === "'") {
      inStr = true
      wasQuoted = true
    } else if (c === ',') {
      result.push(normalizeSqlScalar(cur.trim(), wasQuoted))
      cur = ''
      wasQuoted = false
    } else {
      cur += c
    }
  }
  result.push(normalizeSqlScalar(cur.trim(), wasQuoted))
  return result
}

function normalizeSqlScalar(token: string, wasQuoted: boolean): unknown {
  // A bare (unquoted) NULL or empty token is SQL NULL. Quoted content is a string,
  // even if its text happens to be "NULL". coerceTypes() handles JSON/bool/number
  // coercion downstream.
  if (!wasQuoted && (token === 'NULL' || token === '')) return null
  return token
}

function loadTemplates(file: string): TemplateInput[] {
  const abs = path.isAbsolute(file) ? file : path.join(root, file)
  if (!fs.existsSync(abs)) throw new Error(`Input file not found: ${abs}`)
  const raw = fs.readFileSync(abs, 'utf-8')
  const ext = path.extname(abs).toLowerCase()
  const trimmed = raw.trimStart()

  let list: TemplateInput[]

  // JSONL detection must come BEFORE the generic JSON branch: a .jsonl file's
  // first line is `{...}`, which would otherwise route to JSON.parse(whole file)
  // and fail. Trigger on the .jsonl/.ndjson extension, or on a file that has
  // multiple lines each starting with `{` and is not a single JSON document.
  const looksLikeJsonl =
    ext === '.jsonl' ||
    ext === '.ndjson' ||
    (!trimmed.startsWith('[') &&
      raw.split('\n').filter((l) => l.trim()).length > 1 &&
      raw
        .split('\n')
        .filter((l) => l.trim())
        .every((l) => l.trim().startsWith('{')))

  if (ext === '.csv') {
    list = parseCsv(raw)
  } else if (ext === '.sql' || /INSERT INTO/i.test(trimmed.slice(0, 200))) {
    list = parsePgDumpInserts(raw)
  } else if (looksLikeJsonl) {
    list = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => JSON.parse(l) as TemplateInput)
  } else if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed: unknown = JSON.parse(raw)
    const arr: unknown = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object'
        ? ((parsed as Record<string, unknown>).docs ??
          (parsed as Record<string, unknown>).templates ??
          (parsed as Record<string, unknown>).rows)
        : undefined
    if (!Array.isArray(arr)) {
      throw new Error(
        'JSON input must be an array, or an object with a `docs`/`templates`/`rows` array.',
      )
    }
    list = arr as TemplateInput[]
  } else {
    throw new Error(
      `Unrecognized export format for ${path.basename(abs)}. Supported: .json (array or ` +
        `{docs|templates|rows}), .jsonl/.ndjson, .csv, .sql (pg_dump --column-inserts).`,
    )
  }

  return list.map(coerceTypes)
}

function pickFields(t: TemplateInput): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of TEMPLATE_FIELDS) {
    if (t[key] !== undefined) out[key] = t[key]
  }
  return out
}

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

// ── Preflight ─────────────────────────────────────────────────────────────────
async function preflight(): Promise<void> {
  // Smoke check the operator provisioned the secret. Local-API upserts fire the
  // afterChange webhook IN THIS PROCESS, so without it nothing reaches the API
  // server / Neon — and verification would fail anyway.
  if (!SYNC_SECRET) {
    throw new Error(
      'TEMPLATES_SYNC_SECRET not set. Local-API upserts fire the afterChange webhook in this ' +
        'process; without the secret nothing syncs to api.blogcraft.app / Neon and verification ' +
        'cannot pass. Provision it before running.',
    )
  }

  // API server + sync endpoint + Neon reachability.
  let res: Response
  try {
    res = await fetch(SYNC_HEALTH_URL, { headers: { 'X-Sync-Secret': SYNC_SECRET } })
  } catch (err) {
    throw new Error(
      `API server health unreachable at ${SYNC_HEALTH_URL}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }
  if (!res.ok) throw new Error(`API server health returned ${res.status} at ${SYNC_HEALTH_URL}`)
  const health = (await res.json().catch(() => ({}))) as { neon_reachable?: boolean }
  if (health.neon_reachable === false) {
    throw new Error('API server reports Neon unreachable — aborting before writes.')
  }
  log(`preflight OK api_server=up neon_reachable=${health.neon_reachable ?? 'unknown'}`)
}

// ── Verification via API server /sync/status ───────────────────────────────────
interface SyncStatusRow {
  slug: string
  synced_from_payload_at: string | null
  is_active?: boolean
}
interface SyncStatusResponse {
  ok: boolean
  rows: SyncStatusRow[]
  count: number
}

async function fetchSyncStatus(sinceIso: string): Promise<SyncStatusResponse> {
  const url = `${SYNC_STATUS_URL}?since=${encodeURIComponent(sinceIso)}`
  const res = await fetch(url, { headers: { 'X-Sync-Secret': SYNC_SECRET as string } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`/sync/status returned ${res.status} body=${body}`)
  }
  return (await res.json()) as SyncStatusResponse
}

// ── Upsert (Local API, retry once) ─────────────────────────────────────────────
type PayloadInstance = Awaited<ReturnType<(typeof import('payload'))['getPayload']>>

interface UpsertResult {
  ok: boolean
  operation: 'created' | 'updated'
  error: string
}

/** Upsert one template by slug, retrying once after 2s on any error. */
async function upsertWithRetry(
  payload: PayloadInstance,
  slug: string,
  data: TemplateWriteData,
): Promise<UpsertResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const existing = await payload.find({
        collection: 'templates',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const found = existing.docs?.[0]
      if (found) {
        await payload.update({
          collection: 'templates',
          id: found.id,
          data,
          overrideAccess: true,
        })
        return { ok: true, operation: 'updated', error: '' }
      }
      await payload.create({ collection: 'templates', data, overrideAccess: true })
      return { ok: true, operation: 'created', error: '' }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (attempt === 1) {
        errLog(`slug=${slug} attempt 1 failed, retrying in 2s: ${message}`)
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      return { ok: false, operation: 'created', error: message }
    }
  }
  return { ok: false, operation: 'created', error: 'unreachable' }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  if (!inputArg) {
    throw new Error(
      'Usage: pnpm exec tsx scripts/seed-templates-from-export.ts <input-file> [--dry-run]',
    )
  }

  const templates = loadTemplates(inputArg)
  log(
    `loaded ${templates.length} template(s) from ${inputArg}` + (DRY ? ' (DRY RUN — no writes)' : ''),
  )

  if (templates.length !== EXPECTED_COUNT) {
    throw new Error(
      `expected ${EXPECTED_COUNT} templates, found ${templates.length}. ` +
        `Set EXPECTED_COUNT to override if the export legitimately changed.`,
    )
  }

  if (!DRY) await preflight()

  // Capture the verification window start BEFORE any writes.
  const before = new Date().toISOString()

  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config })

  const stats: SeedStats = { created: 0, updated: 0, failed: 0, errors: [] }
  const expectedSlugs: string[] = []

  for (const raw of templates) {
    const slug = String(raw.slug ?? '').trim()
    const problem = validate(raw)
    if (problem) {
      stats.failed++
      stats.errors.push({ slug: slug || '(no slug)', error: problem })
      errLog(`slug=${slug || '(none)'} INVALID error="${problem}"`)
      continue
    }
    expectedSlugs.push(slug)
    const data = pickFields(raw) as TemplateWriteData

    if (DRY) {
      const existing = await payload.find({
        collection: 'templates',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const op = existing.docs?.[0] ? 'updated' : 'created'
      log(`slug=${slug} operation=${op} payload_status=DRY sync_to_neon=skipped`)
      op === 'updated' ? stats.updated++ : stats.created++
      continue
    }

    const result = await upsertWithRetry(payload, slug, data)
    if (result.ok) {
      result.operation === 'updated' ? stats.updated++ : stats.created++
      log(`slug=${slug} operation=${result.operation} payload_status=ok sync_to_neon=pending`)
    } else {
      stats.failed++
      stats.errors.push({ slug, error: result.error })
      errLog(`slug=${slug} FAILED error="${result.error}"`)
    }
  }

  // ── Verification ─────────────────────────────────────────────────────────────
  let neonVerified = false
  let neonSyncedCount = 0
  if (!DRY && stats.failed === 0) {
    log(`waiting ${WEBHOOK_FANOUT_MS}ms for webhook fan-out before verifying...`)
    await new Promise((r) => setTimeout(r, WEBHOOK_FANOUT_MS))
    try {
      const status = await fetchSyncStatus(before)
      const syncedFresh = new Set(
        status.rows.filter((r) => r.synced_from_payload_at).map((r) => r.slug),
      )
      const missing = expectedSlugs.filter((s) => !syncedFresh.has(s))
      neonSyncedCount = expectedSlugs.filter((s) => syncedFresh.has(s)).length
      for (const r of status.rows.filter((row) => expectedSlugs.includes(row.slug))) {
        log(`slug=${r.slug} neon_synced_at=${r.synced_from_payload_at}`)
      }
      neonVerified = missing.length === 0
      if (!neonVerified) {
        errLog(`Neon verification incomplete — missing slugs: ${missing.join(', ')}`)
      }
    } catch (err) {
      errLog(
        `Neon verification could not run: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const succeeded = stats.created + stats.updated
  console.log(
    `\n[seed-templates] complete: ${succeeded} succeeded, ${stats.failed} failed ` +
      `(created=${stats.created} updated=${stats.updated})`,
  )
  if (stats.errors.length) {
    console.log(`[seed-templates] failed slugs: ${stats.errors.map((e) => e.slug).join(', ')}`)
  }

  if (DRY) {
    log('dry run — skipped preflight, upserts, and Neon verification')
    process.exit(stats.failed > 0 ? 1 : 0)
  }

  console.log(
    `[seed-templates] verified in Neon with recent synced_from_payload_at: ` +
      `${neonSyncedCount}/${expectedSlugs.length}`,
  )
  if (stats.failed === 0 && neonVerified) {
    console.log('[seed-templates] end-to-end webhook sync confirmed working')
    process.exit(0)
  }
  console.log('[seed-templates] verification incomplete — review failures above')
  process.exit(1)
}

main().catch((err) => {
  errLog(`FATAL: ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
})
