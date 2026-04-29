import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add required `author` relationship to Episodes (Lexi Explains byline).
 *
 * The `episodes` table is empty in production at the time of this migration,
 * so the new `author_id` column can be added NOT NULL directly with no
 * backfill step. If episodes ever exist before this migration runs in another
 * environment, drop the NOT NULL constraint and run a backfill before
 * re-applying.
 *
 * Also adds the standard FK to authors and a btree index on author_id for
 * byline-filtered queries (e.g. all episodes by Lexi).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "episodes"
      ADD COLUMN "author_id" integer NOT NULL;

    ALTER TABLE "episodes"
      ADD CONSTRAINT "episodes_author_id_authors_id_fk"
      FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id")
      ON DELETE SET NULL ON UPDATE no action;

    CREATE INDEX "episodes_author_idx" ON "episodes" USING btree ("author_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "episodes_author_idx";
    ALTER TABLE "episodes" DROP CONSTRAINT IF EXISTS "episodes_author_id_authors_id_fk";
    ALTER TABLE "episodes" DROP COLUMN IF EXISTS "author_id";
  `)
}
