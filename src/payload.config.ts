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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL =
  process.env.PAYLOAD_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_PAYLOAD_URL ||
  ''

export default buildConfig({
  serverURL,

  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
      // This ensures `payload generate:importmap` writes to a stable, committed path
      importMapFile: path.resolve(dirname, 'app', '(payload)', 'admin', 'importMap.js'),
    },
  },

  collections: [Users, Media, Articles, Categories, Tags],

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
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
