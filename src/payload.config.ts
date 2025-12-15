import path from 'path'
import sharp from 'sharp'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Articles } from './collections/Articles'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { getMeiliClient, toMeiliArticleDoc } from './lib/meili'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const dbURI = process.env.DATABASE_URI
if (!dbURI) {
  throw new Error('Missing DATABASE_URI in runtime environment (Vercel)')
}

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
//const serverURL =
//  process.env.PAYLOAD_PUBLIC_SERVER_URL ||
//  process.env.NEXT_PUBLIC_PAYLOAD_URL ||
//  ''

export default buildConfig({
  //serverURL,

  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
      // This ensures `payload generate:importmap` writes to a stable, committed path
      importMapFile: path.resolve(dirname, 'app', '(payload)', 'admin', 'importMap.js'),
    },
  },

  collections: [Users, Media, Articles, Categories, Tags],

  endpoints: [
    {
      path: '/reindex/articles',
      method: 'post',
      handler: async ({ payload, req }) => {
        const headers: any = (req as any)?.headers
        const apiKey =
          typeof headers?.get === 'function'
            ? headers.get('x-api-key')
            : headers?.['x-api-key'] ?? headers?.['X-Api-Key']

        if (!apiKey || apiKey !== process.env.REINDEX_API_KEY) {
          return json({ ok: false, error: 'Unauthorized' }, 401)
        }

        const meili = getMeiliClient()
        if (!meili) {
          return json(
            { ok: false, error: 'MeiliSearch not configured (MEILISEARCH_HOST/KEY missing)' },
            500,
          )
        }

        const indexName = process.env.MEILISEARCH_ARTICLES_INDEX || 'articles'
        const index = meili.index(indexName)

        const limit = 100
        let page = 1
        let indexed = 0

        while (true) {
          const res = await payload.find({
            collection: 'articles',
            where: { status: { equals: 'published' } },
            limit,
            page,
            depth: 0,
            overrideAccess: true,
          })

          if (!res.docs?.length) break

          const docs = res.docs.map(toMeiliArticleDoc).filter(Boolean) as any[]
          if (docs.length) {
            await index.updateDocuments(docs)
            indexed += docs.length
          }

          if (page >= (res.totalPages ?? 1)) break
          page++
        }

        return json({ ok: true, indexed })
      },
    },
  ],

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  db: postgresAdapter({
    pool: {
      connectionString: dbURI,
    },
  }),

  plugins: [
    s3Storage({
      // Vercel server uploads are capped (~4.5MB). Client uploads bypass that. :contentReference[oaicite:2]{index=2}
      clientUploads: true,

      collections: {
        media: {
          prefix: 'media',
        },
      },

      bucket: process.env.R2_BUCKET || '',

      config: {
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT || '',
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
        // Commonly needed for S3-compatible endpoints (including many R2 setups)
        forcePathStyle: true,
      },
    }),
  ],

  sharp,
})
