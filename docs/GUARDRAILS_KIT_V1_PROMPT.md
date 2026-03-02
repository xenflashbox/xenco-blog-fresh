
MISSION:
Install the Guardrails Kit v1 into {{/path/to/current/directory}} directory (at that directory’s root).

HARD RULES (NO EXCEPTIONS):
1) Before editing any directory:
   - cd into it
   - run: pwd
   - run: ls
   - run: if git repo: git rev-parse --show-toplevel
2) If git root exists and is NOT the same as the directory you cd’d into, STOP and report (do not proceed).
3) Do NOT guess deploy values (docker image, swarm service name, health URL).
   - Extract them from existing deploy scripts, compose files, stack files, or readme docs in that directory.
4) If a directory is NOT deployable (no Dockerfile/compose/stack and no known runtime), set:
   - .xenco/meta.json -> kind=tool|package|data|backup and deploy.type=none
5) If directory name includes “backup”, mark kind=backup and deploy.type=none.
6) If directory contains logs only, mark kind=data and deploy.type=none.

TASKS FOR EACH DIRECTORY:
A) Add files:
- CRITICAL.md
- .xenco/meta.json
- scripts/whoami.sh
- scripts/preflight.sh
- scripts/deploy.sh
- scripts/verify.sh
- README-OPS.md

B) Populate .xenco/meta.json correctly:
- kind (service/mcp_server/tool/package/data/backup/template)
- service_id (slug)
- repo_id (generate UUID or short unique id)
- deploy.type (swarm/compose/none)
- If deployable: docker_image, swarm_service, manager_host, health_url, version_url
- expected_repo_root MUST match the absolute path of the directory you are in

