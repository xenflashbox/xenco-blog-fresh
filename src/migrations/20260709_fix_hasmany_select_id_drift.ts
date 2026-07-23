import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Repair migration for hasMany-select junction table id drift.
 *
 * The deployed Payload version's drizzle adapter expects hasMany-select tables
 * to have `id serial PRIMARY KEY` (see the generated 20260511_181928 migration)
 * and relies on the DB to generate ids when it rewrites rows on parent update.
 *
 * Two live tables drifted from that shape:
 *
 * 1. vendors_coverage_area — created by the hand-written 20260508 migration
 *    with `id varchar PRIMARY KEY` and no default; the generated CREATE TABLE
 *    IF NOT EXISTS in 20260511 then no-oped. Every vendor update rewrote the
 *    coverage rows with id = NULL → 23502 NOT NULL violation → masked 500
 *    (production Bug 2, 2026-07-08). Also aligns `value` to nullable per the
 *    generated schema.
 *
 * 2. promos_placement — live table has NO id column at all (same failure class
 *    waiting to happen on any promo write with placement values).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // vendors_coverage_area: swap varchar id (no default) for serial.
  // Existing row ids are importer-generated opaque strings ('cov-...') with no
  // external references — safe to drop and renumber.
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'vendors_coverage_area'
          AND column_name = 'id'
          AND data_type = 'character varying'
      ) THEN
        ALTER TABLE "vendors_coverage_area" DROP CONSTRAINT IF EXISTS "vendors_coverage_area_pkey";
        ALTER TABLE "vendors_coverage_area" DROP COLUMN "id";
        ALTER TABLE "vendors_coverage_area" ADD COLUMN "id" serial PRIMARY KEY;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "vendors_coverage_area" ALTER COLUMN "value" DROP NOT NULL;
  `)

  // promos_placement: add the missing serial id primary key.
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'promos_placement'
          AND column_name = 'id'
      ) THEN
        ALTER TABLE "promos_placement" ADD COLUMN "id" serial PRIMARY KEY;
      END IF;
    END $$;
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // Intentionally a no-op: reverting would reintroduce the adapter/schema
  // mismatch that broke all vendor updates. The pre-repair shape is recorded
  // in the up() comment if it is ever needed.
}
