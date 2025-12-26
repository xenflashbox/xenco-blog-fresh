import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add stepsText and triggersText columns to support_kb_articles
  await db.execute(sql`
    ALTER TABLE "support_kb_articles"
    ADD COLUMN IF NOT EXISTS "steps_text" varchar,
    ADD COLUMN IF NOT EXISTS "triggers_text" varchar;
  `)

  // Also add to versions table
  await db.execute(sql`
    ALTER TABLE "_support_kb_articles_v"
    ADD COLUMN IF NOT EXISTS "version_steps_text" varchar,
    ADD COLUMN IF NOT EXISTS "version_triggers_text" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "support_kb_articles"
    DROP COLUMN IF EXISTS "steps_text",
    DROP COLUMN IF EXISTS "triggers_text";
  `)

  await db.execute(sql`
    ALTER TABLE "_support_kb_articles_v"
    DROP COLUMN IF EXISTS "version_steps_text",
    DROP COLUMN IF EXISTS "version_triggers_text";
  `)
}
