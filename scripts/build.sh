#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-latest}"
STACK_FILE="docker-stack-payload.yml"

source "./scripts/lib/env-guardrails.sh"

load_env_file
require_stack_envs "${STACK_FILE}"

IMAGE="$(current_image_from_stack "${STACK_FILE}")"
[[ -n "${IMAGE}" ]] || fail "Could not resolve image from ${STACK_FILE}"

echo "Building image ${IMAGE}:${TAG}"
docker build -t "${IMAGE}:${TAG}" .
echo "Build complete: ${IMAGE}:${TAG}"
