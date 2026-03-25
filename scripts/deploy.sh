#!/usr/bin/env bash
set -euo pipefail

FORCE=""
SKIP_BUILD=0
SKIP_MIGRATIONS=0
TAG="latest"

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE="--force"
      ;;
    --skip-build)
      SKIP_BUILD=1
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS=1
      ;;
    --tag=*)
      TAG="${arg#--tag=}"
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: ./scripts/deploy.sh [--force] [--skip-build] [--skip-migrations] [--tag=<tag>]" >&2
      exit 1
      ;;
  esac
done

./scripts/preflight.sh "${FORCE}"
source "./scripts/lib/env-guardrails.sh"

load_env_file
require_stack_envs "docker-stack-postgres.yml"
require_stack_envs "docker-stack-payload.yml"

require_env "POSTGRES_PASSWORD"
require_env "PAYLOAD_SECRET"
require_env "INTERNAL_LINKER_API_KEY"
require_local_database "DATABASE_URI"

ensure_swarm_secret "postgres_password" "${POSTGRES_PASSWORD}"
ensure_swarm_secret "payload_secret" "${PAYLOAD_SECRET}"
ensure_swarm_secret "internal_linker_api_key" "${INTERNAL_LINKER_API_KEY}"

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  ./scripts/build.sh "${TAG}"
  ./scripts/push.sh "${TAG}"
fi

if [[ "${SKIP_MIGRATIONS}" -eq 0 ]]; then
  echo "Running one-off Payload migrations before service rollout"
  pnpm payload migrate
else
  warn "Skipping migrations by request (--skip-migrations)"
fi

echo "Deploying stack payload-postgres"
docker stack deploy -c "docker-stack-postgres.yml" "payload-postgres"

echo "Deploying stack payload-swarm"
./scripts/stack-deploy-payload.sh

SERVICE_NAME="$(python3 - <<'PY'
import json
d=json.load(open(".xenco/meta.json", "r", encoding="utf-8"))
print(d["deploy"]["swarm_service"])
PY
)"

echo "Verifying critical runtime env vars on ${SERVICE_NAME}"
ENV_LINES="$(docker service inspect "${SERVICE_NAME}" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}')"

for key in DATABASE_URI PAYLOAD_SECRET INTERNAL_LINKER_API_KEY; do
  value="$(printf "%s\n" "${ENV_LINES}" | awk -F= -v key="${key}" '$1==key {sub(/^[^=]*=/,"",$0); print $0}' | tail -n 1)"
  [[ -n "${value}" ]] || fail "${key} is empty in runtime service spec (${SERVICE_NAME})"
  ok "${key} is set in runtime service spec"
done

verify_runtime_database "${SERVICE_NAME}" "DATABASE_URI"

./scripts/verify.sh
echo "Deploy complete."
