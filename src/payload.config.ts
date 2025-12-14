import path from 'path'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Articles } from './collections/Articles'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },

  collections: [Users, Media, Articles, Categories, Tags],

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || '',

  // Helps Payload generate correct absolute URLs (recommended on Vercel)
  serverURL: process.env.PAYLOAD_PUBLIC_SERVER_URL || process.env.NEXT_PUBLIC_PAYLOAD_URL || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  db: postgresAdapter({
    pool: {
      // Supports either env name (you have DATABASE_URL in Vercel env, but some scaffolds use DATABASE_URI)
      connectionString: process.env.DATABASE_URI || process.env.DATABASE_URL || '',
    },
  }),

  plugins: [
    // Cloudflare R2 via S3-compatible adapter
    s3Storage({
      collections: {
        media: {
          prefix: 'media',
          generateFileURL: ({ filename, prefix }) => {
            const base = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
            const p = prefix ? `${prefix}` : 'media'
            return `${base}/${p}/${filename}`
          },
        },
      },

      bucket: process.env.R2_BUCKET || '',

      config: {
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT || '',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
        },
      },
    }),
  ],

  sharp,
})
