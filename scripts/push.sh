#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-latest}"
STACK_FILE="docker-stack-payload.yml"

source "./scripts/lib/env-guardrails.sh"

IMAGE="$(current_image_from_stack "${STACK_FILE}")"
[[ -n "${IMAGE}" ]] || fail "Could not resolve image from ${STACK_FILE}"

echo "Pushing image ${IMAGE}:${TAG}"
docker push "${IMAGE}:${TAG}"

if [[ "${TAG}" != "latest" ]]; then
  echo "Tagging ${IMAGE}:${TAG} as ${IMAGE}:latest"
  docker tag "${IMAGE}:${TAG}" "${IMAGE}:latest"
  docker push "${IMAGE}:latest"
fi

echo "Push complete for ${IMAGE}:${TAG}"
