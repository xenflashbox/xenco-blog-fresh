import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'
import { sql } from 'drizzle-orm'

export async function up({ payload }: MigrateUpArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "prefix" varchar(255);
  `)

  await payload.db.drizzle.execute(sql`
    ALTER TABLE "media" ALTER COLUMN "prefix" SET DEFAULT 'media';
  `)

  await payload.db.drizzle.execute(sql`
    UPDATE "media" SET "prefix" = 'media' WHERE "prefix" IS NULL;
  `)
}

export async function down({ payload }: MigrateDownArgs): Promise<void> {
  await payload.db.drizzle.execute(sql`
    ALTER TABLE "media" DROP COLUMN IF EXISTS "prefix";
  `)
}
