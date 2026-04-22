import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── Vendors: parent_company_text + parent_company_text_notes ──────────────
  // Handles non-ITAD conglomerate parents (e.g. SK Group → SK Tes) that should
  // not be clickable directory links. Nullable; enforced mutually exclusive with
  // parent_company relationship via admin UI condition.
  await db.execute(sql`
    ALTER TABLE "vendors"
      ADD COLUMN IF NOT EXISTS "parent_company_text"       varchar,
      ADD COLUMN IF NOT EXISTS "parent_company_text_notes" varchar;
  `)

  // ── Vendors: data_quality_flags group ─────────────────────────────────────
  // Payload stores group fields as {group}_{field} columns.
  // Checkboxes default false; editor_note is optional free-text.
  await db.execute(sql`
    ALTER TABLE "vendors"
      ADD COLUMN IF NOT EXISTS "data_quality_flags_sparse_data"               boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "data_quality_flags_awaiting_re_verification"  boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "data_quality_flags_bot_protection_limited_crawl" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "data_quality_flags_editor_note"               varchar;
  `)

  // ── VendorCertifications: source_quote ────────────────────────────────────
  // Required at application level (Payload validate()); nullable in the DB so
  // existing rows without a quote are not broken by the migration. The import
  // script already dropped 65 cert records that lacked a source_quote; any
  // remaining rows without one should be cleaned up editorially.
  await db.execute(sql`
    ALTER TABLE "vendor_certifications"
      ADD COLUMN IF NOT EXISTS "source_quote" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "vendors"
      DROP COLUMN IF EXISTS "parent_company_text",
      DROP COLUMN IF EXISTS "parent_company_text_notes",
      DROP COLUMN IF EXISTS "data_quality_flags_sparse_data",
      DROP COLUMN IF EXISTS "data_quality_flags_awaiting_re_verification",
      DROP COLUMN IF EXISTS "data_quality_flags_bot_protection_limited_crawl",
      DROP COLUMN IF EXISTS "data_quality_flags_editor_note";

    ALTER TABLE "vendor_certifications"
      DROP COLUMN IF EXISTS "source_quote";
  `)
}
