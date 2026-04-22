import type { CollectionConfig } from 'payload'

export const Vendors: CollectionConfig = {
  slug: 'vendors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'is_published', 'claim_status', 'hq_city', 'hq_state'],
    group: 'Compare ITAD',
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

    // Addendum 2 — public-facing data quality flags.
    // These render in the ProvenanceFooter on the profile page so readers
    // understand why a profile is thinner than others.
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
              'a footer notice that crawl was limited.',
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

    // Parent company / acquisition (addendum fields — paste immediately after provenance, before claim_status)
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

    // Addendum 2 — non-directory parent company (e.g. SK Group owning SK Tes).
    // Used when the parent is NOT itself an ITAD vendor in our directory.
    // Mutually exclusive with parent_company (relationship): the condition hides
    // this text field when a relationship is already set; relationship wins in UI.
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
