import type { Access, CollectionConfig, CollectionBeforeChangeHook, PayloadRequest } from 'payload'
import { resolveSiteForRequest } from '../lib/site'
import { siteScopedRead } from '../access/siteScopedRead'

const pathnameOf = (req: PayloadRequest): string => {
  const raw = (req as { url?: string }).url || ''
  try {
    return new URL(raw, 'http://internal').pathname
  } catch {
    return raw
  }
}

// Host scoping is right for the list endpoint but wrong for the binary route at
// /api/media/file/<filename>: pages that legitimately embed another property's
// image began 403ing once reads became host-scoped. Serving the bytes requires
// already knowing the exact filename, so exempting it enumerates nothing —
// listing, searching and filtering media stay scoped.
const mediaRead: Access = (args) => {
  if (/\/media\/file\//.test(pathnameOf(args.req))) return true
  return siteScopedRead(args)
}

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  // Preserve site on update if Admin omits it
  if (operation === 'update' && !data.site && (originalDoc as any)?.site) {
    data.site = (originalDoc as any).site
  }

  // Assign site on create if missing
  if (operation === 'create' && !data.site) {
    const site = await resolveSiteForRequest(req.payload, req.headers)
    if (site?.id) data.site = Number(site.id)
  }

  return data
}

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: mediaRead,
  },
  // Sharp is enabled globally in payload.config.ts; these options actually generate variants in R2.
  upload: {
    focalPoint: true,
    // Cap the stored “full” image width (still large enough for hero); avoids 15MB+ originals when possible.
    resizeOptions: {
      width: 2560,
      withoutEnlargement: true,
    },
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: 400,
        position: 'centre',
        // WebP at q80 — ~60-80KB vs ~330KB PNG for typical photos
        formatOptions: { format: 'webp', options: { quality: 80 } },
      },
      {
        name: 'card',
        width: 1200,
        height: 675,
        position: 'centre',
        // WebP at q82 — ~150-300KB vs ~1.6MB PNG for typical 2560px photos
        formatOptions: { format: 'webp', options: { quality: 82 } },
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        position: 'centre',
        // OG image: Facebook/Twitter accept WebP; higher quality for social sharing
        formatOptions: { format: 'webp', options: { quality: 85 } },
      },
    ],
    adminThumbnail: 'thumbnail',
  },
  hooks: {
    beforeChange: [beforeChange],
  },
  fields: [
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: false, // keep false initially so existing media rows don't break
      admin: { position: 'sidebar' },
      defaultValue: async ({ req }) => {
        const site = await resolveSiteForRequest(req.payload, req.headers)
        return site?.id ? Number(site.id) : undefined
      },
      index: true,
    },
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}
