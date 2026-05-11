// scripts/seed-citad-categories-tags.ts
// Seeds categories (7) and tags (92) for the Compare It Ad site (site_id = 48).
// Run with: npx tsx scripts/seed-citad-categories-tags.ts

// Uses the pg package bundled with @payloadcms/db-postgres
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('/home/xen/docker/apps/payload-swarm/node_modules/.pnpm/pg@8.16.3/node_modules/pg')

const DATABASE_URL =
  process.env.DATABASE_URI ||
  'postgresql://payload:payload_db_secure_2025@payload-postgres_postgres:5432/payload'

const SITE_ID = 48 // Compare It Ad

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    slug: 'compliance-regulation',
    title: 'Compliance & Regulation',
    url_segment: '/compliance',
    description:
      'Regulatory requirements and audit frameworks that apply to IT asset disposition across industries.',
    sort_order: 1,
  },
  {
    slug: 'data-security-destruction',
    title: 'Data Security & Destruction',
    url_segment: '/data-security',
    description:
      'Technical content on data destruction methods, NIST and IEEE standards, and chain-of-custody documentation.',
    sort_order: 2,
  },
  {
    slug: 'vendor-selection',
    title: 'Vendor Selection & Due Diligence',
    url_segment: '/vendor-selection',
    description: 'How to evaluate, contract with, and manage ITAD vendors.',
    sort_order: 3,
  },
  {
    slug: 'value-recovery',
    title: 'Value Recovery & Financial',
    url_segment: '/value-recovery',
    description:
      'Remarketing, residual value, depreciation, and the financial economics of ITAD programs.',
    sort_order: 4,
  },
  {
    slug: 'risk-liability',
    title: 'Risk & Liability',
    url_segment: '/risk-liability',
    description:
      'Enforcement actions, cyber insurance, governance, and managing ITAD-related business risk.',
    sort_order: 5,
  },
  {
    slug: 'sustainability-esg',
    title: 'Sustainability & ESG',
    url_segment: '/sustainability',
    description:
      'Scope 3 emissions, e-waste law, circular economy, and ESG disclosure requirements.',
    sort_order: 6,
  },
  {
    slug: 'news-analysis',
    title: 'News & Analysis',
    url_segment: '/news',
    description:
      'Industry news, M&A coverage, earnings analysis, and commentary on events shaping the ITAD market.',
    sort_order: 7,
  },
]

// ── Tags ──────────────────────────────────────────────────────────────────────

