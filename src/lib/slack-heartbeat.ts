// src/lib/slack-heartbeat.ts
// Slack alert-channel health check. Every 6h, POST a heartbeat to both
// SUPPORT_SLACK_WEBHOOK_URL and GROWTH_SLACK_WEBHOOK_URL, then record the
// outcome in support_events. Built in response to the 2026-05-04 -> 2026-06-03
// dark-window outage: had this existed, the dead webhook would have been
// caught the next day, not 30 days later.
//
// Monitor query (any container or operator can run):
//   SELECT MAX(created_at) FROM support_events
//   WHERE event_type='slack_heartbeat_ok' AND event_data->>'webhook'='support';
// If older than 8h, the channel is dead.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// Uses the pg package bundled with @payloadcms/db-postgres (matches repo convention).
const { Pool } = require('pg')

type Channel = 'support' | 'growth'

const INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours
const BOOT_DELAY_MS = 30 * 1000 // 30s after boot, so startup spikes settle

let started = false
let pool: any = null

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URI
    if (!connectionString) {
      throw new Error('DATABASE_URI missing — cannot record heartbeat')
    }
    pool = new Pool({ connectionString, max: 2, idleTimeoutMillis: 10_000 })
  }
  return pool
}

async function recordEvent(
  channel: Channel,
  ok: boolean,
  extra: Record<string, unknown> = {},
) {
  const eventType = ok ? 'slack_heartbeat_ok' : 'slack_heartbeat_fail'
  try {
    await getPool().query(
      `INSERT INTO support_events (app_slug, event_type, event_data)
       VALUES ($1, $2, $3)`,
      [
        'payload-swarm',
        eventType,
        JSON.stringify({ webhook: channel, ts: new Date().toISOString(), ...extra }),
      ],
    )
  } catch (err) {
    // Best-effort: DB write failures don't kill the heartbeat loop.
    console.error(`[slack-heartbeat] failed to record ${eventType} for ${channel}:`, err)
  }
}

async function pingOne(channel: Channel, webhookUrl: string) {
  const ts = new Date().toISOString()
  const channelLabel =
    channel === 'support' ? 'support-alerts' : 'growth-alerts'
  const text =
    `:heart_decoration: Slack alert health check — channel ${channelLabel}, ` +
    `payload-swarm OK, ${ts}. If you see this, alerting works.`

  try {
    const r = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (r.ok) {
      await recordEvent(channel, true)
    } else {
      const body = await r.text().catch(() => '')
      console.error(
        `[slack-heartbeat] ${channel} webhook returned ${r.status}: ${body.slice(0, 200)}`,
      )
      await recordEvent(channel, false, { status: r.status, body: body.slice(0, 200) })
    }
  } catch (err) {
    console.error(`[slack-heartbeat] ${channel} webhook threw:`, err)
    await recordEvent(channel, false, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function tick() {
  const support = process.env.SUPPORT_SLACK_WEBHOOK_URL
  const growth = process.env.GROWTH_SLACK_WEBHOOK_URL
  if (support) await pingOne('support', support)
  else console.warn('[slack-heartbeat] SUPPORT_SLACK_WEBHOOK_URL not set; skipping support tick')
  if (growth) await pingOne('growth', growth)
  else console.warn('[slack-heartbeat] GROWTH_SLACK_WEBHOOK_URL not set; skipping growth tick')
}

export function startHeartbeat() {
  if (started) return
  started = true
  setTimeout(() => {
    void tick()
    setInterval(() => void tick(), INTERVAL_MS)
  }, BOOT_DELAY_MS)
  console.log(
    `[slack-heartbeat] scheduled — first tick in ${BOOT_DELAY_MS / 1000}s, then every ${INTERVAL_MS / 1000 / 60 / 60}h`,
  )
}

// Exposed for manual smoke tests (e.g. `npx tsx scripts/slack-heartbeat-smoketest.ts`).
export const __testables = { tick, pingOne }
