import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { resolveSiteForRequest } from '../lib/site'

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
    read: () => true,
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
      },
      {
        name: 'card',
        width: 1200,
        height: 675,
        position: 'centre',
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        position: 'centre',
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
