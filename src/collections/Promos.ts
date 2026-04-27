import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { resolveSiteForRequest } from '../lib/site'

const beforeChange: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  if (!data) return data

  // Resolve site if missing — promos always belong to a tenant.
  let siteId: string | null =
    typeof data.site === 'string' || typeof data.site === 'number'
      ? String(data.site)
      : (data.site as any)?.id
        ? String((data.site as any).id)
        : null

  if (!siteId && originalDoc && (originalDoc as any).site) {
    const orig = (originalDoc as any).site
    siteId =
      typeof orig === 'string' || typeof orig === 'number'
        ? String(orig)
        : orig?.id
          ? String(orig.id)
          : null
  }

  if (!siteId) {
    const site = await resolveSiteForRequest(req.payload, req.headers)
    if (!site?.id) throw new Error('No default site found. Create a Site with isDefault=true.')
    data.site = Number(site.id)
  }

  return data
}

export const Promos: CollectionConfig = {
  slug: 'promos',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'product', 'active', 'startDate', 'endDate', 'site'],
    group: 'Lexi Explains',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  hooks: {
    beforeChange: [beforeChange],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'product',
      type: 'select',
      options: [
        { label: 'BlogCraft', value: 'blogcraft' },
        { label: 'ResumeCoach', value: 'resumecoach' },
        { label: 'ImageCrafter', value: 'imagecrafter' },
        { label: 'DevMaestro', value: 'devmaestro' },
        { label: 'MCP Forge', value: 'mcpforge' },
        { label: 'HISATECH', value: 'hisatech' },
        { label: 'Other', value: 'other' },
      ],
    },
    { name: 'headline', type: 'text', required: true },
    { name: 'subhead', type: 'text' },
    { name: 'ctaText', type: 'text', required: true, defaultValue: 'Learn more' },
    { name: 'ctaUrl', type: 'text', required: true },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
    },
    // Modeled as an array of group items rather than `select hasMany` so it
    // maps cleanly onto the existing per-site array-table pattern used
    // elsewhere in this codebase (e.g. wineries_varietal_focus).
    {
      name: 'placement',
      type: 'array',
      admin: {
        description: 'Where this promo should appear. Add one row per slot.',
      },
      fields: [
        {
          name: 'slot',
          type: 'select',
          required: true,
          options: [
            { label: 'Homepage banner', value: 'home-banner' },
            { label: 'Sidebar (mid)', value: 'sidebar-mid' },
            { label: 'Sidebar (bottom)', value: 'sidebar-bottom' },
            { label: 'In-article', value: 'in-article' },
            { label: 'Newsletter footer', value: 'newsletter-footer' },
          ],
        },
      ],
    },
    {
      name: 'targetCategories',
      type: 'relationship',
      relationTo: 'categories',
      hasMany: true,
      admin: {
        description: 'Optional — show this promo only on episodes in these categories.',
      },
      filterOptions: ({ data }) => {
        const site = (data as any)?.site
        const siteId =
          typeof site === 'string' || typeof site === 'number'
            ? String(site)
            : site?.id
              ? String(site.id)
              : null
        if (!siteId) return true
        return { site: { equals: siteId } }
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar' },
    },
    { name: 'startDate', type: 'date', admin: { position: 'sidebar' } },
    { name: 'endDate', type: 'date', admin: { position: 'sidebar' } },
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      admin: { position: 'sidebar' },
      defaultValue: async ({ req }) => {
        const site = await resolveSiteForRequest(req.payload, req.headers)
        return site?.id ? Number(site.id) : undefined
      },
    },
  ],
}
