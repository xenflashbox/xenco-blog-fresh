// scripts/seed-diabetescompass.ts
// Seeds DiabetesCompass site: site record update, categories, tags, authors, and 50 US state regions.
// Run with: DATABASE_URI=<uri> npx tsx scripts/seed-diabetescompass.ts
//
// Prerequisites: the migration 20260506_add_diabetescompass_collections must have been applied.
// The DiabetesCompass site must already exist in the `sites` table with slug = 'diabetescompass'.
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
const { Client } = _require('/home/xen/docker/apps/payload-swarm/node_modules/.pnpm/pg@8.16.3/node_modules/pg')

const DATABASE_URL =
  process.env.DATABASE_URI ||
  'postgresql://payload:payload_db_secure_2025@payload-postgres_postgres:5432/payload'

const SITE_SLUG = 'diabetescompass'

// ── Categories (5 editorial pillars) ─────────────────────────────────────────

const CATEGORIES = [
  {
    slug: 'newly-diagnosed',
    title: 'Newly Diagnosed Navigation',
    url_segment: '/newly-diagnosed',
    description:
      'Calm orientation for the first 90 days after a diabetes or prediabetes diagnosis.',
    sort_order: 1,
  },
  {
    slug: 'misdiagnosed',
    title: 'The Misdiagnosed',
    url_segment: '/misdiagnosed',
    description:
      'Editorial coverage of LADA, MODY, type 3c, and the diabetes types that don\'t fit the standard binary.',
    sort_order: 2,
  },
  {
    slug: 'caregiving',
    title: 'Caregiving',
    url_segment: '/caregiving',
    description:
      'Practical guidance for families managing a loved one\'s diabetes alongside aging, dementia, or complex care.',
    sort_order: 3,
  },
  {
    slug: 'daily-life',
    title: 'Daily Life',
    url_segment: '/daily-life',
    description:
      'The logistics, the situations, the questions nobody warned you about.',
    sort_order: 4,
  },
  {
    slug: 'tools-and-tech',
    title: 'Tools & Tech',
    url_segment: '/tools-and-tech',
    description:
      'CGMs, pumps, GLP-1s, apps — decoded for the patient and caregiver, not the prescriber.',
    sort_order: 5,
  },
]

// ── Tags ─────────────────────────────────────────────────────────────────────

const TAGS: { slug: string; name: string; group: string }[] = [
  // diabetes-type (8)
  { slug: 'type-1-diabetes',       name: 'Type 1 Diabetes',        group: 'diabetes-type' },
  { slug: 'type-2-diabetes',       name: 'Type 2 Diabetes',        group: 'diabetes-type' },
  { slug: 'prediabetes',           name: 'Prediabetes',            group: 'diabetes-type' },
  { slug: 'gestational-diabetes',  name: 'Gestational Diabetes',   group: 'diabetes-type' },
  { slug: 'lada',                  name: 'LADA',                   group: 'diabetes-type' },
  { slug: 'mody',                  name: 'MODY',                   group: 'diabetes-type' },
  { slug: 'type-3c',               name: 'Type 3c',                group: 'diabetes-type' },
  { slug: 'steroid-induced-diabetes', name: 'Steroid-Induced Diabetes', group: 'diabetes-type' },

  // topic (14) — clinical and management topics
  { slug: 'a1c',               name: 'A1C',                       group: 'topic' },
  { slug: 'glucose-meter',     name: 'Glucose Meter',             group: 'topic' },
  { slug: 'cgm',               name: 'CGM',                       group: 'topic' },
  { slug: 'insulin-pump',      name: 'Insulin Pump',              group: 'topic' },
  { slug: 'smart-pen',         name: 'Smart Pen',                 group: 'topic' },
  { slug: 'glp-1-medications', name: 'GLP-1 Medications',         group: 'topic' },
  { slug: 'metformin',         name: 'Metformin',                 group: 'topic' },
  { slug: 'foot-care',         name: 'Foot Care',                 group: 'topic' },
  { slug: 'hypoglycemia',      name: 'Hypoglycemia',              group: 'topic' },
  { slug: 'hyperglycemia',     name: 'Hyperglycemia',             group: 'topic' },
  { slug: 'dka',               name: 'DKA',                       group: 'topic' },
  { slug: 'kidney-disease',    name: 'Kidney Disease',            group: 'topic' },
  { slug: 'neuropathy',        name: 'Neuropathy',                group: 'topic' },
  { slug: 'retinopathy',       name: 'Retinopathy',               group: 'topic' },

  // audience (5)
  { slug: 'newly-diagnosed',   name: 'Newly Diagnosed',           group: 'audience' },
  { slug: 'caregivers',        name: 'Caregivers',                group: 'audience' },
  { slug: 'family-members',    name: 'Family Members',            group: 'audience' },
  { slug: 'seniors',           name: 'Seniors',                   group: 'audience' },
  { slug: 'pregnancy',         name: 'Pregnancy',                 group: 'audience' },

  // format (5)
  { slug: 'field-guide',       name: 'Field Guide',               group: 'format' },
  { slug: 'review',            name: 'Review',                    group: 'format' },
  { slug: 'comparison',        name: 'Comparison',                group: 'format' },
  { slug: 'explainer',         name: 'Explainer',                 group: 'format' },
  { slug: 'news-decoded',      name: 'News Decoded',              group: 'format' },
]

