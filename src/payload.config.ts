import path from 'path'
import sharp from 'sharp'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { migrations } from './migrations'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Sites } from './collections/Sites'
import { Articles } from './collections/Articles'
import { Authors } from './collections/Authors'
import { Categories } from './collections/Categories'
import { Tags } from './collections/Tags'
import { SupportKBArticles } from './collections/SupportKBArticles'
import { SupportPlaybooks } from './collections/SupportPlaybooks'
import { SupportAnnouncements } from './collections/SupportAnnouncements'
import { reindexArticlesEndpoint } from './endpoints/reindexArticles'
import { searchArticlesEndpoint } from './endpoints/searchArticles'
import { backfillArticleSitesEndpoint } from './endpoints/backfillArticleSites'
import {
  meiliConfigureEndpoint,
  meiliResyncEndpoint,
  meiliStatusEndpoint,
} from './endpoints/meiliAdmin'
import {
  meiliSupportConfigureEndpoint,
  meiliSupportResyncEndpoint,
  meiliSupportStatusEndpoint,
} from './endpoints/meiliSupportAdmin'
import {
  supportTicketEndpoint,
  supportAnswerEndpoint,
  supportHealthEndpoint,
  supportUptimeEndpoint,
  supportDocEndpoint,
  supportTelemetryEndpoint,
  supportTriageEndpoint,
  supportAutofixEndpoint,
  supportAdminTicketsListEndpoint,
  supportAdminTicketDetailEndpoint,
  supportAdminTicketUpdateEndpoint,
  supportAdminTriageReportsEndpoint,
  supportAdminEventsListEndpoint,
} from './endpoints/support'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const dbURI = process.env.DATABASE_URI
if (!dbURI) {
  throw new Error('Missing DATABASE_URI in runtime environment (Vercel)')
}
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

  collections: [
    Users,
    Media,
    Sites,
    Articles,
    Authors,
    Categories,
    Tags,
    SupportKBArticles,
    SupportPlaybooks,
    SupportAnnouncements,
  ],

  endpoints: [
    reindexArticlesEndpoint,
    searchArticlesEndpoint,
    backfillArticleSitesEndpoint,
    meiliConfigureEndpoint,
    meiliResyncEndpoint,
    meiliStatusEndpoint,
    meiliSupportConfigureEndpoint,
    meiliSupportResyncEndpoint,
    meiliSupportStatusEndpoint,
    supportTicketEndpoint,
    supportAnswerEndpoint,
    supportHealthEndpoint,
    supportUptimeEndpoint,
    supportDocEndpoint,
    supportTelemetryEndpoint,
    supportTriageEndpoint,
    supportAutofixEndpoint,
    // Admin endpoints (protected by SUPPORT_ADMIN_TOKEN)
    supportAdminTicketsListEndpoint,
    supportAdminTicketDetailEndpoint,
    supportAdminTicketUpdateEndpoint,
    supportAdminTriageReportsEndpoint,
    supportAdminEventsListEndpoint,
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
    prodMigrations: migrations,
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

    // Hierarchical categories (parent/child with breadcrumbs)
    nestedDocsPlugin({
      collections: ['categories'],
      generateLabel: (docs) =>
        docs.map((doc) => doc.title).join(' > '),
      generateURL: (docs) =>
        docs.map((doc) => doc.slug).join('/'),
    }),
  ],

  sharp,
})
