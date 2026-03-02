import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "meta_title" varchar,
      ADD COLUMN IF NOT EXISTS "meta_description" varchar,
      ADD COLUMN IF NOT EXISTS "focus_keyword" varchar,
      ADD COLUMN IF NOT EXISTS "canonical_url" varchar,
      ADD COLUMN IF NOT EXISTS "no_index" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "structured_data" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "articles"
      DROP COLUMN IF EXISTS "meta_title",
      DROP COLUMN IF EXISTS "meta_description",
      DROP COLUMN IF EXISTS "focus_keyword",
      DROP COLUMN IF EXISTS "canonical_url",
      DROP COLUMN IF EXISTS "no_index",
      DROP COLUMN IF EXISTS "structured_data";
  `)
}
