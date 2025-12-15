import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop any incorrect unique indexes that might have been auto-created
  // These should NOT be unique - we want multiple categories/tags per site

  // Drop unique indexes on site_id if they exist (they shouldn't allow only one per site)
  await db.execute(sql`
    DO $$ BEGIN
      -- Categories site_id unique index (incorrect)
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'categories_site_id_idx' AND indexdef LIKE '%UNIQUE%') THEN
        DROP INDEX IF EXISTS "categories_site_id_idx";
        CREATE INDEX "categories_site_id_idx" ON "categories" ("site_id");
      END IF;

      -- Tags site_id unique index (incorrect)
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tags_site_id_idx' AND indexdef LIKE '%UNIQUE%') THEN
        DROP INDEX IF EXISTS "tags_site_id_idx";
        CREATE INDEX "tags_site_id_idx" ON "tags" ("site_id");
      END IF;

      -- Drop any unique indexes on slug alone (should be composite with site_id)
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'categories_slug_idx' AND indexdef LIKE '%UNIQUE%') THEN
        DROP INDEX IF EXISTS "categories_slug_idx";
      END IF;

      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tags_slug_idx' AND indexdef LIKE '%UNIQUE%') THEN
        DROP INDEX IF EXISTS "tags_slug_idx";
      END IF;

      -- Drop unique indexes on timestamps (definitely wrong)
      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'categories_created_at_idx' AND indexdef LIKE '%UNIQUE%') THEN
        DROP INDEX IF EXISTS "categories_created_at_idx";
        CREATE INDEX IF NOT EXISTS "categories_created_at_idx" ON "categories" ("created_at");
      END IF;

      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'categories_updated_at_idx' AND indexdef LIKE '%UNIQUE%') THEN
        DROP INDEX IF EXISTS "categories_updated_at_idx";
        CREATE INDEX IF NOT EXISTS "categories_updated_at_idx" ON "categories" ("updated_at");
      END IF;

      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tags_created_at_idx' AND indexdef LIKE '%UNIQUE%') THEN
        DROP INDEX IF EXISTS "tags_created_at_idx";
        CREATE INDEX IF NOT EXISTS "tags_created_at_idx" ON "tags" ("created_at");
      END IF;

      IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'tags_updated_at_idx' AND indexdef LIKE '%UNIQUE%') THEN
        DROP INDEX IF EXISTS "tags_updated_at_idx";
        CREATE INDEX IF NOT EXISTS "tags_updated_at_idx" ON "tags" ("updated_at");
      END IF;
    END $$;
  `)

  // Ensure the correct composite unique indexes exist (site_id, slug)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "categories_site_id_slug_idx"
      ON "categories" ("site_id", "slug");
  `)
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "tags_site_id_slug_idx"
      ON "tags" ("site_id", "slug");
  `)

  // Ensure non-unique site_id indexes exist
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "categories_site_id_idx"
      ON "categories" ("site_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tags_site_id_idx"
      ON "tags" ("site_id");
  `)
}

export async function down({ db: _db }: MigrateDownArgs): Promise<void> {
  // This migration only fixes indexes, so down is a no-op
  // The indexes should remain as corrected
}
