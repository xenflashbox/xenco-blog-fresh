import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

// Auto-set editorial_summary_last_reviewed when status transitions to 'published'.
const autoSetLastReviewed: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
  const wasPublished = (originalDoc as Record<string, any>)?.editorial?.summary_status === 'published'
  const nowPublished = (data as Record<string, any>)?.editorial?.summary_status === 'published'
  if (nowPublished && !wasPublished && !(data as Record<string, any>)?.editorial?.summary_last_reviewed) {
    ;(data as Record<string, any>).editorial = {
      ...(data as Record<string, any>).editorial,
      summary_last_reviewed: new Date().toISOString(),
    }
  }
  return data
}

export const Vendors: CollectionConfig = {
  slug: 'vendors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'slug',
      'is_published',
      'editorial_summary_status',
      'has_verified_certifications',
      'claim_status',
      'hq_city',
      'hq_state',
    ],
    group: 'Compare ITAD',
  },
  hooks: {
    beforeChange: [autoSetLastReviewed],
  },
  access: {
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'website', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'hq_city', type: 'text' },
    { name: 'hq_state', type: 'text' },
    { name: 'hq_country', type: 'text', defaultValue: 'US' },
    { name: 'phone', type: 'text' },
    { name: 'email', type: 'email' },
    { name: 'founded_year', type: 'number' },
    { name: 'employee_count_range', type: 'text' },
    {
      name: 'industries_served',
      type: 'relationship',
      relationTo: 'industries',
      hasMany: true,
    },

    // ── EDITORIAL ASSESSMENT ────────────────────────────────────────────────────
    // Owned by the editorial team (Marcus's voice). Fields are nullable until
    // editorial completes the assessment. The 'Our Take' section on the public
    // profile renders only when editorial_summary_status === 'published'.
    {
      name: 'editorial',
      type: 'group',
      admin: {
        description:
          'Editorial assessment section. Owned and maintained by the editorial team. ' +
          'The public profile renders the "Our Take" block only when summary_status is set ' +
          'to "Published". Draft and Needs Review content is never exposed to the frontend.',
      },
      fields: [
        {
          name: 'canonical_descriptor',
          type: 'text',
          admin: {
            description:
              'Single-line descriptor written by editorial. Renders as the subhead under ' +
              'the vendor name on the profile page. NOT the vendor\'s tagline. Max 120 chars.',
          },
          validate: (value: string | null | undefined): true | string => {
            if (value && value.length > 120) {
              return `Canonical descriptor must be 120 characters or fewer (current: ${value.length}).`
            }
            return true
          },
        },
        {
          name: 'summary',
          type: 'richText',
          editor: lexicalEditor({}),
          admin: {
            description:
              '100–300 word factual editorial assessment in Marcus\'s voice. Comparative ' +
              'positioning, strengths, gaps, fit for buyer profile. See the editorial ' +
              'standards doc for register and constraints.',
          },
        },
        {
          name: 'summary_status',
          type: 'select',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' },
            { label: 'Needs Review', value: 'needs-review' },
          ],
          defaultValue: 'draft',
          index: true,
          admin: {
            description:
              'Controls whether the "Our Take" section renders on the public profile. ' +
              'Frontend renders the section only when status is "Published". Transition ' +
              'to Published also auto-sets Summary Last Reviewed to today\'s date.',
          },
        },
        {
          name: 'summary_reviewer',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            description:
              'Editorial team member who last reviewed and approved the summary. ' +
              'Should be set before transitioning status to "Published".',
          },
        },
        {
          name: 'summary_last_reviewed',
          type: 'date',
          admin: {
            description:
              'Auto-set to today when status transitions to "Published". Can be manually ' +
              'updated on re-review without changing status (e.g., after a factual accuracy check).',
            date: { displayFormat: 'MMM d, yyyy' },
          },
        },
        {
          name: 'industry_notes',
          type: 'richText',
          editor: lexicalEditor({}),
          admin: {
            description:
              'Optional editorial note about vertical-specific specialization (single paragraph). ' +
              'Renders as a trailing line below the Industries Served section on the public profile.',
          },
        },
      ],
    },

    // ── GEOGRAPHIC COVERAGE ─────────────────────────────────────────────────────
    {
      name: 'coverage_area',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Northeast', value: 'northeast' },
        { label: 'Southeast', value: 'southeast' },
        { label: 'Midwest', value: 'midwest' },
        { label: 'Southwest', value: 'southwest' },
        { label: 'West', value: 'west' },
        { label: 'National', value: 'national' },
        { label: 'Global', value: 'global' },
        { label: 'Regional — specify states', value: 'regional-specify' },
      ],
      admin: {
        description:
          'Geographic coverage tiers. Select "Regional — specify states" to enable ' +
          'the Regional States field below for precise state/province listing.',
      },
    },
    {
      name: 'regional_states',
      type: 'array',
      admin: {
        description:
          'US states and Canadian provinces served. Activate by selecting "Regional — specify ' +
          'states" in Coverage Area above.',
        condition: (data) =>
          Array.isArray(data?.coverage_area) && data.coverage_area.includes('regional-specify'),
      },
      fields: [
        {
          name: 'state_code',
          type: 'select',
          required: true,
          options: [
            // US States
            { label: 'Alabama', value: 'AL' },
            { label: 'Alaska', value: 'AK' },
            { label: 'Arizona', value: 'AZ' },
            { label: 'Arkansas', value: 'AR' },
            { label: 'California', value: 'CA' },
            { label: 'Colorado', value: 'CO' },
            { label: 'Connecticut', value: 'CT' },
            { label: 'Delaware', value: 'DE' },
            { label: 'Florida', value: 'FL' },
            { label: 'Georgia', value: 'GA' },
            { label: 'Hawaii', value: 'HI' },
            { label: 'Idaho', value: 'ID' },
            { label: 'Illinois', value: 'IL' },
            { label: 'Indiana', value: 'IN' },
            { label: 'Iowa', value: 'IA' },
            { label: 'Kansas', value: 'KS' },
            { label: 'Kentucky', value: 'KY' },
            { label: 'Louisiana', value: 'LA' },
            { label: 'Maine', value: 'ME' },
            { label: 'Maryland', value: 'MD' },
            { label: 'Massachusetts', value: 'MA' },
            { label: 'Michigan', value: 'MI' },
            { label: 'Minnesota', value: 'MN' },
            { label: 'Mississippi', value: 'MS' },
            { label: 'Missouri', value: 'MO' },
            { label: 'Montana', value: 'MT' },
            { label: 'Nebraska', value: 'NE' },
            { label: 'Nevada', value: 'NV' },
            { label: 'New Hampshire', value: 'NH' },
            { label: 'New Jersey', value: 'NJ' },
            { label: 'New Mexico', value: 'NM' },
            { label: 'New York', value: 'NY' },
            { label: 'North Carolina', value: 'NC' },
            { label: 'North Dakota', value: 'ND' },
            { label: 'Ohio', value: 'OH' },
            { label: 'Oklahoma', value: 'OK' },
            { label: 'Oregon', value: 'OR' },
            { label: 'Pennsylvania', value: 'PA' },
            { label: 'Rhode Island', value: 'RI' },
            { label: 'South Carolina', value: 'SC' },
            { label: 'South Dakota', value: 'SD' },
            { label: 'Tennessee', value: 'TN' },
            { label: 'Texas', value: 'TX' },
            { label: 'Utah', value: 'UT' },
            { label: 'Vermont', value: 'VT' },
            { label: 'Virginia', value: 'VA' },
            { label: 'Washington', value: 'WA' },
            { label: 'West Virginia', value: 'WV' },
            { label: 'Wisconsin', value: 'WI' },
            { label: 'Wyoming', value: 'WY' },
            { label: 'Washington DC', value: 'DC' },
            // Canadian Provinces
            { label: 'Alberta', value: 'AB' },
            { label: 'British Columbia', value: 'BC' },
            { label: 'Manitoba', value: 'MB' },
            { label: 'New Brunswick', value: 'NB' },
            { label: 'Newfoundland and Labrador', value: 'NL' },
            { label: 'Nova Scotia', value: 'NS' },
            { label: 'Ontario', value: 'ON' },
            { label: 'Prince Edward Island', value: 'PE' },
            { label: 'Quebec', value: 'QC' },
            { label: 'Saskatchewan', value: 'SK' },
          ],
        },
      ],
    },

    // ── NOTABLE CLIENTS ─────────────────────────────────────────────────────────
    {
      name: 'notable_clients',
      type: 'array',
      admin: {
        description:
          'Notable clients. A client renders on the public profile only when ' +
          '"Publicly Disclosed" is checked AND a disclosure source URL is provided. ' +
          'Self-reported client lists without a verifiable source never appear publicly.',
      },
      fields: [
        {
          name: 'client_name',
          type: 'text',
          required: true,
          admin: {
            description: 'Client or organization name.',
          },
        },
        {
          name: 'is_publicly_disclosed',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Check only when the client relationship is confirmed by a public source ' +
              '(press release, case study, public contract, etc.). Do not check for ' +
              'self-reported client lists on vendor websites.',
          },
        },
        {
          name: 'disclosure_source_url',
          type: 'text',
          admin: {
            description:
              'URL of the public source confirming this client relationship. Required ' +
              'for the client to appear on the public profile. Leave blank for ' +
              'self-reported / unverified clients.',
            condition: (_data, siblingData) => Boolean(siblingData?.is_publicly_disclosed),
          },
        },
      ],
    },

    // ── VERIFICATION BADGE FLAGS ────────────────────────────────────────────────
    // has_verified_certifications: stored boolean, auto-computed by an afterChange
    // hook on VendorCertifications. Drives the "Verified Certifications" badge.
    //
    // is_editorially_reviewed: derived by frontend from editorial.summary_status === 'published'.
    // is_self_reported_only:   derived by frontend from !has_verified_certifications && !is_editorially_reviewed.
    // is_bot_blocked:          derived by frontend from data_quality_flags.bot_protection_limited_crawl.
    //
    // The three derived flags do not need to be stored — the frontend computes them
    // from existing fields without extra queries.
    {
      name: 'has_verified_certifications',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description:
          'Auto-computed. True when one or more vendor-certification records for this ' +
          'vendor have verification_status = "verified". Updated automatically when ' +
          'certifications are saved or deleted. Do not edit manually.',
      },
    },

    // ── PUBLISHING & STATUS ──────────────────────────────────────────────────────
    {
      name: 'is_published',
      type: 'checkbox',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    {
      name: 'claim_status',
      type: 'select',
      options: [
        { label: 'Unclaimed', value: 'unclaimed' },
        { label: 'Pending Claim', value: 'pending-claim' },
        { label: 'Claimed', value: 'claimed' },
      ],
      defaultValue: 'unclaimed',
      admin: { position: 'sidebar' },
    },

    // ── PROVENANCE ───────────────────────────────────────────────────────────────
    {
      name: 'provenance',
      type: 'group',
      fields: [
        { name: 'primary_source_url', type: 'text' },
        { name: 'crawled_at', type: 'date' },
        { name: 'last_verified_at', type: 'date' },
        { name: 'crawler_version', type: 'text' },
        { name: 'verification_notes', type: 'textarea' },
      ],
    },

    // ── DATA QUALITY FLAGS ───────────────────────────────────────────────────────
    // Public-facing transparency context for the provenance footer.
    {
      name: 'data_quality_flags',
      type: 'group',
      admin: {
        description:
          'Public-facing data quality context. These flags render in the ' +
          'provenance footer on the profile page so readers understand why ' +
          'a profile has less information than others.',
      },
      fields: [
        {
          name: 'sparse_data',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              "Check when the vendor's public website provides minimal self-reported " +
              'data (e.g., OEM ITAD arms with marketing-heavy pages). Triggers a ' +
              'footer notice explaining why this profile is thinner than others.',
          },
        },
        {
          name: 'awaiting_re_verification',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              "Check when the profile's last_verified_at is older than 90 days " +
              'or when editorial is aware of pending vendor changes. Triggers a ' +
              'footer notice that the profile is pending review.',
          },
        },
        {
          name: 'bot_protection_limited_crawl',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              "Check when the vendor's website uses aggressive bot protection that " +
              'limited our automated crawl (e.g., Cloudflare challenges, Blue Star ' +
              'Recycling situation). Profile content is human-verified only. Triggers ' +
              'a footer notice that crawl was limited. Also surfaces as the is_bot_blocked ' +
              'transparency badge on the public profile.',
          },
        },
        {
          name: 'editor_note',
          type: 'textarea',
          admin: {
            description:
              'Optional editor-written note that appears in the footer when any of ' +
              'the above flags are true. Example: "This profile reflects publicly ' +
              'available information from the vendor\'s corporate website. Extended ' +
              'service details were not available on the pages crawled."',
          },
        },
      ],
    },

    // ── PARENT COMPANY / ACQUISITION ─────────────────────────────────────────────
    {
      name: 'parent_company',
      type: 'relationship',
      relationTo: 'vendors',
      hasMany: false,
      admin: {
        description: 'Set when this vendor is a known subsidiary of another ITAD company.',
      },
    },
    {
      name: 'acquisition',
      type: 'group',
      admin: {
        description: 'Populate once parent_company is set.',
        condition: (data) => Boolean(data?.parent_company),
      },
      fields: [
        { name: 'acquired_date', type: 'date' },
        { name: 'announcement_url', type: 'text' },
        {
          name: 'subsidiary_status',
          type: 'select',
          options: [
            { label: 'Operating as Brand', value: 'operating-as-brand' },
            { label: 'Merged Into Parent', value: 'merged-into-parent' },
            { label: 'Winding Down', value: 'winding-down' },
          ],
        },
        { name: 'acquired_entity_notes', type: 'textarea' },
      ],
    },
    {
      name: 'parent_company_text',
      type: 'text',
      admin: {
        description:
          'For cases where the parent company is NOT in the Compare ITAD directory ' +
          '(e.g., a non-ITAD conglomerate parent like SK Group owning SK Tes). Use ' +
          'this instead of parent_company when the parent should not be a clickable ' +
          'directory link. If both fields are populated, parent_company (the ' +
          'relationship) takes precedence in the UI.',
        condition: (data) => !data.parent_company,
      },
    },
    {
      name: 'parent_company_text_notes',
      type: 'textarea',
      admin: {
        description:
          "Context for the parent_company_text relationship. Example: \"SK Group is a " +
          "South Korean industrial conglomerate; SK Tes is the ITAD operating unit " +
          "following SK Ecoplant's acquisition of TES in 2022.\" This renders below " +
          'the parent company name on the profile page.',
        condition: (data) => Boolean(data.parent_company_text),
      },
    },

    // ── SEO ──────────────────────────────────────────────────────────────────────
    {
      name: 'seo',
      type: 'group',
      fields: [
        { name: 'meta_title', type: 'text' },
        { name: 'meta_description', type: 'textarea' },
      ],
    },
  ],
}
