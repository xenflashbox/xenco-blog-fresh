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
d=json.load(open(".xenco/meta.json", "r", encoding="utf-8"))
print(" kind:", d.get("kind"))
print(" service_id:", d.get("service_id"))
print(" deploy.type:", d.get("deploy",{}).get("type"))
print(" manager_host:", d.get("deploy",{}).get("manager_host"))
PY
else
  echo "META: (missing .xenco/meta.json)"
fi