// ── Authors (2 AI presenter personas) ────────────────────────────────────────

const AUTHORS = [
  {
    slug: 'maren-alcott',
    name: 'Maren Alcott',
    role: 'Lead Presenter',
    email: 'maren@diabetescompass.com',
    bio: 'Maren Alcott is a digital character created by the DiabetesCompass editorial team. She is not a real person. All content presented by Maren is researched and reviewed by our editorial team and medical advisors. DiabetesCompass believes in full transparency about AI-assisted content: Maren\'s articles are drafted with AI assistance and reviewed by humans before publication.',
    is_default: true,
  },
  {
    slug: 'theo-vance',
    name: 'Theo Vance',
    role: 'Lived-Experience Presenter',
    email: 'theo@diabetescompass.com',
    bio: 'Theo Vance is a digital character created by the DiabetesCompass editorial team. He is not a real person. Theo\'s perspective is drawn from aggregated lived-experience accounts, patient community research, and editorial synthesis — not from a single individual\'s experience. All content presented by Theo is reviewed by our editorial team before publication.',
    is_default: false,
  },
]

// ── US States (50 records for Regions collection) ─────────────────────────────

const US_STATES = [
  { name: 'Alabama',        slug: 'al', state_code: 'AL' },
  { name: 'Alaska',         slug: 'ak', state_code: 'AK' },
  { name: 'Arizona',        slug: 'az', state_code: 'AZ' },
  { name: 'Arkansas',       slug: 'ar', state_code: 'AR' },
  { name: 'California',     slug: 'ca', state_code: 'CA' },
  { name: 'Colorado',       slug: 'co', state_code: 'CO' },
  { name: 'Connecticut',    slug: 'ct', state_code: 'CT' },
  { name: 'Delaware',       slug: 'de', state_code: 'DE' },
  { name: 'Florida',        slug: 'fl', state_code: 'FL' },
  { name: 'Georgia',        slug: 'ga', state_code: 'GA' },
  { name: 'Hawaii',         slug: 'hi', state_code: 'HI' },
  { name: 'Idaho',          slug: 'id', state_code: 'ID' },
  { name: 'Illinois',       slug: 'il', state_code: 'IL' },
  { name: 'Indiana',        slug: 'in', state_code: 'IN' },
  { name: 'Iowa',           slug: 'ia', state_code: 'IA' },
  { name: 'Kansas',         slug: 'ks', state_code: 'KS' },
  { name: 'Kentucky',       slug: 'ky', state_code: 'KY' },
  { name: 'Louisiana',      slug: 'la', state_code: 'LA' },
  { name: 'Maine',          slug: 'me', state_code: 'ME' },
  { name: 'Maryland',       slug: 'md', state_code: 'MD' },
  { name: 'Massachusetts',  slug: 'ma', state_code: 'MA' },
  { name: 'Michigan',       slug: 'mi', state_code: 'MI' },
  { name: 'Minnesota',      slug: 'mn', state_code: 'MN' },
  { name: 'Mississippi',    slug: 'ms', state_code: 'MS' },
  { name: 'Missouri',       slug: 'mo', state_code: 'MO' },
  { name: 'Montana',        slug: 'mt', state_code: 'MT' },
  { name: 'Nebraska',       slug: 'ne', state_code: 'NE' },
  { name: 'Nevada',         slug: 'nv', state_code: 'NV' },
  { name: 'New Hampshire',  slug: 'nh', state_code: 'NH' },
  { name: 'New Jersey',     slug: 'nj', state_code: 'NJ' },
  { name: 'New Mexico',     slug: 'nm', state_code: 'NM' },
  { name: 'New York',       slug: 'ny', state_code: 'NY' },
  { name: 'North Carolina', slug: 'nc', state_code: 'NC' },
  { name: 'North Dakota',   slug: 'nd', state_code: 'ND' },
  { name: 'Ohio',           slug: 'oh', state_code: 'OH' },
  { name: 'Oklahoma',       slug: 'ok', state_code: 'OK' },
  { name: 'Oregon',         slug: 'or', state_code: 'OR' },
  { name: 'Pennsylvania',   slug: 'pa', state_code: 'PA' },
  { name: 'Rhode Island',   slug: 'ri', state_code: 'RI' },
  { name: 'South Carolina', slug: 'sc', state_code: 'SC' },
  { name: 'South Dakota',   slug: 'sd', state_code: 'SD' },
  { name: 'Tennessee',      slug: 'tn', state_code: 'TN' },
  { name: 'Texas',          slug: 'tx', state_code: 'TX' },
  { name: 'Utah',           slug: 'ut', state_code: 'UT' },
  { name: 'Vermont',        slug: 'vt', state_code: 'VT' },
  { name: 'Virginia',       slug: 'va', state_code: 'VA' },
  { name: 'Washington',     slug: 'wa', state_code: 'WA' },
  { name: 'West Virginia',  slug: 'wv', state_code: 'WV' },
  { name: 'Wisconsin',      slug: 'wi', state_code: 'WI' },
  { name: 'Wyoming',        slug: 'wy', state_code: 'WY' },
]

