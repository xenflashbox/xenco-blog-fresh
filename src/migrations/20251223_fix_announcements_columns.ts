import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Rename columns to match Payload collection field names
  await db.execute(sql`
    ALTER TABLE "support_announcements"
    RENAME COLUMN "active_from" TO "starts_at";
  `)

  await db.execute(sql`
    ALTER TABLE "support_announcements"
    RENAME COLUMN "active_until" TO "expires_at";
  `)

  // Also fix version table if it has the wrong names
  await db.execute(sql`
    ALTER TABLE "_support_announcements_v"
    RENAME COLUMN "version_active_from" TO "version_starts_at";
  `)

  await db.execute(sql`
    ALTER TABLE "_support_announcements_v"
    RENAME COLUMN "version_active_until" TO "version_expires_at";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "support_announcements"
    RENAME COLUMN "starts_at" TO "active_from";
  `)

  await db.execute(sql`
    ALTER TABLE "support_announcements"
    RENAME COLUMN "expires_at" TO "active_until";
  `)

  await db.execute(sql`
    ALTER TABLE "_support_announcements_v"
    RENAME COLUMN "version_starts_at" TO "version_active_from";
  `)

  await db.execute(sql`
    ALTER TABLE "_support_announcements_v"
    RENAME COLUMN "version_expires_at" TO "version_active_until";
  `)
}
