import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── categories: url_segment + sort_order ──────────────────────────────────
  // url_segment: the URL pillar prefix (e.g. /compliance).
  // sort_order: controls admin display ordering.
  await db.execute(sql`
    ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "url_segment" varchar,
      ADD COLUMN IF NOT EXISTS "sort_order"  numeric;
  `)

  // ── tags: group + description ─────────────────────────────────────────────
  // group: editorial taxonomy bucket (industry, persona, regulation, etc.).
  // Payload select fields are stored as varchar.
  await db.execute(sql`
    ALTER TABLE "tags"
      ADD COLUMN IF NOT EXISTS "group"       varchar,
      ADD COLUMN IF NOT EXISTS "description" varchar;
  `)

  // Index on tags.group for efficient group-filtered API queries
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "tags_group_idx" ON "tags" USING btree ("group");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "tags_group_idx";

    ALTER TABLE "tags"
      DROP COLUMN IF EXISTS "group",
      DROP COLUMN IF EXISTS "description";

    ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "url_segment",
      DROP COLUMN IF EXISTS "sort_order";
  `)
}
