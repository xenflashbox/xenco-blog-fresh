/**
 * Migration: 20260508-vendor-profile-reframe-additions
 *
 * Workstream A — vendor profile reframe schema additions.
 * All changes are additive and nullable; existing 35 vendor records remain valid.
 *
 * Adds to vendors table:
 *   - editorial group (canonical_descriptor, summary, summary_status,
 *     summary_reviewer_id, summary_last_reviewed, industry_notes)
 *   - has_verified_certifications (computed boolean, maintained by VendorCertifications hooks)
 *
 * Adds junction tables:
 *   - vendors_coverage_area       (hasMany select — geographic coverage)
 *   - vendors_regional_states     (array of select — state/province codes)
 *   - vendors_notable_clients     (array of objects — client disclosure records)
 *
 * New enum types:
 *   - enum_vendors_editorial_summary_status  (draft | published | needs-review)
 *   - enum_vendors_coverage_area             (northeast | southeast | midwest |
 *                                             southwest | west | national | global |
 *                                             regional-specify)
 *
 * Reversible: down() removes all columns, tables, and types added here.
 */

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── New ENUM types ────────────────────────────────────────────────────────────

  await db.execute(sql`
    CREATE TYPE "public"."enum_vendors_editorial_summary_status"
      AS ENUM('draft', 'published', 'needs-review');

    CREATE TYPE "public"."enum_vendors_coverage_area"
      AS ENUM(
        'northeast',
        'southeast',
        'midwest',
        'southwest',
        'west',
        'national',
        'global',
        'regional-specify'
      );
  `)

  // ── New columns on vendors ───────────────────────────────────────────────────
  // Columns for the 'editorial' group are prefixed editorial_.
  // All nullable except editorial_summary_status which defaults to 'draft'.
  // has_verified_certifications defaults to false (updated by cert hooks).

  await db.execute(sql`
    ALTER TABLE "vendors"
      ADD COLUMN IF NOT EXISTS "editorial_canonical_descriptor"   varchar(120),
      ADD COLUMN IF NOT EXISTS "editorial_summary"                jsonb,
      ADD COLUMN IF NOT EXISTS "editorial_summary_status"
        "enum_vendors_editorial_summary_status" NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS "editorial_summary_reviewer_id"    integer,
      ADD COLUMN IF NOT EXISTS "editorial_summary_last_reviewed"  timestamp(3) with time zone,
      ADD COLUMN IF NOT EXISTS "editorial_industry_notes"         jsonb,
      ADD COLUMN IF NOT EXISTS "has_verified_certifications"      boolean NOT NULL DEFAULT false;
  `)

  // ── vendors_coverage_area — hasMany select ────────────────────────────────────
  // One row per selected coverage tier per vendor.

  await db.execute(sql`
    CREATE TABLE "vendors_coverage_area" (
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id"         varchar PRIMARY KEY NOT NULL,
      "value"      "enum_vendors_coverage_area" NOT NULL
    );
  `)

  // ── vendors_regional_states — array of select (state/province codes) ─────────
  // state_code stored as varchar; options enforced at application layer.

  await db.execute(sql`
    CREATE TABLE "vendors_regional_states" (
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id"         varchar PRIMARY KEY NOT NULL,
      "state_code" varchar NOT NULL
    );
  `)

  // ── vendors_notable_clients — array of objects ────────────────────────────────
  // disclosure_source_url nullable; required by application logic only when
  // is_publicly_disclosed is true.

  await db.execute(sql`
    CREATE TABLE "vendors_notable_clients" (
      "_order"                 integer NOT NULL,
      "_parent_id"             integer NOT NULL,
      "id"                     varchar PRIMARY KEY NOT NULL,
      "client_name"            varchar,
      "is_publicly_disclosed"  boolean NOT NULL DEFAULT false,
      "disclosure_source_url"  varchar
    );
  `)

  // ── Foreign key constraints ──────────────────────────────────────────────────

  await db.execute(sql`
    ALTER TABLE "vendors"
      ADD CONSTRAINT "vendors_editorial_summary_reviewer_id_users_id_fk"
        FOREIGN KEY ("editorial_summary_reviewer_id")
        REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;

    ALTER TABLE "vendors_coverage_area"
      ADD CONSTRAINT "vendors_coverage_area_parent_fk"
        FOREIGN KEY ("_parent_id")
        REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "vendors_regional_states"
      ADD CONSTRAINT "vendors_regional_states_parent_fk"
        FOREIGN KEY ("_parent_id")
        REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "vendors_notable_clients"
      ADD CONSTRAINT "vendors_notable_clients_parent_fk"
        FOREIGN KEY ("_parent_id")
        REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action;
  `)

  // ── Indexes ──────────────────────────────────────────────────────────────────

  await db.execute(sql`
    CREATE INDEX "vendors_editorial_summary_status_idx"
      ON "vendors" USING btree ("editorial_summary_status");

    CREATE INDEX "vendors_has_verified_certifications_idx"
      ON "vendors" USING btree ("has_verified_certifications");

    CREATE INDEX "vendors_coverage_area_order_idx"
      ON "vendors_coverage_area" USING btree ("_order");
    CREATE INDEX "vendors_coverage_area_parent_idx"
      ON "vendors_coverage_area" USING btree ("_parent_id");

    CREATE INDEX "vendors_regional_states_order_idx"
      ON "vendors_regional_states" USING btree ("_order");
    CREATE INDEX "vendors_regional_states_parent_idx"
      ON "vendors_regional_states" USING btree ("_parent_id");

    CREATE INDEX "vendors_notable_clients_order_idx"
      ON "vendors_notable_clients" USING btree ("_order");
    CREATE INDEX "vendors_notable_clients_parent_idx"
      ON "vendors_notable_clients" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop indexes (implicit with tables, but explicit for the vendors columns)
  await db.execute(sql`
    DROP INDEX IF EXISTS "vendors_editorial_summary_status_idx";
    DROP INDEX IF EXISTS "vendors_has_verified_certifications_idx";
  `)

  // Drop junction tables (cascade removes their indexes and FKs)
  await db.execute(sql`
    DROP TABLE IF EXISTS "vendors_notable_clients"  CASCADE;
    DROP TABLE IF EXISTS "vendors_regional_states"  CASCADE;
    DROP TABLE IF EXISTS "vendors_coverage_area"    CASCADE;
  `)

  // Drop columns added to vendors
  await db.execute(sql`
    ALTER TABLE "vendors"
      DROP CONSTRAINT IF EXISTS "vendors_editorial_summary_reviewer_id_users_id_fk",
      DROP COLUMN IF EXISTS "editorial_canonical_descriptor",
      DROP COLUMN IF EXISTS "editorial_summary",
      DROP COLUMN IF EXISTS "editorial_summary_status",
      DROP COLUMN IF EXISTS "editorial_summary_reviewer_id",
      DROP COLUMN IF EXISTS "editorial_summary_last_reviewed",
      DROP COLUMN IF EXISTS "editorial_industry_notes",
      DROP COLUMN IF EXISTS "has_verified_certifications";
  `)

  // Drop enum types
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_vendors_editorial_summary_status";
    DROP TYPE IF EXISTS "public"."enum_vendors_coverage_area";
  `)
}
