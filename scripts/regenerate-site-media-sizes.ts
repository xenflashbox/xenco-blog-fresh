/**
 * Re-process all image Media for a site through Payload's Sharp pipeline (resize + imageSizes)
 * and R2 via the storage adapter. Use after adding imageSizes to Media collection.
 *
 * Usage (from repo root, with .env.production loaded):
 *   pnpm run media:regenerate-site-sizes
 *   SITE_SLUG=nexusguard pnpm run media:regenerate-site-sizes
 *   pnpm exec tsx scripts/regenerate-site-media-sizes.ts --dry-run
 *
 * Requires: DATABASE_URI, R2_*, PAYLOAD_PUBLIC_SERVER_URL (or NEXT_PUBLIC_PAYLOAD_URL) for fetch URLs.
 *
 * IMPORTANT: NODE_ENV must be `production` so @payloadcms/db-postgres does NOT run pushDevSchema
 * (interactive schema push can drop tables). The npm script sets this.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// Prefer .env.production for ops (same as deploy scripts)
// Load .env then .env.production (later file does not override existing keys)
const envLocal = path.join(root, '.env')
if (fs.existsSync(envLocal)) {
  dotenv.config({ path: envLocal })
}
const prodEnv = path.join(root, '.env.production')
if (fs.existsSync(prodEnv)) {
  dotenv.config({ path: prodEnv, override: false })
}

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'production'
}

// Swarm-only hostname does not resolve on the host OS. PgBouncer publishes 5433 on managers (see docker-stack-pgbouncer.yml).
if (
  process.env.DATABASE_URI?.includes('payload-postgres_postgres') &&
  process.env.DATABASE_URI_FALLBACK
) {
  process.env.DATABASE_URI = process.env.DATABASE_URI_FALLBACK
} else if (process.env.DATABASE_URI?.includes('payload-postgres_postgres')) {
  const pgbouncerPort = process.env.PGBOUNCER_PORT || '5433'
  const sslmode = process.env.PGSSLMODE || 'no-verify'
  process.env.DATABASE_URI = process.env.DATABASE_URI.replace(
    /payload-postgres_postgres:5432/,
    `127.0.0.1:${pgbouncerPort}`,
  )
  const sep = process.env.DATABASE_URI.includes('?') ? '&' : '?'
  if (!/sslmode=/.test(process.env.DATABASE_URI)) {
    process.env.DATABASE_URI += `${sep}sslmode=${sslmode}`
  }
}

const SITE_SLUG = process.env.SITE_SLUG || 'nexusguard'
const DRY = process.argv.includes('--dry-run')

function cmsBaseUrl(): string {
  return (
    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_PAYLOAD_URL ||
    'https://cms.xencolabs.com'
  ).replace(/\/$/, '')
}

type MediaDoc = {
  id: number
  filename?: string | null
  mimeType?: string | null
  alt?: string
}

/** List media via REST only (no DB) — used for --dry-run */
async function fetchSiteIdAndMediaDocs(): Promise<{ siteId: number; docs: MediaDoc[] }> {
  const base = cmsBaseUrl()
  const sitesRes = await fetch(
    `${base}/api/sites?where[slug][equals]=${encodeURIComponent(SITE_SLUG)}&limit=1&depth=0`,
  )
  if (!sitesRes.ok) throw new Error(`sites: ${sitesRes.status}`)
  const sitesJson = (await sitesRes.json()) as { docs?: { id: number }[] }
  const siteId = sitesJson.docs?.[0]?.id
  if (siteId == null) throw new Error(`Site not found for slug: ${SITE_SLUG}`)

  const docs: MediaDoc[] = []
  let page = 1
  const limit = 100
  while (true) {
    const u = `${base}/api/media?where[site][equals]=${siteId}&limit=${limit}&page=${page}&depth=0`
    const r = await fetch(u)
    if (!r.ok) throw new Error(`media page ${page}: ${r.status}`)
    const j = (await r.json()) as { docs?: MediaDoc[]; hasNextPage?: boolean }
    docs.push(...(j.docs || []))
    if (!j.hasNextPage) break
    page++
  }
  return { siteId, docs }
}

function filterRasterImages(docs: MediaDoc[]): MediaDoc[] {
  return docs.filter((doc) => {
    const mt = doc.mimeType || ''
    if (!mt.startsWith('image/')) return false
    if (mt === 'image/svg+xml') {
      console.warn(`Skip SVG (no raster pipeline): ${doc.filename}`)
      return false
    }
    return Boolean(doc.filename)
  })
}

async function main() {
  const baseUrl = cmsBaseUrl()

  if (DRY) {
    const { siteId, docs } = await fetchSiteIdAndMediaDocs()
    console.log(`Site: ${SITE_SLUG} (id=${siteId}) [dry-run via ${baseUrl}]`)
    const images = filterRasterImages(docs)
    console.log(`Found ${images.length} raster images for site (of ${docs.length} media total).`)
    for (const doc of images) {
      console.log(`[dry-run] would reprocess id=${doc.id} ${doc.filename}`)
    }
    console.log(
      '\nFull run: use a host that can reach Postgres (DATABASE_URI in .env.production). Example on Swarm manager:\n' +
        '  pnpm run media:regenerate-site-sizes',
    )
    process.exit(0)
  }

  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config.ts')

  const payload = await getPayload({ config })

  const sites = await payload.find({
    collection: 'sites',
    where: { slug: { equals: SITE_SLUG } },
    limit: 1,
    overrideAccess: true,
  })
  const site = sites.docs[0]
  if (!site?.id) {
    throw new Error(`Site not found for slug: ${SITE_SLUG}`)
  }
  const siteId = Number(site.id)
  console.log(`Site: ${SITE_SLUG} (id=${siteId})`)

  const media = await payload.find({
    collection: 'media',
    where: { site: { equals: siteId } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    pagination: false,
  })

  const images = filterRasterImages(media.docs as MediaDoc[])

  console.log(`Found ${images.length} raster images for site (of ${media.docs.length} media total).`)

  let ok = 0
  let failed = 0

  for (const doc of images) {
    const filename = doc.filename as string
    const fileUrl = `${baseUrl}/api/media/file/${encodeURIComponent(filename)}`
    try {
      const res = await fetch(fileUrl)
      if (!res.ok) {
        throw new Error(`GET ${fileUrl} -> ${res.status}`)
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const mime = doc.mimeType || res.headers.get('content-type') || 'application/octet-stream'

      await payload.update({
        collection: 'media',
        id: doc.id,
        data: {
          alt: doc.alt,
          site: siteId,
        },
        file: {
          data: buf,
          mimetype: mime,
          name: filename,
          size: buf.length,
        },
        overrideAccess: true,
        overwriteExistingFiles: true,
      })
      ok++
      console.log(`OK id=${doc.id} ${filename} (${(buf.length / 1024).toFixed(0)} KiB in)`)
    } catch (e) {
      failed++
      console.error(`FAIL id=${doc.id} ${filename}:`, e instanceof Error ? e.message : e)
    }
  }

  console.log(`Done. success=${ok} failed=${failed}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
