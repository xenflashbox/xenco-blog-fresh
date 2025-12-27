# Support Ops Runbook

> Internal documentation for the Smart Ticket support system.
> Last updated: 2025-12-25

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Alert Criteria](#alert-criteria)
3. [Triage Categories](#triage-categories)
4. [Details Schema](#details-schema)
5. [Smoke Tests](#smoke-tests)
6. [Slack Webhook Rotation](#slack-webhook-rotation)
7. [Troubleshooting](#troubleshooting)

---

## System Overview

The Support Core system provides two endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/support/ticket` | Smart Ticket creation with answer-first triage |
| `POST /api/support/answer` | Query KB docs without creating a ticket |

**Smart Ticket Flow:**
1. User submits a support request
2. System detects message signals (system failure, bug, feature request)
3. If no signals detected → try KB answer-first (no ticket created)
4. If KB match found → return `resolved: true` with answer
5. If no KB match OR signal detected → create ticket with triage metadata
6. If alert criteria met → send Slack notification

---

## Alert Criteria

Slack alerts are sent when **both** conditions are met:

```
triage.action === "create_ticket"
AND
(triage.category === "system_failure" OR severity === "high" OR severity === "critical")
```

### What triggers alerts:

| Scenario | Alerts? |
|----------|---------|
| 500/502/503/504 error message | Yes |
| "timeout", "failed to fetch", "network error" | Yes |
| "stuck", "spinning", "frozen" (no KB match) | Yes |
| Any ticket with `severity: "high"` | Yes |
| Any ticket with `severity: "critical"` | Yes |
| `valid_bug` with `severity: "medium"` | No |
| `feature_request` | No |
| Answer-first resolved (`resolved: true`) | No (no ticket created) |

---

## Triage Categories

| Category | Description | Typical Signals |
|----------|-------------|-----------------|
| `user_error` | User needs help, not a bug | Generic questions, no KB match |
| `valid_bug` | Real bug report | "error", "broken", "crash", "doesn't work" |
| `system_failure` | Infrastructure/system issue | HTTP codes (500/502/503/504), timeout, network error, stuck/spinning |
| `feature_request` | Enhancement request | "please add", "feature request", "suggestion" |
| `false_bug` | Reserved for future use | (Not currently assigned) |

### Signal Priority

1. **Hard system signals** (always `system_failure`):
   - 500, 502, 503, 504, 404
   - timeout, failed to fetch, network error, connection refused

2. **Bug signals** (becomes `valid_bug`):
   - error, broken, crash, failed, doesn't work, glitch

3. **Soft system signals** (becomes `system_failure` if no KB match):
   - stuck, spinning, hang, frozen, blank page, white screen

4. **Feature signals** (becomes `feature_request`):
   - feature request, please add, suggestion, enhancement

---

## Details Schema

The `details` JSONB column stores structured metadata:

```jsonc
{
  // User-provided context (persisted in details)
  "route": "/dashboard",           // Persisted as details.route
  "conversation_history": [...],   // Optional: prior chat messages

  // System-generated triage
  "triage": {
    "category": "system_failure",  // Triage category
    "action": "create_ticket",     // "answer_now" | "create_ticket"
    "reason": "system_signal",     // Why this action was taken
    "route": "/dashboard",         // Echoed from input
    "page_url": "https://...",     // Echoed from triage context
    "severity": "high",            // Ticket severity
    "forced": false,               // Was force_ticket used?
    "confidence": 0.7              // Triage confidence score
  },

  // Alert tracking (for idempotency)
  "alerted_at": "2025-12-25T21:54:58.527Z"  // Set after Slack alert sent
}
```

**Note on `page_url`:**
- `page_url` is a **separate DB column** on the `support_tickets` table
- It may optionally be mirrored in `details.triage.page_url` for triage context
- When querying, prefer the DB column; use `details.triage.page_url` for audit trails

**Note on `route`:**
- `route` is persisted as `details.route` (top-level in details JSONB)
- Also echoed in `details.triage.route` for triage context

### Triage Reasons

| Reason | Meaning |
|--------|---------|
| `kb_hit` | KB article matched, answer returned immediately |
| `system_signal` | Hard or soft system failure signal detected |
| `bug_signal` | Bug-related keywords detected |
| `feature_signal` | Feature request keywords detected |
| `forced` | `force_ticket: true` was set |
| `no_kb_match` | No signals, no KB match, created ticket anyway |

---

## Smoke Tests

Run these after any deployment to verify the system works.

> **Note:** The API returns different response envelopes for answer-first (`resolved: true` with `.triage.*`)
> vs ticket creation (`.ticket.triage.*`). The jq selectors below handle both cases.

### Test 1: Answer-First (KB Hit)

```bash
curl -s -X POST "https://cms.resumecoach.me/api/support/ticket" \
  -H "Content-Type: application/json" \
  -d '{"app_slug":"resume-coach","message":"How do I fix the support widget?"}' \
| jq '{
  resolved,
  answer: (.answer // "")[0:80],
  action: (.triage.action // .ticket.triage.action),
  reason: (.triage.reason // .ticket.triage.reason)
}'
```

**Expected output:**
```json
{
  "resolved": true,
  "answer": "The ResumeCoach Support Widget must be able to create support tickets from **pub",
  "action": "answer_now",
  "reason": "kb_hit"
}
```

### Test 2: Forced Ticket (Bypass Answer-First)

```bash
curl -s -X POST "https://cms.resumecoach.me/api/support/ticket" \
  -H "Content-Type: application/json" \
  -d '{"app_slug":"resume-coach","message":"How do I fix the support widget?","force_ticket":true}' \
| jq '{
  ticket_id: .ticket.id,
  action: (.triage.action // .ticket.triage.action),
  reason: (.triage.reason // .ticket.triage.reason),
  forced: (.triage.forced // .ticket.triage.forced)
}'
```

**Expected output:**
```json
{
  "ticket_id": "XX",
  "action": "create_ticket",
  "reason": "forced",
  "forced": true
}
```

### Test 3: System Failure (Triggers Slack)

```bash
curl -s -X POST "https://cms.resumecoach.me/api/support/ticket" \
  -H "Content-Type: application/json" \
  -d '{"app_slug":"resume-coach","message":"Getting 500 error on checkout","severity":"high"}' \
| jq '{
  ticket_id: .ticket.id,
  category: (.triage.category // .ticket.triage.category),
  reason: (.triage.reason // .ticket.triage.reason),
  slack_alerted: (.slack_alerted // .ticket.slack_alerted // false)
}'
```

**Expected output:**
```json
{
  "ticket_id": "XX",
  "category": "system_failure",
  "reason": "system_signal",
  "slack_alerted": true
}
```

---

## Slack Webhook Rotation

### Where the webhook lives

| Location | Purpose |
|----------|---------|
| Vercel Environment Variables | Production (`SUPPORT_SLACK_WEBHOOK_URL`) |
| `.env` (local) | Development reference only |

### Rotation procedure

1. **Create new webhook** in Slack App settings:
   - Go to: https://api.slack.com/apps → Your App → Incoming Webhooks
   - Click "Add New Webhook to Workspace"
   - Select the target channel
   - Copy the new webhook URL

2. **Update Vercel env var**:
   ```bash
   # Via Vercel CLI
   vercel env rm SUPPORT_SLACK_WEBHOOK_URL production
   vercel env add SUPPORT_SLACK_WEBHOOK_URL production
   # Paste the new URL when prompted
   ```

   Or update via Vercel Dashboard → Project → Settings → Environment Variables

3. **Trigger redeploy**:
   ```bash
   vercel --prod
   ```
   Or push any commit to trigger automatic deploy.

4. **Verify new webhook works**:
   ```bash
   curl -s -X POST "https://cms.resumecoach.me/api/support/ticket" \
     -H "Content-Type: application/json" \
     -d '{"app_slug":"resume-coach","message":"Webhook rotation test: 500 error","severity":"critical"}' \
   | jq '.ticket.slack_alerted'
   ```
   Should return `true` and message appears in Slack.

5. **Revoke old webhook** in Slack App settings.

### Security rules

- **NEVER** paste webhook URLs in chat, logs, or commit messages
- **NEVER** hardcode webhook URLs in source code
- **ALWAYS** use environment variables
- Rotate immediately if webhook is exposed
- Webhooks are channel-specific; rotating doesn't affect other integrations

---

## Troubleshooting

### Slack alerts not sending

1. Check `SUPPORT_SLACK_WEBHOOK_URL` is set in Vercel:
   ```bash
   vercel env ls
   ```

2. Check response includes `slack_alerted: true`:
   - If missing, webhook URL not configured or alert criteria not met
   - If `false`, webhook call failed (check Vercel function logs)

3. Verify alert criteria:
   - Must be `system_failure` OR `severity: high/critical`
   - Answer-first resolutions (`resolved: true`) never alert

### Duplicate alerts

Idempotency is handled via `details.alerted_at`:
- After first alert, `alerted_at` timestamp is written to DB
- Subsequent requests with same ticket won't re-alert

If seeing duplicates:
- Check if `alerted_at` is being persisted (query DB)
- Check if requests are coming from different sources

### KB not matching expected queries

1. Run `/api/admin/meilisearch-support/status` to check index health
2. Run `/api/admin/meilisearch-support/resync` to reindex
3. Check document has `_status: "published"` and correct `appSlug`

### Tickets created when KB should answer

The answer-first path is skipped if:
- `force_ticket: true` is set
- Message contains bug signals (error, broken, crash)
- Message contains system signals (500, timeout, stuck)
- Message contains feature signals (please add, suggestion)

This is intentional: we want bug reports to create tickets even if KB has related content.

---

## API Quick Reference

### Create Ticket / Answer-First

```bash
POST /api/support/ticket
Content-Type: application/json

{
  "app_slug": "resume-coach",      # Required
  "message": "User's question",     # Required
  "severity": "medium",             # Optional: low/medium/high/critical
  "route": "/dashboard",            # Optional
  "page_url": "https://...",        # Optional
  "user_id": "user_123",            # Optional
  "user_agent": "Mozilla/...",      # Optional
  "force_ticket": true,             # Optional: bypass answer-first
  "details": {                      # Optional: additional context
    "conversation_history": [...]
  }
}
```

### Query KB Only

```bash
POST /api/support/answer
Content-Type: application/json

{
  "app_slug": "resume-coach",
  "message": "User's question",
  "route": "/dashboard"             # Optional: for route-aware ranking
}
```

### Admin: Index Status

```bash
GET /api/admin/meilisearch-support/status
Authorization: users API-Key YOUR_API_KEY
```

### Admin: Resync Index

```bash
POST /api/admin/meilisearch-support/resync
Authorization: users API-Key YOUR_API_KEY
Content-Type: application/json

{"appSlug": "resume-coach"}  # Optional: filter by app
```

### Health Check

```bash
GET /api/support/health
Authorization: Bearer YOUR_HEALTH_TOKEN  # Optional: if SUPPORT_HEALTH_TOKEN is set
```

**Response (200 OK):**
```json
{
  "ok": true,
  "status": "ok",
  "checks": {
    "db": { "ok": true, "error": null },
    "meili": { "ok": true, "error": null, "index": "support" }
  },
  "duration_ms": 423,
  "ts": "2025-12-26T17:19:15.010Z"
}
```

**Response (503 Degraded):**
```json
{
  "ok": false,
  "status": "degraded",
  "checks": {
    "db": { "ok": true, "error": null },
    "meili": { "ok": false, "error": "MeiliSearch not configured" }
  }
}
```

**Securing the endpoint:**
- Set `SUPPORT_HEALTH_TOKEN` in Vercel env vars
- Requests must include `Authorization: Bearer <token>`
- If token not set, endpoint is public (for uptime monitors)

---

## KB Import & QA Operations

### Import KB Articles

Idempotent upsert: creates new articles or updates existing ones by title+appSlug.

```bash
# Set credentials
export PAYLOAD_ADMIN_EMAIL=your-admin@email.com
export PAYLOAD_ADMIN_PASSWORD=your-password

# Import both KB packs
pnpm run support:kb:import

# Or import specific files
npx tsx scripts/import-support-kb.ts data/my-articles.json
```

**Output:** `Created: X, Updated: Y, Skipped: Z, Failed: N`

### Resync MeiliSearch After Import

```bash
curl -X POST "https://cms.resumecoach.me/api/admin/meilisearch-support/resync" \
  -H "Authorization: Bearer $SUPPORT_ADMIN_TOKEN"
```

### Run QA Test Suite

```bash
# Verify test suite structure first
pnpm run support:kb:verify

# Run QA tests against /api/support/ticket
pnpm run support:kb:qa
```

**Output:** `support-kb-qa.report.json` with test results and failures.

### npm Scripts Reference

| Script | Command |
|--------|---------|
| `support:kb:import` | Import Phase 1+2 KB articles |
| `support:kb:qa` | Run QA suite (exit code 1 on failures) |
| `support:kb:verify` | Validate QA suite JSON structure |

---

## Widget Intelligence (v1.2)

### Route Fallback

If `route` is not explicitly provided, the system attempts to extract it from:
1. `page_url` parameter (extracts pathname)
2. `Referer` header (extracts pathname)

This ensures route-aware ranking works even if the frontend forgets to send `route`.

### Conversation Context

Context extraction uses **USER messages only**:
- Only includes messages with `role: "user"`
- Never includes assistant messages (prevents drift)
- Combines short messages with previous context for better matching

**Example:** If user says "I can't find the button" after asking about uploads, the system combines both user messages for context search.
