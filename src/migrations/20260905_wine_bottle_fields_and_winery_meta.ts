import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Brings `wines` up to the shape the Wine Country Corner frontend already uses
 * (its WineBottle type), so the 45 bottles currently hardcoded across five TS
 * modules can be imported instead of redeployed. Also adds the two SEO fields to
 * `wineries`.
 *
 * Additive only — every column is nullable or defaulted, and `wines` has zero
 * rows today, so there is nothing to backfill.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "wines"
      ADD COLUMN IF NOT EXISTS "short_name" varchar,
      ADD COLUMN IF NOT EXISTS "ava" varchar,
      ADD COLUMN IF NOT EXISTS "blend" varchar,
      ADD COLUMN IF NOT EXISTS "aging" varchar,
      ADD COLUMN IF NOT EXISTS "abv" numeric,
      ADD COLUMN IF NOT EXISTS "description" varchar,
      ADD COLUMN IF NOT EXISTS "drink_window" varchar,
      ADD COLUMN IF NOT EXISTS "price_note" varchar,
      ADD COLUMN IF NOT EXISTS "cases" numeric,
      ADD COLUMN IF NOT EXISTS "points" numeric,
      ADD COLUMN IF NOT EXISTS "points_source" varchar,
      ADD COLUMN IF NOT EXISTS "points_quote" varchar,
      ADD COLUMN IF NOT EXISTS "cta_label" varchar,
      ADD COLUMN IF NOT EXISTS "image_url" varchar,
      ADD COLUMN IF NOT EXISTS "member_only" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "sold_out" boolean DEFAULT false;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "wines_pairings" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY,
      "pairing" varchar
    );
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "wines_pairings_order_idx" ON "wines_pairings" ("_order");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "wines_pairings_parent_id_idx" ON "wines_pairings" ("_parent_id");
  `)

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'wines_pairings_parent_id_fk'
      ) THEN
        ALTER TABLE "wines_pairings"
          ADD CONSTRAINT "wines_pairings_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "wines"("id") ON DELETE CASCADE;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    ALTER TABLE "wineries"
      ADD COLUMN IF NOT EXISTS "meta_title" varchar,
      ADD COLUMN IF NOT EXISTS "meta_description" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "wines_pairings";`)

  await db.execute(sql`
    ALTER TABLE "wines"
      DROP COLUMN IF EXISTS "short_name",
      DROP COLUMN IF EXISTS "ava",
      DROP COLUMN IF EXISTS "blend",
      DROP COLUMN IF EXISTS "aging",
      DROP COLUMN IF EXISTS "abv",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "drink_window",
      DROP COLUMN IF EXISTS "price_note",
      DROP COLUMN IF EXISTS "cases",
      DROP COLUMN IF EXISTS "points",
      DROP COLUMN IF EXISTS "points_source",
      DROP COLUMN IF EXISTS "points_quote",
      DROP COLUMN IF EXISTS "cta_label",
      DROP COLUMN IF EXISTS "image_url",
      DROP COLUMN IF EXISTS "member_only",
      DROP COLUMN IF EXISTS "sold_out";
  `)

  await db.execute(sql`
    ALTER TABLE "wineries"
      DROP COLUMN IF EXISTS "meta_title",
      DROP COLUMN IF EXISTS "meta_description";
  `)
}
