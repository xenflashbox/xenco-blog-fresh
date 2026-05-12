import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration: vendor_certifications_source_quote_reverify
 *
 * Purpose: Add awaiting_re_verification field and flag existing records without source_quote
 * for editorial review. The source_quote column already exists but the new field and
 * Option 1 logic require this migration.
 *
 * Changes:
 * 1. Add awaiting_re_verification boolean column (default false)
 * 2. Set awaiting_re_verification = true for all records where source_quote IS NULL
 * 3. Ensure verification_status = 'self-reported' for records without source_quote
 *
 * Reversible: Yes - down migration removes the column
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Add the awaiting_re_verification column if it doesn't exist
  await db.execute(sql`
    ALTER TABLE vendor_certifications
    ADD COLUMN IF NOT EXISTS awaiting_re_verification boolean DEFAULT false;
  `)

  // Flag all existing records without source_quote for editorial review
  // This surfaces them in the editorial queue for backfill
  await db.execute(sql`
    UPDATE vendor_certifications
    SET
      awaiting_re_verification = true,
      verification_status = 'self-reported'
    WHERE source_quote IS NULL
       OR TRIM(source_quote) = ''
       OR LENGTH(TRIM(source_quote)) < 20;
  `)

  // Log the count of affected records
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM vendor_certifications WHERE awaiting_re_verification = true;
  `)
  console.log(`[Migration] Flagged ${result.rows?.[0]?.count || 0} vendor_certifications for re-verification`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Remove the awaiting_re_verification column
  await db.execute(sql`
    ALTER TABLE vendor_certifications
    DROP COLUMN IF EXISTS awaiting_re_verification;
  `)
}
