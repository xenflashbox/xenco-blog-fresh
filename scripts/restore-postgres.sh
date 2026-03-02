#!/bin/bash
# PostgreSQL Restore Script for Payload Swarm
# Usage: ./restore-postgres.sh [backup_file]
#        ./restore-postgres.sh  (uses latest backup)

set -e

BACKUP_DIR="/home/xen/backups/payload-postgres"
POSTGRES_CONTAINER="payload-postgres_postgres"
DB_USER="payload"
DB_NAME="payload"

# Get backup file from argument or use latest
BACKUP_FILE="${1:-${BACKUP_DIR}/payload_latest.dump}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file not found: ${BACKUP_FILE}"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"/payload_*.dump 2>/dev/null || echo "No backups found"
    exit 1
fi

# Find the container on the swarm
CONTAINER_ID=$(docker ps -q -f name="${POSTGRES_CONTAINER}" | head -1)

if [ -z "$CONTAINER_ID" ]; then
    echo "ERROR: PostgreSQL container not found!"
    exit 1
fi

echo "=== PAYLOAD DATABASE RESTORE ==="
echo "Backup file: ${BACKUP_FILE}"
echo "Container: ${CONTAINER_ID}"
echo ""
echo "WARNING: This will REPLACE all data in the database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "Starting restore at $(date)"

# Stop Payload services first to prevent connections
echo "Scaling down Payload to prevent connections..."
docker service scale payload-swarm_payload=0 || true
sleep 10

# Copy backup file to container
echo "Copying backup to container..."
docker cp "${BACKUP_FILE}" "${CONTAINER_ID}:/tmp/restore.dump"

# Restore the database
echo "Restoring database..."
docker exec "${CONTAINER_ID}" pg_restore -U "${DB_USER}" -d "${DB_NAME}" \
    --no-owner --no-acl --clean --if-exists \
    /tmp/restore.dump 2>&1 || true

# Clean up
docker exec "${CONTAINER_ID}" rm -f /tmp/restore.dump

# Scale Payload back up
echo "Scaling Payload back up..."
docker service scale payload-swarm_payload=3

echo ""
echo "Restore completed at $(date)"
echo "Verify at: https://publish.xencolabs.com/admin"
