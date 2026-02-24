#!/bin/bash
set -e

# Deploy Payload CMS to Docker Swarm
# This script handles the full deployment process

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Payload Swarm Deployment ==="
echo ""

# Load environment variables
if [ -f .env.production ]; then
    set -a
    source .env.production
    set +a
    echo "[OK] Loaded .env.production"
else
    echo "[ERROR] .env.production not found!"
    exit 1
fi

# Create Docker secrets if they don't exist
echo ""
echo "=== Creating Docker Secrets ==="

# Postgres password
if ! docker secret inspect postgres_password >/dev/null 2>&1; then
    echo "$POSTGRES_PASSWORD" | docker secret create postgres_password -
    echo "[OK] Created postgres_password secret"
else
    echo "[SKIP] postgres_password secret already exists"
fi

# Payload secret
if [ -z "${PAYLOAD_SECRET:-}" ]; then
    echo "[ERROR] PAYLOAD_SECRET is not set in .env.production"
    exit 1
fi
if ! docker secret inspect payload_secret >/dev/null 2>&1; then
    echo "$PAYLOAD_SECRET" | docker secret create payload_secret -
    echo "[OK] Created payload_secret secret"
else
    echo "[SKIP] payload_secret secret already exists"
fi

# Deploy PostgreSQL stack first
echo ""
echo "=== Deploying PostgreSQL Stack ==="
docker stack deploy -c docker-stack-postgres.yml payload-postgres
echo "[OK] PostgreSQL stack deployed"

# Wait for PostgreSQL to be healthy
echo ""
echo "=== Waiting for PostgreSQL to be ready ==="
sleep 10

# Check PostgreSQL service status
for i in {1..30}; do
    if docker service ls | grep -q "payload-postgres_postgres.*1/1"; then
        echo "[OK] PostgreSQL is running"
        break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 5
done

# Deploy Payload CMS stack
echo ""
echo "=== Deploying Payload CMS Stack ==="
docker stack deploy -c docker-stack-payload.yml --with-registry-auth payload-swarm
echo "[OK] Payload CMS stack deployed"

# Show status
echo ""
echo "=== Deployment Status ==="
docker stack ls | grep -E "^(NAME|payload)"
echo ""
docker service ls | grep -E "^(ID|payload)"

echo ""
echo "=== Deployment Complete ==="
echo "Payload CMS will be available at: https://publish.xencolabs.com"
echo ""
echo "Monitor logs with:"
echo "  docker service logs -f payload-swarm_payload"
