import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

const WEBHOOK_URL =
  process.env.DOMAIN_WEBHOOK_URL ||
  'http://payload-domain-webhook_domain-webhook:9099/webhook/domains'
const WEBHOOK_SECRET = process.env.DOMAIN_WEBHOOK_SECRET || 'payload-domain-sync-2025'

async function triggerDomainSync(operation: string, siteId: string): Promise<void> {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET,
      },
      body: JSON.stringify({
        operation,
        siteId,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error(`[Domain Sync] Failed to sync domains to Traefik: ${response.status} - ${text}`)
    } else {
      console.log(`[Domain Sync] Domains synced to Traefik successfully (${operation} site ${siteId})`)
    }
  } catch (error) {
    // Log but don't throw - we don't want to block the site update
    console.error('[Domain Sync] Error syncing domains:', error)
  }
}

export const syncDomainsAfterChange: CollectionAfterChangeHook = async ({
  doc,
  operation,
  previousDoc,
}) => {
  // Only sync if domains were added, removed, or modified
  const oldDomains = previousDoc?.domains?.map((d: any) => d.domain).sort().join(',') || ''
  const newDomains = doc?.domains?.map((d: any) => d.domain).sort().join(',') || ''

  if (operation === 'create' || oldDomains !== newDomains) {
    // Fire and forget - don't await to avoid blocking the response
    void triggerDomainSync(operation, doc.id)
  }

  return doc
}

export const syncDomainsAfterDelete: CollectionAfterDeleteHook = async ({ doc }) => {
  // Sync after a site with domains is deleted
  if (doc?.domains?.length) {
    void triggerDomainSync('delete', doc.id)
  }
}
