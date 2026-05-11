import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Repair migration for directory_entries enum values.
 *
 * The tier system migration (20260511_181928) silently failed to add
 * 'lodging' to category enum and 'draft' to status enum because
 * ALTER TYPE ADD VALUE cannot run inside a transaction in Postgres.
 *
 * This migration uses COMMIT/BEGIN to work around Payload's automatic
 * transaction wrapping.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Close the transaction Payload automatically opens
  await db.execute(sql`COMMIT;`);

  // Add missing enum values - IF NOT EXISTS prevents errors if already present
  await db.execute(sql`ALTER TYPE enum_directory_entries_category ADD VALUE IF NOT EXISTS 'lodging';`);
  await db.execute(sql`ALTER TYPE enum_directory_entries_status ADD VALUE IF NOT EXISTS 'draft';`);

  // Re-open transaction for Payload's post-migration bookkeeping
  await db.execute(sql`BEGIN;`);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres doesn't support removing enum values easily.
  // This is intentionally a no-op.
}
