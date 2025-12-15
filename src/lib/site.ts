// src/lib/site.ts
// Shared domain/site resolver helper

export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '')
  return s || null
}

export function getHostFromHeaders(headers: Headers | Record<string, string> | any): string | null {
  if (!headers) return null

  let host: string | null = null

  if (typeof headers.get === 'function') {
    host = headers.get('x-forwarded-host') || headers.get('host') || null
  } else {
    host = headers['x-forwarded-host'] || headers['host'] || headers['X-Forwarded-Host'] || headers['Host'] || null
  }

  if (!host) return null

  // If value contains commas, take first
  const first = host.split(',')[0].trim()
  return first || null
}

export async function resolveSiteForRequest(
  payload: { find: (args: any) => Promise<any> },
  headers: Headers | Record<string, string> | any
): Promise<{ id: string } | null> {
  const hostRaw = getHostFromHeaders(headers)
  if (!hostRaw) {
    // Fallback to default site
    const defaults = await payload.find({
      collection: 'sites',
      where: { isDefault: { equals: true } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const site = defaults.docs?.[0]
    return site?.id ? { id: String(site.id) } : null
  }

  const host = normalizeDomain(hostRaw)
  if (!host) {
    // Fallback to default site
    const defaults = await payload.find({
      collection: 'sites',
      where: { isDefault: { equals: true } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const site = defaults.docs?.[0]
    return site?.id ? { id: String(site.id) } : null
  }

  // Try exact match
  const byDomain = await payload.find({
    collection: 'sites',
    where: { 'domains.domain': { equals: host } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (byDomain.docs?.[0]?.id) {
    return { id: String(byDomain.docs[0].id) }
  }

  // Try without leading www.
  const hostNoWww = host.startsWith('www.') ? host.slice(4) : host
  if (hostNoWww !== host) {
    const byDomainNoWww = await payload.find({
      collection: 'sites',
      where: { 'domains.domain': { equals: hostNoWww } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (byDomainNoWww.docs?.[0]?.id) {
      return { id: String(byDomainNoWww.docs[0].id) }
    }
  }

  // Fallback to default site
  const defaults = await payload.find({
    collection: 'sites',
    where: { isDefault: { equals: true } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const site = defaults.docs?.[0]
  return site?.id ? { id: String(site.id) } : null
}

