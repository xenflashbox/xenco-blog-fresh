# Internal Linker Plugin Plan (Unified Iteration 4)

## Objective

Build a safe, idempotent backend internal-linking system for multi-site Payload blogs that:

- Adds in-body internal links when valid anchor text exists.
- Falls back to a deterministic `Related reading` block when anchors do not exist.
- Runs on demand and daily.
- Never cross-links across sites.
- Never duplicates links across repeated runs.

This document is the unified plan after architecture review + 3 DM-mini planning iterations.

---

## Current As-Built Constraints (Payload Service)

- Single Payload service with Postgres adapter and custom endpoints.
- `articles` collection includes:
  - `content` as Lexical rich text JSON.
  - `site` relationship to `sites`.
  - `title`, `focusKeyword`, `tags`, `categories`.
- Existing internal endpoints use `x-api-key` auth pattern.
- Read auto-scoping by host exists for user requests, but background jobs using `overrideAccess: true` must always add explicit site filters.

---

## Iteration Outcomes (1-3) and Decisions

### What we keep

- In-repo module first (not standalone plugin package yet).
- Three collections: `internal_link_rules`, `internal_link_edges`, `internal_link_runs`.
- Endpoint-triggered runner with `dry_run` and `apply`.
- Deterministic Lexical AST transforms only.

### What we reject

- Generic advice that ignores Payload/Lexical specifics.
- V1 over-engineering (advanced analytics, recommendation engine, complex UI workflows).
- Running unsafely without lock control.

---

## Final Architecture (100% Agreed Plan)

## 1) Data Model (Payload Collections)

### `internal_link_rules`

Purpose: curated and generated rule definitions per site.

Fields:
- `site` (relationship -> `sites`, required, indexed)
- `targetArticle` (relationship -> `articles`, required, indexed)
- `keywords` (array of `{ keyword: text }`, required, min 1)
- `priority` (number, default `100`)
- `maxLinksPerSource` (number, default `1`, min `1`, max `5`)
- `caseSensitive` (checkbox, default `false`)
- `partialMatch` (checkbox, default `false`)
- `enabled` (checkbox, default `true`)
- `source` (select: `manual | generated`, default `manual`)
- `notes` (textarea, optional)

Recommended uniqueness constraint (app-level validation):
- `(site, targetArticle)` should be unique when `enabled=true`.

### `internal_link_edges`

Purpose: immutable-ish audit/idempotency record of inserted links.

Fields:
- `site` (relationship -> `sites`, required, indexed)
- `sourceArticle` (relationship -> `articles`, required, indexed)
- `targetArticle` (relationship -> `articles`, required, indexed)
- `keywordUsed` (text, optional)
- `anchorText` (text, optional)
- `contextHash` (text, required, indexed) // stable hash of local text window + strategyVersion
- `placement` (select: `in_body | related_reading`, required)
- `runId` (relationship -> `internal_link_runs`, required, indexed)
- `createdAt` (auto)

Recommended uniqueness constraints:
- unique `(site, sourceArticle, targetArticle, placement, contextHash)`
- plus guard query on `(site, sourceArticle, targetArticle, placement)` to avoid duplicates in same strategy window.

### `internal_link_runs`

Purpose: execution tracking, locking, resumability, and stats.

Fields:
- `site` (relationship -> `sites`, optional for `all sites`)
- `mode` (select: `dry_run | apply`, required)
- `status` (select: `queued | running | succeeded | failed | partial`, required)
- `strategyVersion` (text, required, e.g. `v1`)
- `trigger` (select: `manual | scheduled | endpoint`)
- `startedAt` (date)
- `endedAt` (date)
- `cursor` (json, optional) // e.g. `{ siteId, page, lastArticleId }`
- `stats` (json, required):
  - `scanned`
  - `updated`
  - `linksInserted`
  - `fallbackInserted`
  - `skippedAlreadyLinked`
  - `skippedNoMatch`
  - `skippedLocked`
- `errors` (array of `{ articleId, message }`)
- `lockKey` (text, indexed) // `internal-linker:<site|all>`

Lock rule:
- only one `running` run per `lockKey`.

---

## 2) Insertion Algorithm (Deterministic + Lexical-Safe)

For each site in scope:

