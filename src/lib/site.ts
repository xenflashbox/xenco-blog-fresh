// src/lib/site.ts
// Shared domain/site resolver helper

type PayloadLike = {
  find: (args: any) => Promise<any>
}

let cachedDefaultSiteId: string | null = null
let cachedDefaultSiteAt = 0

export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null

  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/:\d+$/, '')
    .replace(/\.$/, '') // strip trailing dot
    .replace(/\/+$/, '')

  return s || null
}

export function getHostFromHeaders(headers: Headers | Record<string, string> | any): string | null {
  if (!headers) return null

  let host: string | null = null

  if (typeof headers.get === 'function') {
    host = headers.get('x-forwarded-host') || headers.get('host') || null
  } else {
    host =
      headers['x-forwarded-host'] ||
      headers['host'] ||
      headers['X-Forwarded-Host'] ||
      headers['Host'] ||
      null
  }

  if (!host) return null

  // if contains commas, take first
  const first = String(host).split(',')[0].trim()
  return first || null
}

async function getDefaultSiteId(payload: PayloadLike): Promise<string | null> {
  const now = Date.now()
  if (cachedDefaultSiteId && now - cachedDefaultSiteAt < 60_000) return cachedDefaultSiteId

  const defaults = await payload.find({
    collection: 'sites',
    where: { isDefault: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const site = defaults.docs?.[0]
  cachedDefaultSiteId = site?.id ? String(site.id) : null
  cachedDefaultSiteAt = now
  return cachedDefaultSiteId
}

async function findSiteByDomain(payload: PayloadLike, domain: string): Promise<string | null> {
  const res = await payload.find({
    collection: 'sites',
    where: { 'domains.domain': { equals: domain } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const site = res.docs?.[0]
  return site?.id ? String(site.id) : null
}

export async function resolveSiteForRequest(
  payload: PayloadLike,
  headers: Headers | Record<string, string> | any,
): Promise<{ id: string } | null> {
  const hostRaw = getHostFromHeaders(headers)
  const host = normalizeDomain(hostRaw)

  // If no host, fallback to default
  if (!host) {
    const id = await getDefaultSiteId(payload)
    return id ? { id } : null
  }

  // Try both variants: exact, without www, and with www
  const hostNoWww = host.startsWith('www.') ? host.slice(4) : host
  const hostWithWww = hostNoWww.startsWith('www.') ? hostNoWww : `www.${hostNoWww}`

  const candidates = Array.from(new Set([host, hostNoWww, hostWithWww]))

  for (const candidate of candidates) {
    const id = await findSiteByDomain(payload, candidate)
    if (id) return { id }
  }

  // Fallback to default site
  const defaultId = await getDefaultSiteId(payload)
  return defaultId ? { id: defaultId } : null
}
