#!/usr/bin/env bash
set -euo pipefail

FORCE="${1:-}"

fail(){ echo "ERROR: $*" >&2; exit 1; }
warn(){ echo "WARN: $*" >&2; }
ok(){ echo "OK: $*"; }

[[ -f "CRITICAL.md" ]] || fail "Missing CRITICAL.md"
[[ -f ".xenco/meta.json" ]] || fail "Missing .xenco/meta.json"
[[ -d "scripts" ]] || fail "Missing scripts/"

DEPLOY_TYPE="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json", "r", encoding="utf-8"))
print(d.get("deploy",{}).get("type","none"))
PY
)"

EXPECTED_ROOT="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json", "r", encoding="utf-8"))
print(d.get("workspace",{}).get("expected_repo_root",""))
PY
)"

if [[ -n "${EXPECTED_ROOT}" ]]; then
  ACTUAL="$(pwd)"
  [[ "${ACTUAL}" == "${EXPECTED_ROOT}" ]] || fail "Wrong directory. expected_repo_root=${EXPECTED_ROOT} actual=${ACTUAL}"
fi

MANAGER="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json", "r", encoding="utf-8"))
print(d.get("deploy",{}).get("manager_host",""))
PY
)"

if [[ -n "${MANAGER}" && "${MANAGER}" == 192.168.* ]]; then
  fail "manager_host uses 192.168.x.x (invalid subnet for this cluster)"
fi

if [[ "${DEPLOY_TYPE}" != "none" ]]; then
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Deployable repo must be a git repo."
  ROOT="$(git rev-parse --show-toplevel)"
  [[ "${ROOT}" == "$(pwd)" ]] || fail "Not at git root. cd to ${ROOT}"

  CHANGES="$(git status --porcelain)"
  if [[ -n "${CHANGES}" && "${FORCE}" != "--force" ]]; then
    echo "${CHANGES}" >&2
    fail "Uncommitted changes found. Commit/stash first (or --force emergency only)."
  fi

  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${BRANCH}" != "main" && "${FORCE}" != "--force" ]]; then
    fail "Not on main branch (${BRANCH})."
  fi

  git fetch origin main >/dev/null 2>&1 || warn "Could not fetch origin/main"
fi

ok "Preflight passed."
