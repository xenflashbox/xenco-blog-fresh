# Internal Linker Operations Runbook

This runbook documents production operations for the internal linker hardening features:

- scope-aware atomic locking
- edge lifecycle reconciliation (`active|stale|reverted`)
- run-level rollback endpoint
- site slug support
- API key management via env + Docker Swarm secrets

## 1) Environment and Secrets Source of Truth

Primary source of truth:

- `.env.production`

Required keys for linker operations:

- `INTERNAL_LINKER_API_KEY`
- `PAYLOAD_SECRET`
- `DATABASE_URI`
- `REDIS_PASSWORD`

Swarm secrets expected:

- `payload_secret`
- `internal_linker_api_key`
- `postgres_password`

The stack mounts:

- `/run/secrets/internal_linker_api_key`

And also sets:

- `INTERNAL_LINKER_API_KEY` (env)
- `INTERNAL_LINKER_API_KEY_FILE=/run/secrets/internal_linker_api_key`

API auth checks use env first and fallback to file.

## 2) Deploy-Time Validation

`deploy.sh` now:

- loads `.env.production`
- fails fast when required env vars are missing
- ensures required Swarm secrets exist (creates if missing)

`build-and-push.sh` now:

- loads `.env.production` before build
- validates required env vars so builds fail early on missing deployment config

`scripts/sync-traefik-domains.sh` now:

- loads `.env.production`
- validates required env vars before running `docker stack deploy`

## 3) Internal Linker Endpoints

Run:

```bash
curl -sS -X POST "https://publish.xencolabs.com/api/internal-links/run?mode=dry_run&site=all&limit=20" \
  -H "x-api-key: $INTERNAL_LINKER_API_KEY"
```

Status:

```bash
curl -sS "https://publish.xencolabs.com/api/internal-links/runs/<RUN_ID>" \
  -H "x-api-key: $INTERNAL_LINKER_API_KEY"
```

Revert:

```bash
curl -sS -X POST "https://publish.xencolabs.com/api/internal-links/revert?runId=<RUN_ID>" \
  -H "x-api-key: $INTERNAL_LINKER_API_KEY"
```

Site token rules:

- `site=all`
- `site=<numeric id>`
- `site=<slug token>` (example: `site=resumecoach`)

## 4) Concurrency and Scope Semantics

Lock behavior:

- `site=all` blocks all concurrent runs
- `site=<id>` blocks same site runs
- `site=<id>` is blocked while `site=all` is running

Expected responses under contention:

- winner: `200`
- blocked contenders: `409` with `Run already in progress`

## 5) Edge Lifecycle Semantics

Each edge can be:

- `active`: link is currently present in source content
- `stale`: edge exists historically but link is no longer present
- `reverted`: removed by explicit revert run

Fields used:

- `status`
- `lastSeenRunId`
- `revertRunId`
- `targetUrl`
- `fingerprint`
- `leftContext` / `rightContext`

## 6) Verification Checklist (Post-Deploy)

1. Auth check:
   - run a small dry run with API key, expect `200`
2. Lock check:
   - fire 5 parallel `site=all` dry runs, expect `1x200 + 4x409`
3. Scope check:
   - run `site=1` and `site=10` in parallel, expect both `200`
4. Slug check:
   - run `site=resumecoach`, expect `200` and resolved to site `1`
5. Revert check:
   - apply with small limit, then revert by run ID, confirm `reverted` edge statuses

## 7) Notes

- If secret values are rotated, update `.env.production` and explicitly rotate/recreate Swarm secrets as part of maintenance.
- Keep `INTERNAL_LINKER_API_KEY` out of logs and tickets; use env/substitution during command execution.
