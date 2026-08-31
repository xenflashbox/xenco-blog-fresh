import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { resolveSiteForRequest } from '../lib/site'
import { ensureUniqueSlugForSite } from '../lib/uniqueSlug'
import { siteScopedRead } from '../access/siteScopedRead'

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const beforeChange: CollectionBeforeChangeHook = async ({
  data,
  req,
  originalDoc,
}) => {
  if (!data) return data

  if (typeof data.name === 'string' && (!data.slug || typeof data.slug !== 'string')) {
    data.slug = slugify(data.name)
  }

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
    siteId = String(site.id)
  }

  if (!siteId) throw new Error('Specialist.site is required.')

  if (typeof data.slug === 'string' && data.slug.trim()) {
    data.slug = await ensureUniqueSlugForSite({
      payload: req.payload,
      collection: 'specialists',
      siteId,
      desiredSlug: data.slug,
      currentId: originalDoc?.id ? String((originalDoc as any).id) : undefined,
    })
  }

  return data
}

export const Specialists: CollectionConfig = {
  slug: 'specialists',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'type', 'city', 'state', 'featuredTier', 'status', 'site'],
    group: 'Directory',
  },
  access: {
    read: siteScopedRead,
  },
  hooks: {
    beforeChange: [beforeChange],
  },
  fields: [
    // ── Site ──────────────────────────────────────────────────────────────────
    {
      name: 'site',
      type: 'relationship',
      relationTo: 'sites',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
      defaultValue: async ({ req }) => {
        const site = await resolveSiteForRequest(req.payload, req.headers)
        return site?.id ? Number(site.id) : undefined
      },
    },

    // ── Identity ──────────────────────────────────────────────────────────────
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Endocrinologist', value: 'endocrinologist' },
        { label: 'CDCES (Certified Diabetes Care & Education Specialist)', value: 'cdces' },
        { label: 'Diabetes Clinic', value: 'diabetes-clinic' },
        { label: 'Primary Care with Diabetes Focus', value: 'primary-care-with-diabetes-focus' },
        { label: 'Pediatric Endocrinologist', value: 'pediatric-endocrinologist' },
      ],
    },
    {
      name: 'credentials',
      type: 'text',
      admin: {
        description: 'e.g. "MD, FACE" or "RN, CDCES" — displayed after name',
      },
    },
    {
      name: 'npi',
      type: 'text',
      label: 'NPI Number',
      admin: {
        description: 'National Provider Identifier (10 digits) — used for verification and dedup against NPI Registry',
      },
    },

    // ── Practice info ─────────────────────────────────────────────────────────
    {
      name: 'practiceName',
      type: 'text',
      label: 'Practice Name',
      admin: {
        description: 'Practice or clinic name for individual specialists with an affiliation',
      },
    },
    {
      name: 'bio',
      type: 'richText',
      label: 'Bio / Description',
    },
    {
      name: 'yearsInPractice',
      type: 'number',
      label: 'Years in Practice',
    },
    {
      name: 'specialties',
      type: 'select',
      label: 'Specialties',
      hasMany: true,
      options: [
        { label: 'Type 1 Diabetes', value: 'type-1-diabetes' },
        { label: 'Type 2 Diabetes', value: 'type-2-diabetes' },
        { label: 'LADA', value: 'lada' },
        { label: 'MODY', value: 'mody' },
        { label: 'Type 3c', value: 'type-3c' },
        { label: 'Gestational Diabetes', value: 'gestational' },
        { label: 'Pediatric Diabetes', value: 'pediatric' },
        { label: 'Geriatric Diabetes', value: 'geriatric' },
        { label: 'Insulin Pump Management', value: 'insulin-pump-management' },
        { label: 'CGM Management', value: 'cgm-management' },
        { label: 'Diabetic Neuropathy', value: 'diabetic-neuropathy' },
        { label: 'Diabetic Retinopathy', value: 'diabetic-retinopathy' },
        { label: 'Diabetic Kidney Disease', value: 'diabetic-kidney-disease' },
        { label: 'Weight Management / GLP-1', value: 'weight-management-glp1' },
      ],
    },
    {
      name: 'languagesSpoken',
      type: 'array',
      label: 'Languages Spoken',
      fields: [
        { name: 'language', type: 'text', required: true },
      ],
    },
    {
      name: 'acceptingNewPatients',
      type: 'checkbox',
      label: 'Accepting New Patients',
      defaultValue: true,
    },
    {
      name: 'telehealthAvailable',
      type: 'checkbox',
      label: 'Telehealth Available',
      defaultValue: false,
    },

    // ── Location ──────────────────────────────────────────────────────────────
    {
      name: 'location',
      type: 'group',
      label: 'Location',
      fields: [
        { name: 'address1', type: 'text', label: 'Address Line 1' },
        { name: 'address2', type: 'text', label: 'Address Line 2' },
        { name: 'city', type: 'text', label: 'City', required: true },
        { name: 'state', type: 'text', label: 'State (2-char)', required: true },
        { name: 'zipCode', type: 'text', label: 'ZIP Code', required: true },
        { name: 'latitude', type: 'number', label: 'Latitude' },
        { name: 'longitude', type: 'number', label: 'Longitude' },
      ],
    },
    {
      name: 'regions',
      type: 'relationship',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      relationTo: 'regions' as any,
      hasMany: true,
      label: 'Regions',
      admin: {
        description: 'Tag to metro, state, and/or broad region for directory filtering',
      },
    },
    {
      name: 'phone',
      type: 'text',
    },
    {
      name: 'fax',
      type: 'text',
    },
    {
      name: 'websiteUrl',
      type: 'text',
      label: 'Website URL',
    },
    {
      name: 'bookingUrl',
      type: 'text',
      label: 'Booking / Scheduling URL',
    },

    // ── Insurance ─────────────────────────────────────────────────────────────
    {
      name: 'insuranceAccepted',
      type: 'array',
      label: 'Insurance Plans Accepted',
      fields: [
        { name: 'plan', type: 'text', required: true },
      ],
    },

    // ── Photos ────────────────────────────────────────────────────────────────
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      label: 'Primary Photo',
      admin: {
        description: 'Headshot for individuals, building photo for clinics',
      },
    },
    {
      name: 'photoGallery',
      type: 'array',
      label: 'Photo Gallery',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },

    // ── Listing tier (mirrors WCC Wineries pattern) ───────────────────────────
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'featuredTier',
      type: 'select',
      label: 'Featured Tier',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Flagship', value: 'flagship' },
        { label: 'Featured', value: 'featured' },
        { label: 'Standard', value: 'standard' },
      ],
    },
    {
      name: 'featuredOrder',
      type: 'number',
      label: 'Featured Order',
      admin: {
        position: 'sidebar',
        description: 'Sort order within tier (lower = earlier)',
      },
    },
    {
      name: 'claimedByOwner',
      type: 'checkbox',
      label: 'Claimed by Owner',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'True once the specialist has verified and claimed their listing',
      },
    },
    {
      name: 'verifiedDate',
      type: 'date',
      label: 'Verified Date',
      admin: {
        position: 'sidebar',
        description: 'When verified against NPI Registry or state board',
      },
    },

    // ── Editorial ─────────────────────────────────────────────────────────────
    {
      name: 'editorialNote',
      type: 'richText',
      label: 'Editorial Note',
      admin: {
        description: 'DiabetesCompass team notes on why this specialist is recommended (visible on flagship/featured listings only)',
      },
    },
    {
      name: 'patientReviewSummary',
      type: 'richText',
      label: 'Patient Review Summary',
      admin: {
        description: 'Anonymized summary of patient feedback — manual editorial, not user-submitted reviews',
      },
    },

    // ── System ────────────────────────────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Published At',
      admin: { position: 'sidebar' },
    },
    {
      name: 'dataSource',
      type: 'select',
      label: 'Data Source',
      admin: { position: 'sidebar' },
      options: [
        { label: 'NPI Registry', value: 'npi-registry' },
        { label: 'Manual Entry', value: 'manual-entry' },
        { label: 'Claimed by Specialist', value: 'claimed' },
        { label: 'Imported', value: 'imported' },
      ],
    },
  ],
  timestamps: true,
}
