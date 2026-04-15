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
import { InternalLinkRules } from './collections/InternalLinkRules'
import { InternalLinkEdges } from './collections/InternalLinkEdges'
import { InternalLinkRuns } from './collections/InternalLinkRuns'
import { Suites } from './collections/Suites'
import { Reviews } from './collections/Reviews'
import { DirectoryEntries } from './collections/DirectoryEntries'
import { Events } from './collections/Events'
import { Wineries } from './collections/Wineries'
import { Wines } from './collections/Wines'
import { Restaurants } from './collections/Restaurants'
import { Accommodations } from './collections/Accommodations'
import { WineryEvents } from './collections/WineryEvents'
import { reindexArticlesEndpoint } from './endpoints/reindexArticles'
import { searchArticlesEndpoint } from './endpoints/searchArticles'
import { backfillArticleSitesEndpoint } from './endpoints/backfillArticleSites'
import { internalLinksRunEndpoint } from './endpoints/internalLinksRun'
import { internalLinksRunStatusEndpoint } from './endpoints/internalLinksRunStatus'
import { internalLinksRevertEndpoint } from './endpoints/internalLinksRevert'
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
  throw new Error('Missing DATABASE_URI in runtime environment (set DATABASE_URI for Docker Swarm / production)')
}

const serverURL =
  process.env.PAYLOAD_PUBLIC_SERVER_URL ||
  process.env.NEXT_PUBLIC_PAYLOAD_URL ||
  ''

// All frontend domains that are allowed to call the CMS API from a browser.
// Includes the cms.* subdomains (admin) and the root production domains (frontends).
const allowedOrigins = [
  // CMS admin subdomains
  'https://cms.xencolabs.com',
  'https://publish.xencolabs.com',
  'https://cms.aer-worldwide.com',
  'https://cms.blogcraft.app',
  'https://cms.devmaestro.io',
  'https://cms.diabetescompass.com',
  'https://cms.fiberinsider.com',
  'https://cms.fightclubtech.com',
  'https://cms.fightmybank.com',
  'https://cms.homebeautyspa.com',
  'https://cms.imagecrafter.app',
  'https://cms.isthisagoodjob.com',
  'https://cms.landingcraft.app',
  'https://cms.landlordhell.com',
  'https://cms.legalcraft.app',
  'https://cms.lexiexplains.com',
  'https://cms.mcpforge.org',
  'https://cms.nexusguard.dev',
  'https://cms.planaheaddaily.com',
  'https://cms.promptmarketer.app',
  'https://cms.renterandlandlord.com',
  'https://cms.resumecoach.me',
  'https://cms.snackabletiktok.com',
  'https://cms.sonomagrovesuites.com',
  'https://cms.tinatortoise.com',
  'https://cms.winecountrycorner.com',
  // Frontend production domains
  'https://planaheaddaily.com',
  'https://www.planaheaddaily.com',
  'https://winecountrycorner.com',
  'https://www.winecountrycorner.com',
  'https://promptmarketer.app',
  'https://www.promptmarketer.app',
  'https://resumecoach.me',
  'https://www.resumecoach.me',
  'https://fiberinsider.com',
  'https://www.fiberinsider.com',
  'https://sonomagrovesuites.com',
  'https://www.sonomagrovesuites.com',
  'https://snackabletiktok.com',
  'https://www.snackabletiktok.com',
  'https://fightclubtech.com',
  'https://www.fightclubtech.com',
  'https://aer-worldwide.com',
  'https://www.aer-worldwide.com',
  'https://blogcraft.app',
  'https://www.blogcraft.app',
  'https://diabetescompass.com',
  'https://www.diabetescompass.com',
  'https://fightmybank.com',
  'https://www.fightmybank.com',
  'https://homebeautyspa.com',
  'https://www.homebeautyspa.com',
  'https://landlordhell.com',
  'https://www.landlordhell.com',
  'https://legalcraft.app',
  'https://www.legalcraft.app',
  'https://lexiexplains.com',
  'https://www.lexiexplains.com',
  'https://mcpforge.org',
  'https://www.mcpforge.org',
  'https://renterandlandlord.com',
  'https://www.renterandlandlord.com',
  'https://tinatortoise.com',
  'https://www.tinatortoise.com',
  'https://xencolabs.com',
  'https://www.xencolabs.com',
]

export default buildConfig({
  ...(serverURL ? { serverURL } : {}),

  cors: allowedOrigins,

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
    InternalLinkRules,
    InternalLinkEdges,
    InternalLinkRuns,
    Suites,
    Reviews,
    DirectoryEntries,
    Events,
    Wineries,
    Wines,
    Restaurants,
    Accommodations,
    WineryEvents,
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
    internalLinksRunEndpoint,
    internalLinksRunStatusEndpoint,
    internalLinksRevertEndpoint,
  ],

  editor: lexicalEditor(),

  secret: process.env.PAYLOAD_SECRET || '',

  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },

  db: postgresAdapter({
    pool: {
      connectionString: dbURI,
      min: 0,                        // Don't keep idle connections (critical for scale-to-zero)
      max: 10,                       // Cap concurrent connections
      idleTimeoutMillis: 10000,      // Close idle connections after 10 seconds
      allowExitOnIdle: true,         // Let serverless functions exit cleanly
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
