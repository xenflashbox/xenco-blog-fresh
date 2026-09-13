// src/lib/slack-heartbeat.ts
// Slack DELIVERY heartbeat. This proves the webhook still delivers. It is NOT
// a site or application health check and must never be described as one — it
// says nothing about whether any service is up.
//
// Once a day, POST to every configured webhook and record the outcome in
// support_events. Built in response to the 2026-05-04 -> 2026-06-03 dark-window
// outage: had this existed, the dead webhook would have been caught the next
// day, not 30 days later.
//
// Why the growth webhook is still pinged, even though growth-alerts is meant
// for signups and payments only: GROWTH_SLACK_WEBHOOK_URL is the same webhook
// that delivers the signup and payment notifications. A heartbeat sent
// somewhere else would prove nothing about that path, and a silently dead
// growth webhook means silently missed revenue alerts — precisely the
// original outage. One [OPS] line a day is the cost of knowing it works.
//
// Monitor query (any container or operator can run):
//   SELECT MAX(created_at) FROM support_events
//   WHERE event_type='slack_heartbeat_ok' AND event_data->>'webhook'='support';
// If older than 32h, the channel is dead.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
// Uses the pg package bundled with @payloadcms/db-postgres (matches repo convention).
const { Pool } = require('pg')

type Channel = 'support' | 'growth' | 'ops'

const INTERVAL_MS = 24 * 60 * 60 * 1000 // daily
const BOOT_DELAY_MS = 30 * 1000 // 30s after boot, so startup spikes settle

const CHANNEL_LABELS: Record<Channel, string> = {
  support: 'support-alerts',
  growth: 'growth-alerts',
  ops: 'ops-alerts',
}

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
  const channelLabel = CHANNEL_LABELS[channel]
  const text =
    `[OPS] :heart_decoration: Slack delivery heartbeat — ${channelLabel} webhook ` +
    `reachable from payload-app, ${ts}. Delivery only; says nothing about service health.`

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

// Every configured webhook is pinged. `ops` is optional: set
// OPS_SLACK_WEBHOOK_URL and its delivery gets proved too, with no code change.
const WEBHOOK_ENV: Record<Channel, string> = {
  support: 'SUPPORT_SLACK_WEBHOOK_URL',
  growth: 'GROWTH_SLACK_WEBHOOK_URL',
  ops: 'OPS_SLACK_WEBHOOK_URL',
}

async function tick() {
  for (const channel of Object.keys(WEBHOOK_ENV) as Channel[]) {
    const envName = WEBHOOK_ENV[channel]
    const url = process.env[envName]
    if (url) await pingOne(channel, url)
    else console.warn(`[slack-heartbeat] ${envName} not set; skipping ${channel} tick`)
  }
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
