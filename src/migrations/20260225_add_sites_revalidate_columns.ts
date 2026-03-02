import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "sites"
      ADD COLUMN IF NOT EXISTS "revalidate_url" text,
      ADD COLUMN IF NOT EXISTS "revalidate_secret" text;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "sites"
      DROP COLUMN IF EXISTS "revalidate_url",
      DROP COLUMN IF EXISTS "revalidate_secret";
  `)
}
