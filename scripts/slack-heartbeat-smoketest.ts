// scripts/slack-heartbeat-smoketest.ts
// Manual one-shot: triggers the slack-heartbeat tick once and exits.
// Use to verify every configured webhook delivers and its support_events row
// lands, without waiting 30s+24h for the in-app scheduler.
import { __testables } from '../src/lib/slack-heartbeat'

async function main() {
  console.log('[smoketest] running one tick…')
  await __testables.tick()
  console.log('[smoketest] tick complete — check Slack channels and support_events table')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
