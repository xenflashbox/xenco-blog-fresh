#!/bin/bash
# PostgreSQL Backup Script for Payload Swarm
# Run via cron: 0 */6 * * * /home/xen/docker/apps/payload-swarm/scripts/backup-postgres.sh

set -e

# Configuration
BACKUP_DIR="/home/xen/backups/payload-postgres"
RETENTION_DAYS=14
POSTGRES_CONTAINER="payload-postgres_postgres"
DB_USER="payload"
DB_NAME="payload"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/payload_${DATE}.dump"

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Find the container on the swarm
CONTAINER_ID=$(docker ps -q -f name="${POSTGRES_CONTAINER}" | head -1)

if [ -z "$CONTAINER_ID" ]; then
    echo "ERROR: PostgreSQL container not found!"
    exit 1
fi

echo "Starting backup at $(date)"
echo "Container: ${CONTAINER_ID}"

# Create backup using pg_dump in custom format (compressed)
docker exec "${CONTAINER_ID}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc --no-owner --no-acl > "${BACKUP_FILE}"

# Verify backup was created
if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "Backup successful: ${BACKUP_FILE} (${SIZE})"

    # Create a latest symlink
    ln -sf "${BACKUP_FILE}" "${BACKUP_DIR}/payload_latest.dump"
else
    echo "ERROR: Backup file is empty or missing!"
    exit 1
fi

# Clean up old backups
echo "Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "payload_*.dump" -type f -mtime +${RETENTION_DAYS} -delete

# List remaining backups
echo "Current backups:"
ls -lh "${BACKUP_DIR}"/payload_*.dump 2>/dev/null || echo "No backups found"

echo "Backup completed at $(date)"
