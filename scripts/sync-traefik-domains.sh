#!/bin/bash
# Sync CMS Domains to Traefik Labels
# This script reads domains from the sites_domains table and updates Traefik labels
# Usage: ./sync-traefik-domains.sh [--dry-run]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_FILE="${SCRIPT_DIR}/../docker-stack-payload.yml"
POSTGRES_CONTAINER="payload-postgres_postgres"
DRY_RUN=false

# Load env file so docker stack variable interpolation is deterministic.
if [ -f "${SCRIPT_DIR}/../.env.production" ]; then
    set -a
    source "${SCRIPT_DIR}/../.env.production"
    set +a
else
    echo "ERROR: .env.production not found in repo root"
    exit 1
fi

require_env() {
    local var_name="$1"
    if [ -z "${!var_name:-}" ]; then
        echo "ERROR: ${var_name} is not set in .env.production"
        exit 1
    fi
}

# Parse arguments
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "🔍 DRY RUN MODE - No changes will be made"
fi

echo "=== Payload CMS Domain Sync ==="
echo "Stack file: ${STACK_FILE}"
echo ""

require_env "PAYLOAD_SECRET"
require_env "DATABASE_URI"
require_env "INTERNAL_LINKER_API_KEY"

# Get container ID
CONTAINER_ID=$(docker ps -q -f name="${POSTGRES_CONTAINER}" | head -1)
if [ -z "$CONTAINER_ID" ]; then
    echo "ERROR: PostgreSQL container not found!"
    exit 1
fi

# Fetch unique base domains from sites_domains table
echo "📊 Fetching domains from database..."
DOMAINS=$(docker exec "${CONTAINER_ID}" psql -U payload -d payload -t -c "
    SELECT DISTINCT
        CASE
            WHEN domain LIKE 'www.%' THEN SUBSTRING(domain FROM 5)
            ELSE domain
        END as base_domain
    FROM sites_domains
    WHERE domain NOT LIKE 'cms.%'
    ORDER BY base_domain;
" | tr -d ' ' | grep -v '^$')

# Canonical CMS + legacy publish host (see docker-stack-payload.yml)
PRIMARY_DOMAIN="cms.xencolabs.com"
LEGACY_DOMAIN="publish.xencolabs.com"

# Build the Traefik rule
echo "🔧 Building Traefik rule..."
RULE="Host(\`${PRIMARY_DOMAIN}\`) || Host(\`${LEGACY_DOMAIN}\`)"

# Add cms. subdomain for each base domain
for domain in $DOMAINS; do
    # Skip if empty
    [ -z "$domain" ] && continue

    # Add cms. subdomain
    CMS_DOMAIN="cms.${domain}"
    RULE="${RULE} || Host(\`${CMS_DOMAIN}\`)"
    echo "  ✅ ${CMS_DOMAIN}"
done

echo ""
echo "📝 Generated Traefik rule:"
echo "${RULE}" | fold -w 80

# Count domains
DOMAIN_COUNT=$(echo "$RULE" | grep -oP "Host\(" | wc -l)
echo ""
echo "📊 Total domains: ${DOMAIN_COUNT}"

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "🔍 DRY RUN - Would update ${STACK_FILE}"
    exit 0
fi

# Backup current stack file
cp "${STACK_FILE}" "${STACK_FILE}.bak"
echo ""
echo "💾 Backup created: ${STACK_FILE}.bak"

# Update the stack file using sed
# This is a bit complex because the rule spans one line
ESCAPED_RULE=$(echo "$RULE" | sed 's/[&/\]/\\&/g')

# Create a temporary file with the new rule
sed -i "s|traefik.http.routers.payload-swarm.rule=.*\"|traefik.http.routers.payload-swarm.rule=${ESCAPED_RULE}\"|" "${STACK_FILE}"

echo "✏️  Updated stack file"

# Deploy the updated stack (loads .env.production so DATABASE_URI is never empty)
echo ""
echo "🚀 Deploying updated stack..."
bash "${SCRIPT_DIR}/stack-deploy-payload.sh"

echo ""
echo "✅ Domain sync complete!"
echo ""
echo "Verify with:"
echo "  curl -s http://localhost:8080/api/http/routers | jq '.[] | select(.name | contains(\"payload-swarm\")) | .rule'"