// ── Broad US regions (3 records) ──────────────────────────────────────────────

const BROAD_REGIONS = [
  { name: 'Northeast',  slug: 'northeast',  description: 'CT, ME, MA, NH, NJ, NY, PA, RI, VT' },
  { name: 'Southeast',  slug: 'southeast',  description: 'AL, AR, FL, GA, KY, LA, MD, MS, NC, SC, TN, VA, WV' },
  { name: 'Midwest',    slug: 'midwest',    description: 'IL, IN, IA, KS, MI, MN, MO, NE, ND, OH, SD, WI' },
  { name: 'Southwest',  slug: 'southwest',  description: 'AZ, NM, OK, TX' },
  { name: 'West',       slug: 'west',       description: 'AK, CA, CO, HI, ID, MT, NV, OR, UT, WA, WY' },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  console.log('Connected to database\n')

  try {
    // ── Resolve site ID ────────────────────────────────────────────────────────
    const siteRow = await client.query(
      `SELECT id FROM sites WHERE slug = $1 LIMIT 1`,
      [SITE_SLUG],
    )

    if (!siteRow.rows.length) {
      console.error(`❌ Site with slug "${SITE_SLUG}" not found. Create the site in Payload admin first.`)
      process.exit(1)
    }

    const SITE_ID: number = siteRow.rows[0].id
    console.log(`✅ Found DiabetesCompass site — id: ${SITE_ID}\n`)

    // ── Part 1: Update site branding record ────────────────────────────────────
    console.log('── Part 1: Updating site branding fields ──────────────────')
    await client.query(
      `UPDATE sites SET
        name              = $1,
        slug              = $2,
        tagline           = $3,
        description       = $4,
        theme_color       = $5,
        background_color  = $6,
        updated_at        = now()
       WHERE id = $7`,
      [
        'DiabetesCompass',
        'diabetescompass',
        'Find your direction.',
        'Educational content for navigating life with diabetes. Calm, research-backed orientation for the newly diagnosed, the misdiagnosed, and the people caring for them.',
        '#0F4C5C',
        '#F4EDE0',
        SITE_ID,
      ],
    )
    console.log('✅ Site branding fields updated')
    console.log('ℹ  Logo and favicon must be uploaded manually via Payload admin')
    console.log('ℹ  Set listmonk_list_id and mautic_segment_id from env config\n')

    // ── Part 2: Check for WCC records on this site ─────────────────────────────
    console.log('── Part 2: Checking for WCC-specific records ──────────────')
    const wccTables = ['wineries', 'wines', 'restaurants', 'accommodations']
    for (const table of wccTables) {
      try {
        const res = await client.query(
          `SELECT COUNT(*) FROM ${table} WHERE site_id = $1`,
          [SITE_ID],
        )
        const count = parseInt(res.rows[0].count, 10)
        if (count > 0) {
          console.log(`⚠️  ${table}: ${count} record(s) found for this site — review and delete manually if needed`)
        } else {
          console.log(`✅ ${table}: no records for this site`)
        }
      } catch {
        console.log(`⏭  ${table}: table not accessible (may not have site_id column)`)
      }
    }
    console.log()

    // ── Part 5: Categories ─────────────────────────────────────────────────────
    console.log('── Part 5: Seeding categories ─────────────────────────────')
    let catInserted = 0, catSkipped = 0

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
        catInserted++
      } else {
        console.log(`  ⏭  skipped (already exists): ${cat.slug}`)
        catSkipped++
      }
    }
    console.log(`\nCategories: ${catInserted} inserted, ${catSkipped} skipped\n`)

    // ── Part 6: Tags ───────────────────────────────────────────────────────────
    console.log('── Part 6: Seeding tags ───────────────────────────────────')
    let tagInserted = 0, tagSkipped = 0

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

    const groupCounts = await client.query(
      `SELECT "group", COUNT(*) FROM tags WHERE site_id = $1 GROUP BY "group" ORDER BY "group"`,
      [SITE_ID],
    )
    console.log(`\nTags: ${tagInserted} inserted, ${tagSkipped} skipped`)
    console.log('Tag counts by group:')
    for (const row of groupCounts.rows) {
      console.log(`  ${row.group}: ${row.count}`)
    }
    console.log()

    // ── Part 7: Authors ────────────────────────────────────────────────────────
    console.log('── Part 7: Seeding authors ────────────────────────────────')
    let authorInserted = 0, authorSkipped = 0

    for (const author of AUTHORS) {
      const exists = await client.query(
        `SELECT id FROM authors WHERE site_id = $1 AND slug = $2 LIMIT 1`,
        [SITE_ID, author.slug],
      )
      if (exists.rows.length > 0) {
        console.log(`  ⏭  skipped (already exists): ${author.slug}`)
        authorSkipped++
        continue
      }
      await client.query(
        `INSERT INTO authors (name, slug, role, email, bio, is_default, site_id, updated_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
        [author.name, author.slug, author.role, author.email, author.bio, author.is_default, SITE_ID],
      )
      console.log(`  ✅ author: ${author.slug} (${author.role})`)
      authorInserted++
    }
    console.log(`\nAuthors: ${authorInserted} inserted, ${authorSkipped} skipped\n`)

    // ── Part 4: Regions — 50 US states ────────────────────────────────────────
    console.log('── Part 4: Seeding regions (50 US states) ─────────────────')
    let regionInserted = 0, regionSkipped = 0

    for (const state of US_STATES) {
      const res = await client.query(
        `INSERT INTO regions (name, slug, tier, state_code, site_id, updated_at, created_at)
         VALUES ($1, $2, 'state', $3, $4, now(), now())
         ON CONFLICT (site_id, slug) DO NOTHING
         RETURNING id`,
        [state.name, state.slug, state.state_code, SITE_ID],
      )
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  ✅ region [state]: ${state.slug} (${state.state_code})`)
        regionInserted++
      } else {
        console.log(`  ⏭  skipped (already exists): ${state.slug}`)
        regionSkipped++
      }
    }

    for (const region of BROAD_REGIONS) {
      const res = await client.query(
        `INSERT INTO regions (name, slug, tier, description, site_id, updated_at, created_at)
         VALUES ($1, $2, 'region', $3, $4, now(), now())
         ON CONFLICT (site_id, slug) DO NOTHING
         RETURNING id`,
        [region.name, region.slug, region.description, SITE_ID],
      )
      if (res.rowCount && res.rowCount > 0) {
        console.log(`  ✅ region [region]: ${region.slug}`)
        regionInserted++
      } else {
        console.log(`  ⏭  skipped (already exists): ${region.slug}`)
        regionSkipped++
      }
    }

    console.log(`\nRegions: ${regionInserted} inserted, ${regionSkipped} skipped\n`)

    // ── Verification ───────────────────────────────────────────────────────────
    console.log('── Verification ───────────────────────────────────────────')

    const catCount = await client.query(
      `SELECT COUNT(*) FROM categories WHERE site_id = $1`, [SITE_ID])
    console.log(`categories: ${catCount.rows[0].count}`)

    const tagCount = await client.query(
      `SELECT COUNT(*) FROM tags WHERE site_id = $1`, [SITE_ID])
    console.log(`tags: ${tagCount.rows[0].count}`)

    const authorCount = await client.query(
      `SELECT COUNT(*) FROM authors WHERE site_id = $1`, [SITE_ID])
    console.log(`authors: ${authorCount.rows[0].count}`)

    const regionCount = await client.query(
      `SELECT COUNT(*) FROM regions WHERE site_id = $1`, [SITE_ID])
    console.log(`regions: ${regionCount.rows[0].count}`)

    console.log('\n── API Endpoints ──────────────────────────────────────────')
    console.log('GET /api/specialists?where[site.slug][equals]=diabetescompass')
    console.log('GET /api/articles?where[site.slug][equals]=diabetescompass')
    console.log('GET /api/categories?where[site.slug][equals]=diabetescompass')
    console.log('GET /api/regions?where[site.slug][equals]=diabetescompass')
    console.log('GET /api/tags?where[site.slug][equals]=diabetescompass')
    console.log('GET /api/authors?where[site.slug][equals]=diabetescompass')

    console.log('\n✅ Seed complete.\n')
    console.log('Remaining manual steps:')
    console.log('  1. Upload logo via Payload admin: /public/brand/horizontal/horizontal-master-with-tagline.svg')
    console.log('  2. Upload favicon via Payload admin: /public/favicon.svg')
    console.log('  3. Set listmonk_list_id from env config in site record')
    console.log('  4. Set mautic_segment_id from env config in site record')
    console.log('  5. Upload author avatars once HeyGen renders are ready')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
