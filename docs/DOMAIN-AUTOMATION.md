# Domain Automation for Payload CMS

This document explains how to automatically sync CMS domains to Traefik when adding new sites.

## Current CMS Domains (19 total)

| Domain | Site |
|--------|------|
| publish.xencolabs.com | Primary CMS |
| cms.xencolabs.com | Legacy primary |
| cms.blogcraft.app | BlogCraft |
| cms.devmaestro.io | Dev Maestro |
| cms.diabetescompass.com | Diabetes Compass |
| cms.fiberinsider.com | Fiber Insider |
| cms.fightclubtech.com | Fight Club Tech |
| cms.homebeautyspa.com | Home Beauty Spa |
| cms.imagecrafter.app | ImageCrafter |
| cms.landingcraft.app | Landing Craft |
| cms.landlordhell.com | Landlord Hell |
| cms.lexiexplains.com | Lexi Explains |
| cms.mcpforge.org | MCP Forge |
| cms.promptmarketer.app | Prompt Marketer |
| cms.resumecoach.me | Resume Coach |
| cms.snackabletiktok.com | Snackable TikTok |
| cms.sonomagrovesuites.com | Sonoma Grove Suites |
| cms.tinatortoise.com | Tina Tortoise |
| cms.winecountrycorner.com | Wine Country Corner |

## Option 1: Manual Sync Script

Run the sync script manually when adding new domains:

```bash
# Dry run (preview changes)
./scripts/sync-traefik-domains.sh --dry-run

# Apply changes
./scripts/sync-traefik-domains.sh
```

## Option 2: Webhook Server (Automated)

Deploy the webhook server for automatic syncing:

```bash
docker stack deploy -c docker-stack-domain-webhook.yml payload-domain-webhook
```

### Trigger the webhook:

```bash
curl -X POST https://admin-api.xencolabs.com/domains/webhook/domains \
  -H "X-Webhook-Secret: payload-domain-sync-2025"
```

### Check current domains:

```bash
curl https://admin-api.xencolabs.com/domains/domains
```

## Option 3: Payload CMS Integration

Add a hook to your Payload CMS collection (sites or sites_domains):

```typescript
// src/collections/Sites.ts or hooks/syncDomains.ts

import { CollectionAfterChangeHook } from 'payload/types';

const syncDomainsToTraefik: CollectionAfterChangeHook = async ({
  doc,
  operation,
}) => {
  // Only sync on create/update
  if (operation === 'create' || operation === 'update') {
    try {
      const response = await fetch('http://payload-domain-webhook_domain-webhook:9099/webhook/domains', {
        method: 'POST',
        headers: {
          'X-Webhook-Secret': process.env.DOMAIN_WEBHOOK_SECRET || 'payload-domain-sync-2025',
        },
      });

      if (!response.ok) {
        console.error('Failed to sync domains to Traefik:', await response.text());
      } else {
        console.log('Domains synced to Traefik successfully');
      }
    } catch (error) {
      console.error('Error syncing domains:', error);
    }
  }

  return doc;
};

export default syncDomainsToTraefik;

// In your collection config:
// hooks: {
//   afterChange: [syncDomainsToTraefik],
// }
```

Add to your `.env`:
```env
DOMAIN_WEBHOOK_SECRET=payload-domain-sync-2025
```

## Option 4: Admin Dashboard

For a full admin dashboard, consider using:

1. **Portainer** (already deployed) - Manage stacks visually
2. **Custom Next.js dashboard** - Build a simple domain management UI
3. **Payload Admin Extension** - Add a custom view in Payload admin

### Simple Admin API Endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/domains/health` | GET | Health check |
| `/domains/domains` | GET | List all configured domains |
| `/domains/webhook/domains` | POST | Sync domains to Traefik |

## Adding a New Site

1. **In Payload Admin**: Create the site and add domains to `sites_domains`

2. **Sync Traefik** (choose one):
   - Automatic: If webhook integration is enabled, happens automatically
   - Manual: Run `./scripts/sync-traefik-domains.sh`
   - API: `curl -X POST ... /webhook/domains`

3. **DNS**: Point `cms.<domain>` to `216.129.110.58` (Traefik proxy)

4. **Verify**: Visit `https://cms.<domain>/admin`

## DNS Configuration

To use the webhook externally, add a DNS A record:
- `admin-api.xencolabs.com` → `216.129.110.58` (Traefik proxy IP)

## Troubleshooting

### Check current Traefik rules:
```bash
curl -s http://localhost:8080/api/http/routers | jq '.[] | select(.name | contains("payload-swarm")) | .rule'
```

### View webhook logs:
```bash
docker service logs payload-domain-webhook_domain-webhook
```

### Force redeploy Payload:
```bash
docker stack deploy -c docker-stack-payload.yml payload-swarm --with-registry-auth
```
