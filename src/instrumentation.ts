// src/instrumentation.ts
// Next.js instrumentation hook — runs once per Node.js process at server boot.
// We use it to start the Slack heartbeat cron. Edge runtime is skipped because
// it has no fetch+pg+setInterval guarantees and we don't run admin/API on edge.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startHeartbeat } = await import('./lib/slack-heartbeat')
    startHeartbeat()
  }
}
