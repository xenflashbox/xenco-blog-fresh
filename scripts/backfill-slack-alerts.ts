// scripts/backfill-slack-alerts.ts
// One-shot backfill of missed Slack alerts during the 2026-05-04 -> 2026-06-03 dark window.
// Idempotent via details->>'alerted_at' guard. Prefixes every message as historical.
//
// Run procedure (per deploy discipline):
//   1. set -a; source .env.production; set +a
//   2. npx tsx scripts/backfill-slack-alerts.ts
//   3. expect ~13 messages over ~5s, all prefixed BACKFILL.
//   4. verify post-run COUNT=0 (see SQL in docs/rc-payload-admin-handoff-2026-06-03.md).
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// Uses the pg package bundled with @payloadcms/db-postgres (matches repo convention).
const { Pool } = require('/home/xen/docker/apps/payload-swarm/node_modules/.pnpm/pg@8.16.3/node_modules/pg')

if (!process.env.DATABASE_URI) {
  console.error('Missing DATABASE_URI in env')
  process.exit(1)
}
if (!process.env.SUPPORT_SLACK_WEBHOOK_URL) {
  console.error('Missing SUPPORT_SLACK_WEBHOOK_URL in env')
  process.exit(1)
}
const DATABASE_URI: string = process.env.DATABASE_URI
const WEBHOOK: string = process.env.SUPPORT_SLACK_WEBHOOK_URL
const CUTOFF = '2026-05-04 15:02:26+00' // last successful pre-rotation alert

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URI })
  const { rows } = await pool.query(
    `SELECT id, created_at, severity, message, page_url, route,
            details->'triage'->>'category' AS category,
            details->'triage'->>'reason' AS reason,
            details->'triage'->>'forced' AS forced
     FROM support_tickets
     WHERE app_slug = 'resume-coach'
       AND created_at >= $1
       AND details->>'alerted_at' IS NULL
       AND (severity IN ('high','critical') OR details->'triage'->>'category' = 'system_failure')
     ORDER BY created_at ASC`,
    [CUTOFF],
  )
  console.log(`Backfilling ${rows.length} tickets…`)

  let ok = 0
  let fail = 0
  for (const t of rows) {
    const text =
      `:scroll: *BACKFILL — historical alert* ` +
      `(created ${new Date(t.created_at).toISOString().slice(0, 10)}, severity=${t.severity})\n` +
      `Ticket #${t.id} • category=${t.category ?? 'n/a'} • reason=${t.reason ?? 'n/a'}\n` +
      `${t.message ? t.message.slice(0, 300) : ''}` +
      (t.page_url ? `\n_page:_ ${t.page_url}` : '')

    const r = await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (r.ok) {
      await pool.query(
        `UPDATE support_tickets
         SET details = details || jsonb_build_object('alerted_at', NOW()::text, 'backfilled', true)
         WHERE id = $1`,
        [t.id],
      )
      ok++
      console.log(`  #${t.id}: alerted, marked backfilled`)
    } else {
      fail++
      console.error(`  #${t.id}: Slack returned ${r.status} ${await r.text()}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 250)) // gentle rate-limit
  }
  console.log(`Done. ok=${ok}, fail=${fail}, total=${rows.length}`)
  await pool.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
