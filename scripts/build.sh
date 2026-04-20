#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-latest}"
STACK_FILE="docker-stack-payload.yml"

source "./scripts/lib/env-guardrails.sh"

load_env_file
require_stack_envs "${STACK_FILE}"

IMAGE="$(current_image_from_stack "${STACK_FILE}")"
[[ -n "${IMAGE}" ]] || fail "Could not resolve image from ${STACK_FILE}"

GIT_COMMIT_HASH="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"

echo "Building image ${IMAGE}:${TAG} (git: ${GIT_COMMIT_HASH})"
docker build \
  --build-arg GIT_COMMIT_HASH="${GIT_COMMIT_HASH}" \
  -t "${IMAGE}:${TAG}" \
  .
echo "Build complete: ${IMAGE}:${TAG}"
