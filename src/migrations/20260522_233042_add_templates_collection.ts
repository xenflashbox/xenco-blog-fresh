import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Migration: add_templates_collection
 *
 * Adds the global (non-tenant-scoped) BlogCraft `templates` collection and wires
 * `articles.template` as an optional relationship to it.
 *
 * Idempotent: every statement guards on existence so re-runs are safe across the
 * ~25-site production DB (Xenco production standard). Reference shape:
 * 20251215_142716_add_sites_and_article_site.ts.
 *
 * NOTE: `payload migrate:create` auto-folded unrelated vendor_certifications
 * changes into the generated file because the dev DB was behind the committed
 * `20260512_..._source_quote_reverify` migration. Those lines were removed by
 * hand — they belong to that migration, not this one.
 *
 * Changes (up):
 *   1. Enum types for template_type and article_intent
 *   2. `templates` table (jsonb for the JSON fields, unique slug)
 *   3. `articles.template_id` FK column (nullable, ON DELETE SET NULL) + index
 *   4. payload_locked_documents_rels.templates_id relation column + FK + index
 *
 * Reversible: yes — down drops everything created here.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // 1. Enum types
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_templates_template_type"
        AS ENUM('pillar', 'spoke', 'single_review', 'vs_comparison', 'roundup_review');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_templates_article_intent"
        AS ENUM('informational', 'commercial', 'transactional');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  // 2. templates table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "templates" (
      "id" serial PRIMARY KEY NOT NULL,
      "slug" varchar NOT NULL,
      "label" varchar NOT NULL,
      "template_type" "enum_templates_template_type" NOT NULL,
      "article_type" varchar NOT NULL,
      "article_intent" "enum_templates_article_intent" NOT NULL,
      "prompt_key" varchar NOT NULL,
      "outline_version" numeric DEFAULT 1 NOT NULL,
      "copy_primitives" jsonb NOT NULL,
      "required_sections" jsonb NOT NULL,
      "template_json" jsonb NOT NULL,
      "is_active" boolean DEFAULT true,
      "data_required" boolean DEFAULT false,
      "payload_schema" jsonb,
      "data_required_message" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "templates_slug_idx" ON "templates" USING btree ("slug");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "templates_updated_at_idx" ON "templates" USING btree ("updated_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "templates_created_at_idx" ON "templates" USING btree ("created_at");
  `)

  // 3. articles.template relationship (nullable — legacy rows + Make.com pipeline)
  await db.execute(sql`
    ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "template_id" integer;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_template_id_templates_id_fk') THEN
        ALTER TABLE "articles" ADD CONSTRAINT "articles_template_id_templates_id_fk"
          FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id")
          ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "articles_template_idx" ON "articles" USING btree ("template_id");
  `)

  // 4. payload internal relation table
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "templates_id" integer;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_templates_fk') THEN
        ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_templates_fk"
          FOREIGN KEY ("templates_id") REFERENCES "public"."templates"("id")
          ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_templates_id_idx"
      ON "payload_locked_documents_rels" USING btree ("templates_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "articles_template_idx";`)
  await db.execute(sql`DROP INDEX IF EXISTS "payload_locked_documents_rels_templates_id_idx";`)

  await db.execute(sql`
    ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_template_id_templates_id_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_templates_fk";
  `)

  await db.execute(sql`ALTER TABLE "articles" DROP COLUMN IF EXISTS "template_id";`)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "templates_id";
  `)

  await db.execute(sql`DROP TABLE IF EXISTS "templates" CASCADE;`)

  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_templates_template_type";`)
  await db.execute(sql`DROP TYPE IF EXISTS "public"."enum_templates_article_intent";`)
}
