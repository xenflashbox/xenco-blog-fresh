#!/usr/bin/env bash
set -euo pipefail

if [[ -f ".env.production" ]]; then
  set -a
  source ".env.production"
  set +a
fi

python3 - <<'PY'
import json
import os
import subprocess

with open(".xenco/meta.json", "r", encoding="utf-8") as f:
    meta = json.load(f)

deploy = meta.get("deploy", {})
support_token = os.environ.get("SUPPORT_HEALTH_TOKEN", "")

for key in ("health_url", "version_url"):
    url = deploy.get(key)
    if not url:
        print(f"WARN: Missing {key} in .xenco/meta.json")
        continue

    cmd = [
        "curl",
        "-sS",
        "-A",
        "xenco-guardrails-verify/1.0",
        "--max-time",
        "15",
        "-w",
        "\n%{http_code}",
        url,
    ]
    if support_token and "/api/support/" in url:
        cmd.extend(["-H", f"Authorization: Bearer {support_token}"])

    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    output = (result.stdout or "").rstrip("\n")
    if "\n" in output:
        body, status = output.rsplit("\n", 1)
    else:
        body, status = output, "000"

    if status.startswith("2"):
        print(f"OK: {key}: {url} ({status})")
        print(body[:500])
    else:
        print(f"ERROR: {key}: {url} ({status})")
        err = (result.stderr or "").strip()
        if err:
            print(err[:500])
        else:
            print(body[:500])
PY