const TAGS: { slug: string; name: string; group: string }[] = [
  // industry (17)
  { slug: 'healthcare', name: 'Healthcare', group: 'industry' },
  { slug: 'financial-services', name: 'Financial Services', group: 'industry' },
  { slug: 'federal-government', name: 'Federal Government', group: 'industry' },
  { slug: 'state-local-government', name: 'State & Local Government', group: 'industry' },
  { slug: 'higher-education', name: 'Higher Education', group: 'industry' },
  { slug: 'k-12-education', name: 'K–12 Education', group: 'industry' },
  { slug: 'retail', name: 'Retail', group: 'industry' },
  { slug: 'manufacturing', name: 'Manufacturing', group: 'industry' },
  { slug: 'technology', name: 'Technology', group: 'industry' },
  { slug: 'energy-utilities', name: 'Energy & Utilities', group: 'industry' },
  { slug: 'telecommunications', name: 'Telecommunications', group: 'industry' },
  { slug: 'transportation', name: 'Transportation', group: 'industry' },
  { slug: 'automotive', name: 'Automotive', group: 'industry' },
  { slug: 'electronics', name: 'Electronics', group: 'industry' },
  { slug: 'legal', name: 'Legal', group: 'industry' },
  { slug: 'nonprofit', name: 'Nonprofit', group: 'industry' },
  { slug: 'defense-aerospace', name: 'Defense & Aerospace', group: 'industry' },

  // persona (11)
  { slug: 'ciso', name: 'CISO', group: 'persona' },
  { slug: 'cfo', name: 'CFO', group: 'persona' },
  { slug: 'general-counsel', name: 'General Counsel', group: 'persona' },
  { slug: 'compliance-officer', name: 'Compliance Officer', group: 'persona' },
  { slug: 'it-procurement', name: 'IT Procurement', group: 'persona' },
  { slug: 'it-asset-manager', name: 'IT Asset Manager', group: 'persona' },
  { slug: 'facilities', name: 'Facilities', group: 'persona' },
  { slug: 'chief-sustainability-officer', name: 'Chief Sustainability Officer', group: 'persona' },
  { slug: 'esg-team', name: 'ESG Team', group: 'persona' },
  { slug: 'internal-audit', name: 'Internal Audit', group: 'persona' },
  { slug: 'risk-management', name: 'Risk Management', group: 'persona' },

  // regulation (16)
  { slug: 'hipaa', name: 'HIPAA', group: 'regulation' },
  { slug: 'hitech', name: 'HITECH', group: 'regulation' },
  { slug: 'glba', name: 'GLBA', group: 'regulation' },
  { slug: 'sox', name: 'SOX', group: 'regulation' },
  { slug: 'pci-dss', name: 'PCI-DSS', group: 'regulation' },
  { slug: 'ferpa', name: 'FERPA', group: 'regulation' },
  { slug: 'coppa', name: 'COPPA', group: 'regulation' },
  { slug: 'gdpr', name: 'GDPR', group: 'regulation' },
  { slug: 'ccpa', name: 'CCPA', group: 'regulation' },
  { slug: 'nist-800-88', name: 'NIST SP 800-88', group: 'regulation' },
  { slug: 'cmmc', name: 'CMMC 2.0', group: 'regulation' },
  { slug: 'fedramp', name: 'FedRAMP', group: 'regulation' },
  { slug: 'fisma', name: 'FISMA', group: 'regulation' },
  { slug: 'itar', name: 'ITAR', group: 'regulation' },
  { slug: 'sb-253', name: 'California SB 253', group: 'regulation' },
  { slug: 'csrd', name: 'EU CSRD', group: 'regulation' },

  // certification (9)
  { slug: 'r2v3', name: 'R2v3', group: 'certification' },
  { slug: 'naid-aaa', name: 'NAID AAA', group: 'certification' },
  { slug: 'e-stewards', name: 'e-Stewards', group: 'certification' },
  { slug: 'iso-14001', name: 'ISO 14001', group: 'certification' },
  { slug: 'iso-27001', name: 'ISO 27001', group: 'certification' },
  { slug: 'iso-9001', name: 'ISO 9001', group: 'certification' },
  { slug: 'soc-2', name: 'SOC 2', group: 'certification' },
  { slug: 'rios', name: 'RIOS', group: 'certification' },
  { slug: 'adisa', name: 'ADISA', group: 'certification' },

  // topic (12)
  { slug: 'buyers-guide', name: "Buyer's Guide", group: 'topic' },
  { slug: 'case-study', name: 'Case Study', group: 'topic' },
  { slug: 'how-to', name: 'How-To', group: 'topic' },
  { slug: 'checklist', name: 'Checklist', group: 'topic' },
  { slug: 'technical-reference', name: 'Technical Reference', group: 'topic' },
  { slug: 'rfp-template', name: 'RFP Template', group: 'topic' },
  { slug: 'contract-template', name: 'Contract Template', group: 'topic' },
  { slug: 'comparison', name: 'Comparison', group: 'topic' },
  { slug: 'explainer', name: 'Explainer', group: 'topic' },
  { slug: 'deep-dive', name: 'Deep Dive', group: 'topic' },
  { slug: 'news-jacking', name: 'News Analysis', group: 'topic' },
  { slug: 'data-journalism', name: 'Data Journalism', group: 'topic' },

  // media (13)
  { slug: 'hdd', name: 'HDD', group: 'media' },
  { slug: 'ssd', name: 'SSD', group: 'media' },
  { slug: 'nvme', name: 'NVMe', group: 'media' },
  { slug: 'tape', name: 'Tape Media', group: 'media' },
  { slug: 'optical', name: 'Optical Media', group: 'media' },
  { slug: 'mobile-device', name: 'Mobile Device', group: 'media' },
  { slug: 'networking-equipment', name: 'Networking Equipment', group: 'media' },
  { slug: 'storage-array', name: 'Storage Array', group: 'media' },
  { slug: 'server', name: 'Server', group: 'media' },
  { slug: 'laptop', name: 'Laptop', group: 'media' },
  { slug: 'desktop', name: 'Desktop', group: 'media' },
  { slug: 'printer-mfp', name: 'Printer / MFP', group: 'media' },
  { slug: 'iot-device', name: 'IoT Device', group: 'media' },

  // method (8)
  { slug: 'shredding', name: 'Shredding', group: 'method' },
  { slug: 'degaussing', name: 'Degaussing', group: 'method' },
  { slug: 'crypto-erase', name: 'Cryptographic Erase', group: 'method' },
  { slug: 'overwriting', name: 'Overwriting', group: 'method' },
  { slug: 'disintegration', name: 'Disintegration', group: 'method' },
  { slug: 'incineration', name: 'Incineration', group: 'method' },
  { slug: 'on-site-destruction', name: 'On-Site Destruction', group: 'method' },
  { slug: 'off-site-destruction', name: 'Off-Site Destruction', group: 'method' },

  // vendor-relationship (6)
  { slug: 'vendor-comparison', name: 'Vendor Comparison', group: 'vendor-relationship' },
  { slug: 'vendor-selection', name: 'Vendor Selection', group: 'vendor-relationship' },
  { slug: 'downstream-disclosure', name: 'Downstream Disclosure', group: 'vendor-relationship' },
  { slug: 'chain-of-custody', name: 'Chain of Custody', group: 'vendor-relationship' },
  { slug: 'value-recovery', name: 'Value Recovery', group: 'vendor-relationship' },
  { slug: 'contract-negotiation', name: 'Contract Negotiation', group: 'vendor-relationship' },
]

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  console.log('Connected to database')

  try {
    // ── Seed categories ──────────────────────────────────────────────────────
    console.log('\nSeeding categories...')
    let categoryInserted = 0
    let categorySkipped = 0

    for (const cat of CATEGORIES) {
      const res = await client.query(
        `INSERT INTO categories (title, slug, url_segment, description, sort_order, site_id, updated_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         ON CONFLICT (site_id, slug) DO NOTHING
         RETURNING id`,
        [cat.title, cat.slug, cat.url_segment, cat.description, cat.sort_order, SITE_ID],
      )
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  ✅ category: ${cat.slug}`)
        categoryInserted++
      } else {
        console.log(`  ⏭  skipped (already exists): ${cat.slug}`)
        categorySkipped++
      }
    }

    console.log(`\nCategories: ${categoryInserted} inserted, ${categorySkipped} skipped`)

    // ── Seed tags ────────────────────────────────────────────────────────────
    console.log('\nSeeding tags...')
    let tagInserted = 0
    let tagSkipped = 0

    for (const tag of TAGS) {
      const res = await client.query(
        `INSERT INTO tags (name, slug, "group", site_id, updated_at, created_at)
         VALUES ($1, $2, $3, $4, now(), now())
         ON CONFLICT (site_id, slug) DO NOTHING
         RETURNING id`,
        [tag.name, tag.slug, tag.group, SITE_ID],
      )
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  ✅ tag [${tag.group}]: ${tag.slug}`)
        tagInserted++
      } else {
        console.log(`  ⏭  skipped (already exists): ${tag.slug}`)
        tagSkipped++
      }
    }

    console.log(`\nTags: ${tagInserted} inserted, ${tagSkipped} skipped`)

    // ── Verify counts ────────────────────────────────────────────────────────
    console.log('\n── Verification ──────────────────────────────────────')
    const catCount = await client.query(
      `SELECT COUNT(*) FROM categories WHERE site_id = $1`,
      [SITE_ID],
    )
    console.log(`categories total for site ${SITE_ID}: ${catCount.rows[0].count}`)

    const tagCount = await client.query(
      `SELECT COUNT(*) FROM tags WHERE site_id = $1`,
      [SITE_ID],
    )
    console.log(`tags total for site ${SITE_ID}: ${tagCount.rows[0].count}`)

    const groupCounts = await client.query(
      `SELECT "group", COUNT(*) FROM tags WHERE site_id = $1 GROUP BY "group" ORDER BY "group"`,
      [SITE_ID],
    )
    console.log('\nTag counts by group:')
    for (const row of groupCounts.rows) {
      console.log(`  ${row.group}: ${row.count}`)
    }

    console.log('\n✅ Seed complete.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