C) Make scripts executable:
- chmod +x scripts/*.sh

D) Git handling:
- If it is a git repo: commit + push changes
  Commit message: "feat(ops): add guardrails kit"
- If not a git repo: DO NOT init a repo unless the directory is confirmed to be intended as a repo; instead report it.

FINAL DELIVERABLE:
- A single markdown report named GUARDRAILS_ROLLOUT_REPORT.md written at ROOT listing:
  - directory
  - kind
  - deploy.type
  - git remote (if any)
  - docker image + swarm service (if deployable)
  - status: completed / skipped (and why)
```

---

# Directory-specific guidance (so you don’t accidentally “deploy” backups)

Use these rules when filling `.xenco/meta.json`:

### Mark as **backup / non-deploy**

* `ultra-orchestrator-mcp-backup-v1.1.1` → `kind=backup`, `deploy.type=none`
* `wordpress-mcp-new-generated` → very likely `kind=template` or `kind=backup` unless it is truly live
* `orchestrator-cli-v1.2.5` → likely `kind=backup` or `kind=tool` (deploy none)

### Mark as **data / non-deploy**

* `agent-logs` → `kind=data`, `deploy.type=none`

### Likely **deployable services**

(verify via Dockerfile/stack/deploy scripts; don’t guess)

* `opendeepsearch-advanced-api`
* `document-service`
* `universal-websocket-service`
* `sequin` (could be stack/config)
* `fightclub-inngest-worker`
* `monitoring` / `cluster-status-dashboard` (if they’re runtime dashboards)
* most `servers/*` entries (these sound like runtime MCP services)

---

# The one extra guardrail that stops “wrong directory” instantly

In **every** `.xenco/meta.json`, keep:

```json
"workspace": { "expected_repo_root": "/home/xen/docker/apps/blogcraft-mcp/<exact-folder>" }
```

Because `preflight.sh` hard-blocks if `pwd != expected_repo_root`, agents can’t accidentally edit the wrong clone/template copy.


---

# Guardrails Kit v1 (standard for every directory)

## What gets added to EACH directory

Create these files/folders in the **root of that directory**:

```
CRITICAL.md
.xenco/meta.json
scripts/whoami.sh
scripts/preflight.sh
scripts/deploy.sh
scripts/verify.sh
README-OPS.md
```

### 1) `CRITICAL.md` (short, top-loaded, no fluff)

```md
# CRITICAL (READ FIRST)

## Network (authoritative)
- Cluster subnet: 10.8.8.0/24
- NEVER use 192.168.x.x in this environment.

## Swarm nodes (authoritative quick ref)
- Managers: 10.8.8.14, 10.8.8.15, 10.8.8.17
- Workers:  10.8.8.12, 10.8.8.16, 10.8.8.108

## Absolute rule: no guessing
Before ANY infra action:
1) ./scripts/whoami.sh
2) ./scripts/preflight.sh

## Deployment rule
- Only deploy using: ./scripts/deploy.sh
- Deploy BLOCKS if git is dirty unless you pass --force

## Emergency only
- ./scripts/deploy.sh --force
- If used, you MUST paste: reason + git diff --stat + git rev-parse HEAD
```

---

### 2) `.xenco/meta.json` (the “you are here” identity + deploy mode)

This is the most important file. It makes each folder self-identify so agents stop “getting lost”.

```json
{
  "kind": "service",
  "service_id": "REPLACE_ME_slug",
  "repo_id": "REPLACE_ME_uuid_or_shortid",
  "owner": "xenco",
  "deploy": {
    "type": "swarm",
    "manager_host": "10.8.8.14",
    "docker_image": "registry.xencolabs.com/REPLACE_ME",
    "swarm_service": "REPLACE_ME_stack_service",
    "health_url": "https://REPLACE_ME/health",
    "version_url": "https://REPLACE_ME/api/health"
  },
  "workspace": {
    "expected_repo_root": "/home/xen/docker/apps/blogcraft-mcp/REPLACE_ME"
  }
}
```

**Valid `kind` values (pick one):**

* `"service"` = deployable runtime service
* `"mcp_server"` = MCP server (still deployable, but sometimes not Swarm)
* `"tool"` = CLI/tooling repo (usually no deploy)
* `"package"` = library/package (no deploy)
* `"data"` = logs/artifacts (no deploy)
* `"backup"` = backup copy (no deploy)
* `"template"` = template generator output (no deploy)

**Valid deploy types:**

* `"swarm"` (default for your prod services)
* `"compose"` (standalone docker compose)
* `"none"` (tools/packages/logs/backups)

If a folder should never deploy, set:

```json
"deploy": { "type": "none" }
```

---

### 3) `scripts/whoami.sh` (orientation check)

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "PWD: $(pwd)"
echo "HOST: $(hostname)"

echo "IP(s):"
ip -4 addr show | awk '/inet /{print " - " $2 " (" $NF ")"}' || true

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "GIT_ROOT: $(git rev-parse --show-toplevel)"
  echo "BRANCH:   $(git rev-parse --abbrev-ref HEAD)"
  echo "SHA:      $(git rev-parse --short HEAD)"
else
  echo "GIT_ROOT: (not a git repo)"
fi

if [[ -f ".xenco/meta.json" ]]; then
  echo "META:"
  python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json"))
print(" kind:", d.get("kind"))
print(" service_id:", d.get("service_id"))
print(" deploy.type:", d.get("deploy",{}).get("type"))
print(" manager_host:", d.get("deploy",{}).get("manager_host"))
PY
else
  echo "META: (missing .xenco/meta.json)"
fi
```

---

### 4) `scripts/preflight.sh` (hard blocks)

```bash
#!/usr/bin/env bash
set -euo pipefail

FORCE="${1:-}"

fail(){ echo "❌ $*" >&2; exit 1; }
warn(){ echo "⚠️  $*" >&2; }
ok(){ echo "✅ $*"; }

[[ -f "CRITICAL.md" ]] || fail "Missing CRITICAL.md"
[[ -f ".xenco/meta.json" ]] || fail "Missing .xenco/meta.json"
[[ -d "scripts" ]] || fail "Missing scripts/"

DEPLOY_TYPE="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json"))
print(d.get("deploy",{}).get("type","none"))
PY
)"

EXPECTED_ROOT="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json"))
print(d.get("workspace",{}).get("expected_repo_root",""))
PY
)"

# Enforce "you are in the right directory"
if [[ -n "${EXPECTED_ROOT}" ]]; then
  ACTUAL="$(pwd)"
  [[ "${ACTUAL}" == "${EXPECTED_ROOT}" ]] || fail "Wrong directory. expected_repo_root=${EXPECTED_ROOT} actual=${ACTUAL}"
fi

# Never allow 192.168 guess for deploy manager
MANAGER="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json"))
print(d.get("deploy",{}).get("manager_host",""))
PY
)"
if [[ -n "${MANAGER}" && "${MANAGER}" == 192.168.* ]]; then
  fail "manager_host is 192.168.* (wrong subnet). Fix .xenco/meta.json"
fi

# Git safety for deployable repos
if [[ "${DEPLOY_TYPE}" != "none" ]]; then
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Deployable deploy.type=${DEPLOY_TYPE} but not a git repo."
  ROOT="$(git rev-parse --show-toplevel)"
  [[ "${ROOT}" == "$(pwd)" ]] || fail "Not at git root. cd to: ${ROOT}"

  CHANGES="$(git status --porcelain)"
  if [[ -n "${CHANGES}" && "${FORCE}" != "--force" ]]; then
    echo "${CHANGES}" >&2
    fail "Uncommitted changes. Commit/stash first (or --force emergency only)."
  fi

  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${BRANCH}" != "main" && "${FORCE}" != "--force" ]]; then
    fail "Not on main branch (${BRANCH}). Switch to main (or --force emergency)."
  fi

  git fetch origin main >/dev/null 2>&1 || warn "Could not fetch origin/main"
fi

ok "Preflight passed."
```

---

### 5) `scripts/deploy.sh` (single blessed entrypoint)

```bash
#!/usr/bin/env bash
set -euo pipefail

FORCE="${1:-}"   # optionally --force
TAG="${2:-}"     # optionally v12.5.0 etc.

./scripts/preflight.sh "${FORCE}"

DEPLOY_TYPE="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json"))
print(d.get("deploy",{}).get("type","none"))
PY
)"

if [[ "${DEPLOY_TYPE}" == "none" ]]; then
  echo "ℹ️  deploy.type=none. This repo/folder is not deployable."
  exit 0
fi

SHA="$(git rev-parse --short HEAD)"
if [[ -z "${TAG}" ]]; then TAG="v${SHA}"; fi

MANAGER="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json"))
print(d["deploy"]["manager_host"])
PY
)"
IMAGE="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json"))
print(d["deploy"]["docker_image"])
PY
)"
SERVICE="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json"))
print(d["deploy"]["swarm_service"])
PY
)"

echo "Deploying:"
echo "  image:   ${IMAGE}:${TAG}"
echo "  service: ${SERVICE}"
echo "  manager: ${MANAGER}"

case "${DEPLOY_TYPE}" in
  swarm)
    docker build -t "${IMAGE}:${TAG}" .
    docker push "${IMAGE}:${TAG}"
    ssh "xen@${MANAGER}" "docker service update --image ${IMAGE}:${TAG} ${SERVICE}"
    ;;
  compose)
    docker compose build
    docker compose up -d
    ;;
  *)
    echo "❌ Unknown deploy.type=${DEPLOY_TYPE}"
    exit 1
    ;;
esac

./scripts/verify.sh || true
echo "✅ Deploy done."
```

---

### 6) `scripts/verify.sh` (must print health + version)

```bash
#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
import json, urllib.request
d=json.load(open(".xenco/meta.json"))
dep=d.get("deploy",{})
for key in ("health_url","version_url"):
    url=dep.get(key)
    if not url:
        print(f"⚠️  Missing {key} in .xenco/meta.json")
        continue
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            body=r.read(4000).decode("utf-8","ignore")
        print(f"✅ {key}: {url}")
        print(body[:500])
    except Exception as e:
        print(f"❌ {key} failed: {url} -> {e}")
PY
```

---

### 7) `README-OPS.md` (super short)

```md
# Ops

- Read CRITICAL.md
- Identify repo: ./scripts/whoami.sh
- Preflight: ./scripts/preflight.sh
- Deploy: ./scripts/deploy.sh
- Emergency only: ./scripts/deploy.sh --force
```

---
     