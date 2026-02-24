import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "internal_link_rules" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_id" integer NOT NULL,
      "target_article_id" integer NOT NULL,
      "priority" numeric DEFAULT 100,
      "max_links_per_source" numeric DEFAULT 1,
      "case_sensitive" boolean DEFAULT false,
      "partial_match" boolean DEFAULT false,
      "enabled" boolean DEFAULT true,
      "source" varchar DEFAULT 'manual',
      "notes" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "internal_link_rules_keywords" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "keyword" varchar NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "internal_link_runs" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_id" integer,
      "mode" varchar NOT NULL,
      "status" varchar NOT NULL,
      "strategy_version" varchar NOT NULL,
      "trigger" varchar NOT NULL,
      "started_at" timestamp(3) with time zone,
      "ended_at" timestamp(3) with time zone,
      "cursor" jsonb,
      "stats" jsonb NOT NULL,
      "lock_key" varchar NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "internal_link_runs_errors" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "article_id" varchar,
      "message" varchar NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "internal_link_edges" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_id" integer NOT NULL,
      "source_article_id" integer NOT NULL,
      "target_article_id" integer NOT NULL,
      "keyword_used" varchar,
      "anchor_text" varchar,
      "context_hash" varchar NOT NULL,
      "placement" varchar NOT NULL,
      "run_id_id" integer NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "internal_link_rules_id" integer,
      ADD COLUMN IF NOT EXISTS "internal_link_edges_id" integer,
      ADD COLUMN IF NOT EXISTS "internal_link_runs_id" integer;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "internal_link_rules_site_idx" ON "internal_link_rules" USING btree ("site_id");
    CREATE INDEX IF NOT EXISTS "internal_link_rules_target_article_idx" ON "internal_link_rules" USING btree ("target_article_id");
    CREATE INDEX IF NOT EXISTS "internal_link_rules_enabled_idx" ON "internal_link_rules" USING btree ("enabled");
    CREATE INDEX IF NOT EXISTS "internal_link_runs_site_idx" ON "internal_link_runs" USING btree ("site_id");
    CREATE INDEX IF NOT EXISTS "internal_link_runs_status_idx" ON "internal_link_runs" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "internal_link_runs_lock_key_idx" ON "internal_link_runs" USING btree ("lock_key");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_site_idx" ON "internal_link_edges" USING btree ("site_id");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_source_article_idx" ON "internal_link_edges" USING btree ("source_article_id");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_target_article_idx" ON "internal_link_edges" USING btree ("target_article_id");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_context_hash_idx" ON "internal_link_edges" USING btree ("context_hash");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_run_idx" ON "internal_link_edges" USING btree ("run_id_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "internal_link_edges_unique_idx"
      ON "internal_link_edges" USING btree ("site_id", "source_article_id", "target_article_id", "placement", "context_hash");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_internal_link_rules_idx"
      ON "payload_locked_documents_rels" USING btree ("internal_link_rules_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_internal_link_edges_idx"
      ON "payload_locked_documents_rels" USING btree ("internal_link_edges_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_internal_link_runs_idx"
      ON "payload_locked_documents_rels" USING btree ("internal_link_runs_id");
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "internal_link_rules" ADD CONSTRAINT "internal_link_rules_site_fk"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_rules" ADD CONSTRAINT "internal_link_rules_target_article_fk"
      FOREIGN KEY ("target_article_id") REFERENCES "articles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_rules_keywords" ADD CONSTRAINT "internal_link_rules_keywords_parent_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "internal_link_rules"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_runs" ADD CONSTRAINT "internal_link_runs_site_fk"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_runs_errors" ADD CONSTRAINT "internal_link_runs_errors_parent_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "internal_link_runs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_edges" ADD CONSTRAINT "internal_link_edges_site_fk"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_edges" ADD CONSTRAINT "internal_link_edges_source_article_fk"
      FOREIGN KEY ("source_article_id") REFERENCES "articles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_edges" ADD CONSTRAINT "internal_link_edges_target_article_fk"
      FOREIGN KEY ("target_article_id") REFERENCES "articles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_edges" ADD CONSTRAINT "internal_link_edges_run_fk"
      FOREIGN KEY ("run_id_id") REFERENCES "internal_link_runs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_internal_link_rules_fk"
      FOREIGN KEY ("internal_link_rules_id") REFERENCES "internal_link_rules"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_internal_link_edges_fk"
      FOREIGN KEY ("internal_link_edges_id") REFERENCES "internal_link_edges"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_internal_link_runs_fk"
      FOREIGN KEY ("internal_link_runs_id") REFERENCES "internal_link_runs"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_internal_link_rules_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_internal_link_edges_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_internal_link_runs_fk";

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "internal_link_rules_id",
      DROP COLUMN IF EXISTS "internal_link_edges_id",
      DROP COLUMN IF EXISTS "internal_link_runs_id";

    DROP TABLE IF EXISTS "internal_link_edges" CASCADE;
    DROP TABLE IF EXISTS "internal_link_runs_errors" CASCADE;
    DROP TABLE IF EXISTS "internal_link_runs" CASCADE;
    DROP TABLE IF EXISTS "internal_link_rules_keywords" CASCADE;
    DROP TABLE IF EXISTS "internal_link_rules" CASCADE;
  `)
}
