#!/bin/bash
set -e

# Build and push Payload CMS Docker image to GitHub Container Registry
# Usage: ./build-and-push.sh [tag]

TAG=${1:-latest}
IMAGE_NAME="ghcr.io/xenflashbox/payload-swarm"

echo "Building Payload CMS Docker image..."
docker build -t "${IMAGE_NAME}:${TAG}" .

echo "Pushing to GitHub Container Registry..."
docker push "${IMAGE_NAME}:${TAG}"

# Also tag as latest if building a specific version
if [ "$TAG" != "latest" ]; then
    docker tag "${IMAGE_NAME}:${TAG}" "${IMAGE_NAME}:latest"
    docker push "${IMAGE_NAME}:latest"
fi

echo "Done! Image available at ${IMAGE_NAME}:${TAG}"
