import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "directory_entries_slug_idx";
  CREATE UNIQUE INDEX "site_slug_idx" ON "directory_entries" USING btree ("site_id","slug");
  CREATE INDEX "directory_entries_slug_idx" ON "directory_entries" USING btree ("slug");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "site_slug_idx";
  DROP INDEX "directory_entries_slug_idx";
  CREATE UNIQUE INDEX "directory_entries_slug_idx" ON "directory_entries" USING btree ("slug");`)
}
