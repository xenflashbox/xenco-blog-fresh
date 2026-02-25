#!/usr/bin/env bash
set -euo pipefail

TAG="${1:-latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

./scripts/build.sh "${TAG}"
./scripts/push.sh "${TAG}"