1. Acquire lock (`lockKey`) or skip/fail fast.
2. Load candidate source articles in batches (default `20`), published only.
3. For each source article:
   - Resolve target candidates:
     - Manual rules first (`enabled=true`, same `site`).
     - If none: generate temporary candidates from `focusKeyword`, title tokens, tags; write as suggestions in `dry_run`; in `apply`, optionally persist as `source=generated` only if feature flag is enabled.
   - Filter out self-links and already-linked targets using `internal_link_edges`.
   - Lexical AST walk constraints:
     - Only paragraph/list text nodes.
     - Skip headings, existing link nodes, and `Sources/References/Related reading` block subtree.
     - Respect per-paragraph and per-target limits.
     - Word-boundary unless `partialMatch=true`.
   - Insert first eligible anchor per rule (deterministic order: priority desc, target publishedAt desc, keyword length desc).
   - If no in-body insertion happened, upsert deterministic `Related reading` section:
     - Managed block marker in Lexical node metadata (or stable heading text + signature comment field).
     - Replace existing managed block, never append duplicates.
   - Compute `contextHash` and write `internal_link_edges` (apply only).
4. Persist run cursor and stats after each batch.
5. Release lock, finalize run status.

---

## 3) API Contract

### Run endpoint

`POST /api/internal-links/run?mode=dry_run|apply&site=all|<id>&limit=20`

Auth:
- `x-api-key` header (new env var: `INTERNAL_LINKER_API_KEY`).

Response:
- `202` for accepted queued/running
- `200` for synchronous completion (if small run mode)
- `409` if lock exists for scope
- `401` unauthorized

Response body:
- `ok`
- `runId`
- `status`
- `site`
- `mode`
- `stats` (partial or final)
- `message`

### Run status endpoint

`GET /api/internal-links/runs/:id`

Auth:
- `x-api-key`

Response:
- run metadata, stats, errors, cursor.

---

## 4) Scheduling Decision

Recommended for v1: **external cron hits authenticated endpoint**.

Why:
- Avoid duplicate schedulers when service scales or restarts.
- Keeps operational control in one place (Swarm/infra scheduler).
- Easier to disable/rollback quickly.

Fallback:
- In-process `node-cron` can be added later behind `ENABLE_INTERNAL_LINKER_CRON=true` only when single-replica execution guarantees exist.

---

## 5) Deployment Plan (Phased)

### Phase 0 - Safety Skeleton
- Add collections + migrations.
- Add run lock implementation and run/status endpoints.
- Implement `dry_run` suggestion engine and stats only (no article writes).
- Validate on one site.

### Phase 1 - Apply Engine
- Add Lexical AST insert logic + fallback block upsert.
- Write `internal_link_edges` on successful inserts.
- Ensure idempotency with repeated same-day reruns.

### Phase 2 - Admin UX + Operations
- Admin list views for rules/runs/edges.
- Run now control (dry/apply), recent run summaries.
- Optional generated-rule persistence controls.

---

## 6) Gaps / Required Decisions Before Coding

1. Should v1 process only `published` articles? (recommended: yes)
2. Do we ever modify existing manual editor-inserted links? (recommended: no)
3. Final per-article caps:
   - max links per article default: `3`?
   - max per paragraph: `1`?
4. Canonical fallback heading text:
   - `Related reading` fixed globally or per site?
5. Should generated rules persist by default or remain dry-run suggestions?
6. Should `apply` require a prior successful `dry_run` for same site within 24h?

---

## 7) Pushback (Intentional)

- Do **not** start with standalone plugin package extraction.
- Do **not** implement advanced scoring/ranking models in v1.
- Do **not** run blind daily apply on all sites without lock + dry-run visibility.
- Do **not** rely on host-based scoping in jobs; always filter by `site`.

---

## 8) Acceptance Criteria

- With ~6 posts: at least fallback `Related reading` links appear.
- With 30+ posts: in-body links begin appearing naturally under configured rules.
- Re-running `apply` does not duplicate links or fallback sections.
- `internal_link_edges` and content diff confirm idempotent behavior.
- Cross-site contamination is zero.

---

## 9) Deliverables

- New collections + migration wiring.
- Internal linker module (`src/lib/internal-linker/*`).
- Endpoints:
  - `/api/internal-links/run`
  - `/api/internal-links/runs/:id`
- One `dry_run` report + one `apply` run report for Resume Coach site.

