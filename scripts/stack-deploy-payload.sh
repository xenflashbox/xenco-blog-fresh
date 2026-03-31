#!/usr/bin/env bash
# Guarded Swarm deploy for payload-swarm ONLY.
# Always use this (or ./scripts/deploy.sh) — never raw `docker stack deploy` without loading .env.production,
# or Docker will interpolate ${DATABASE_URI} as empty and break the service.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

source "${ROOT}/scripts/lib/env-guardrails.sh"

load_env_file
require_stack_envs "docker-stack-payload.yml"
require_env "DATABASE_URI"
require_env "PAYLOAD_SECRET"
require_env "INTERNAL_LINKER_API_KEY"
require_local_database "DATABASE_URI"

echo "Deploying stack payload-swarm (validated env + DATABASE_URI)"
docker stack deploy -c "${ROOT}/docker-stack-payload.yml" --with-registry-auth "payload-swarm"

# CRITICAL: Post-deploy verification - ensure Docker actually received the DATABASE_URI
echo "Waiting for service spec to update..."
sleep 3

verify_runtime_database "payload-swarm_payload" "DATABASE_URI"
echo "POST-DEPLOY VERIFICATION PASSED: DATABASE_URI confirmed in running service spec"
