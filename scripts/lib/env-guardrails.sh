#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.production}"

fail() { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARN: $*" >&2; }
ok() { echo "OK: $*"; }

load_env_file() {
  [[ -f "${ENV_FILE}" ]] || fail "Missing ${ENV_FILE}"

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  ok "Loaded ${ENV_FILE}"
}

require_env() {
  local var_name="$1"
  [[ -n "${!var_name:-}" ]] || fail "${var_name} is required but empty"
}

stack_env_vars() {
  local stack_file="$1"
  [[ -f "${stack_file}" ]] || fail "Stack file not found: ${stack_file}"

  python3 - "$stack_file" <<'PY'
import re
import sys

stack_file = sys.argv[1]
with open(stack_file, "r", encoding="utf-8") as f:
    content = f.read()

names = sorted(set(re.findall(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}", content)))
for name in names:
    print(name)
PY
}

require_stack_envs() {
  local stack_file="$1"
  local var_name
  while IFS= read -r var_name; do
    [[ -z "${var_name}" ]] && continue
    if is_optional_env_var "${var_name}"; then
      if [[ -z "${!var_name:-}" ]]; then
        warn "${var_name} is optional and currently empty"
      fi
      continue
    fi
    require_env "${var_name}"
  done < <(stack_env_vars "${stack_file}")

  ok "Validated env vars required by ${stack_file}"
}

is_optional_env_var() {
  local var_name="$1"
  case "${var_name}" in
    REDIS_PASSWORD)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_swarm_secret() {
  local secret_name="$1"
  local secret_value="$2"

  if docker secret inspect "${secret_name}" >/dev/null 2>&1; then
    ok "Secret exists: ${secret_name}"
    return
  fi

  [[ -n "${secret_value}" ]] || fail "Cannot create empty secret: ${secret_name}"
  printf "%s" "${secret_value}" | docker secret create "${secret_name}" - >/dev/null
  ok "Created secret: ${secret_name}"
}

current_image_from_stack() {
  local stack_file="$1"
  python3 - "$stack_file" <<'PY'
import re
import sys

stack_file = sys.argv[1]
with open(stack_file, "r", encoding="utf-8") as f:
    content = f.read()

m = re.search(r'^\s*image:\s*([^\s]+)\s*$', content, flags=re.M)
if not m:
    print("", end="")
    raise SystemExit(0)
image = m.group(1).strip()

if "@" in image:
    image = image.split("@", 1)[0]

last_slash = image.rfind("/")
last_colon = image.rfind(":")
if last_colon > last_slash:
    image = image[:last_colon]

print(image)
PY
}
