import type { Payload } from 'payload'

export function getRunLockKey(site: 'all' | string): string {
  return `internal-linker:${site}`
}

export async function hasActiveLock(payload: Payload, lockKey: string): Promise<boolean> {
  const existing = await payload.find({
    collection: 'internal_link_runs',
    where: {
      and: [{ lockKey: { equals: lockKey } }, { status: { equals: 'running' } }],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return Boolean(existing.docs?.length)
}
