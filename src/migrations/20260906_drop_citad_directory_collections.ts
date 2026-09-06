import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Removes the Compare ITAD vendor directory from Payload. It has lived in Neon
 * (`citad` schema) since 2026-06; the frontend cut over to the FastAPI directory
 * service, and one production build was still issuing 2,826 requests to
 * cms.compareitad.com — enough to rate-limit an origin shared by ~50 properties.
 *
 * Row counts verified equal in Neon before this ran: vendors 711,
 * vendor_certifications 755, vendor_facilities 854, vendor_services 344,
 * leads 7, industries 17, and the three vendor child tables 2/2/3.
 *
 * `commercial_relationships` is deliberately NOT dropped here — /commercial-model
 * still reads it and throws on a non-2xx. It follows in a second migration once
 * that fetch is gone from the frontend. Its FK into `vendors` goes now, though,
 * since the vendor is named rather than linked from this point on.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "commercial_relationships"
      DROP CONSTRAINT IF EXISTS "commercial_relationships_vendor_id_vendors_id_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "commercial_relationships"
      DROP COLUMN IF EXISTS "vendor_id",
      ADD COLUMN IF NOT EXISTS "vendor" varchar;
  `)

  // Payload rebuilds this table's shape from the collection list; these columns
  // no longer have a collection behind them.
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "vendors_id",
      DROP COLUMN IF EXISTS "vendor_certifications_id",
      DROP COLUMN IF EXISTS "vendor_facilities_id",
      DROP COLUMN IF EXISTS "vendor_services_id",
      DROP COLUMN IF EXISTS "leads_id",
      DROP COLUMN IF EXISTS "industries_id";
  `)

  // Dependency order — children, then vendors, then the taxonomy it pointed at.
  // No CASCADE: every dependency is enumerated above, and a stray CASCADE on a
  // fifty-tenant instance is not a risk worth taking.
  await db.execute(sql`DROP TABLE IF EXISTS "vendors_rels";`)
  await db.execute(sql`DROP TABLE IF EXISTS "vendors_coverage_area";`)
  await db.execute(sql`DROP TABLE IF EXISTS "vendors_notable_clients";`)
  await db.execute(sql`DROP TABLE IF EXISTS "vendors_regional_states";`)
  await db.execute(sql`DROP TABLE IF EXISTS "vendor_certifications";`)
  await db.execute(sql`DROP TABLE IF EXISTS "vendor_facilities";`)
  await db.execute(sql`DROP TABLE IF EXISTS "vendor_services";`)
  await db.execute(sql`DROP TABLE IF EXISTS "leads";`)
  await db.execute(sql`DROP TABLE IF EXISTS "vendors";`)
  await db.execute(sql`DROP TABLE IF EXISTS "industries";`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  throw new Error(
    'Irreversible: this migration drops ten tables and their rows. The authoritative ' +
      'copy is Neon (citad schema). A pre-drop dump of all ten tables is on xenco0 at ' +
      '/home/xen/backups/citad-payload-drop/citad-directory-preDrop-20260906.sql.gz ' +
      '(sha256 fce81be8bc6c091d55ca424e69c8a03dbfb501f782d5a7ed8990e4872ff225ec). ' +
      'Restore with: gunzip -c <file> | docker exec -i payload-postgres psql -U payload -d payload',
  )
}
