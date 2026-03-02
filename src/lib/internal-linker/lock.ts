import crypto from 'crypto'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

export function getRunScopeKey(site: 'all' | string): string {
  return site === 'all' ? 'all' : `site:${site}`
}

// Backward-compat helper used in existing tests.
export function getRunLockKey(site: 'all' | string): string {
  return `internal-linker:${site}`
}

export async function acquireRunScopeLock(
  payload: Payload,
  site: 'all' | string,
): Promise<{ acquired: true; ownerToken: string; scopeKey: string } | { acquired: false; scopeKey: string }> {
  const scopeKey = getRunScopeKey(site)
  const ownerToken = crypto.randomUUID()
  const db = (payload as any)?.db?.drizzle

  if (!db?.transaction) {
    const fallback = await payload.find({
      collection: 'internal_link_runs',
      where: {
        and: [{ lockKey: { equals: scopeKey } }, { status: { equals: 'running' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (fallback.docs?.length) return { acquired: false, scopeKey }
    return { acquired: true, ownerToken, scopeKey }
  }

  let acquired = false
  try {
    acquired = await db.transaction(async (tx: any) => {
      const conflict =
        site === 'all'
          ? await tx.execute(sql`select scope_key from internal_link_run_locks limit 1 for update`)
          : await tx.execute(sql`
              select scope_key
              from internal_link_run_locks
              where scope_key = 'all' or scope_key = ${scopeKey}
              limit 1
              for update
            `)
      const rows = Array.isArray(conflict?.rows) ? conflict.rows : []
      if (rows.length > 0) return false

      await tx.execute(sql`
        insert into internal_link_run_locks (scope_key, owner_token)
        values (${scopeKey}, ${ownerToken})
      `)
      return true
    })
  } catch (err) {
    const raw = err as any
    const messageParts = [
      typeof raw?.message === 'string' ? raw.message : '',
      typeof raw?.cause?.message === 'string' ? raw.cause.message : '',
      typeof raw?.stack === 'string' ? raw.stack : '',
      typeof raw?.cause?.stack === 'string' ? raw.cause.stack : '',
    ]
    const message = messageParts.filter(Boolean).join(' ')
    const postgresCode = raw?.code || raw?.cause?.code
    if (
      postgresCode === '23505' ||
      message.includes('internal_link_run_locks_pkey') ||
      message.includes('duplicate key value')
    ) {
      return { acquired: false, scopeKey }
    }
    throw err
  }

  if (!acquired) return { acquired: false, scopeKey }
  return { acquired: true, ownerToken, scopeKey }
}

export async function releaseRunScopeLock(payload: Payload, scopeKey: string, ownerToken: string): Promise<void> {
  const db = (payload as any)?.db?.drizzle
  if (!db?.execute) return
  await db.execute(sql`
    delete from internal_link_run_locks
    where scope_key = ${scopeKey}
      and owner_token = ${ownerToken}
  `)
}
