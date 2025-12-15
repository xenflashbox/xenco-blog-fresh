import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1) Add site_id columns (idempotent)
  await db.execute(sql`ALTER TABLE IF EXISTS "categories" ADD COLUMN IF NOT EXISTS "site_id" integer;`)
  await db.execute(sql`ALTER TABLE IF EXISTS "tags" ADD COLUMN IF NOT EXISTS "site_id" integer;`)

  // 2) Drop GLOBAL unique constraints on slug if they exist (Payload default names)
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_key') THEN
        ALTER TABLE "categories" DROP CONSTRAINT "categories_slug_key";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_slug_key') THEN
        ALTER TABLE "tags" DROP CONSTRAINT "tags_slug_key";
      END IF;
    END $$;
  `)

  // 3) Backfill site_id from default site, if available
  await db.execute(sql`
    DO $$
    DECLARE default_site_id integer;
    BEGIN
      SELECT "id" INTO default_site_id
      FROM "sites"
      WHERE "is_default" = true
      ORDER BY "id"
      LIMIT 1;

      IF default_site_id IS NULL THEN
        RAISE NOTICE 'No default site found; skipping categories/tags site backfill';
      ELSE
        UPDATE "categories" SET "site_id" = default_site_id WHERE "site_id" IS NULL;
        UPDATE "tags" SET "site_id" = default_site_id WHERE "site_id" IS NULL;
      END IF;
    END $$;
  `)

  // 4) Add FKs (idempotent via pg_constraint)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_site_id_fkey') THEN
        ALTER TABLE "categories"
          ADD CONSTRAINT "categories_site_id_fkey"
          FOREIGN KEY ("site_id") REFERENCES "sites"("id")
          ON DELETE RESTRICT;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_site_id_fkey') THEN
        ALTER TABLE "tags"
          ADD CONSTRAINT "tags_site_id_fkey"
          FOREIGN KEY ("site_id") REFERENCES "sites"("id")
          ON DELETE RESTRICT;
      END IF;
    END $$;
  `)

  // 5) Make site_id NOT NULL only if safe (prevents bricking prod if no defaults)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM "categories" WHERE "site_id" IS NULL) THEN
        ALTER TABLE "categories" ALTER COLUMN "site_id" SET NOT NULL;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM "tags" WHERE "site_id" IS NULL) THEN
        ALTER TABLE "tags" ALTER COLUMN "site_id" SET NOT NULL;
      END IF;
    END $$;
  `)

  // 6) Add per-site unique slug indexes + helper indexes (idempotent)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "categories_site_id_slug_idx"
      ON "categories" ("site_id", "slug");
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "tags_site_id_slug_idx"
      ON "tags" ("site_id", "slug");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "categories_site_id_idx"
      ON "categories" ("site_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tags_site_id_idx"
      ON "tags" ("site_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop indexes first
  await db.execute(sql`DROP INDEX IF EXISTS "categories_site_id_slug_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tags_site_id_slug_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "categories_site_id_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "tags_site_id_idx";`)

  // Drop FKs if present
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_site_id_fkey') THEN
        ALTER TABLE "categories" DROP CONSTRAINT "categories_site_id_fkey";
      END IF;
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_site_id_fkey') THEN
        ALTER TABLE "tags" DROP CONSTRAINT "tags_site_id_fkey";
      END IF;
    END $$;
  `)

  // Drop columns
  await db.execute(sql`ALTER TABLE IF EXISTS "categories" DROP COLUMN IF EXISTS "site_id";`)
  await db.execute(sql`ALTER TABLE IF EXISTS "tags" DROP COLUMN IF EXISTS "site_id";`)

  // Re-add GLOBAL unique constraints (optional, but keeps down migration coherent)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_key') THEN
        ALTER TABLE "categories" ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tags_slug_key') THEN
        ALTER TABLE "tags" ADD CONSTRAINT "tags_slug_key" UNIQUE ("slug");
      END IF;
    END $$;
  `)
}
