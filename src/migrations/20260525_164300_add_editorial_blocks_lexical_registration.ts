import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration: add_editorial_blocks_lexical_registration
 *
 * Editorial Block System v2 (Sprint B). Adds the two top-level Article array
 * fields — `top_takeaways` and `footer_sources` — as relational child tables.
 *
 * IMPORTANT: the 37 editorial blocks themselves require NO schema change. They are
 * registered via Lexical `BlocksFeature` on the `articles.content` richText field
 * and are stored as nodes INSIDE that JSONB column — not as relational tables.
 * Only top-level array fields on the collection get child tables, hence just these
 * two. (The Sprint B prompt's expectation of "dozens of articles_blocks_* tables"
 * was incorrect for Lexical-embedded blocks.)
 *
 * Idempotent: IF NOT EXISTS on tables/indexes, pg_constraint guard on FKs
 * (repo standard). Additive only — safe across the ~25 production sites; existing
 * articles get zero child rows and render unchanged.
 *
 * Reversible: down drops both tables with IF EXISTS.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "articles_top_takeaways" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "text" varchar NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "articles_footer_sources" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL,
      "publisher" varchar,
      "url" varchar NOT NULL,
      "date" timestamp(3) with time zone,
      "quote_context" varchar
    );
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_top_takeaways_parent_id_fk') THEN
        ALTER TABLE "articles_top_takeaways" ADD CONSTRAINT "articles_top_takeaways_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_footer_sources_parent_id_fk') THEN
        ALTER TABLE "articles_footer_sources" ADD CONSTRAINT "articles_footer_sources_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "articles_top_takeaways_order_idx"
      ON "articles_top_takeaways" USING btree ("_order");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "articles_top_takeaways_parent_id_idx"
      ON "articles_top_takeaways" USING btree ("_parent_id");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "articles_footer_sources_order_idx"
      ON "articles_footer_sources" USING btree ("_order");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "articles_footer_sources_parent_id_idx"
      ON "articles_footer_sources" USING btree ("_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "articles_top_takeaways" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "articles_footer_sources" CASCADE;`)
}
