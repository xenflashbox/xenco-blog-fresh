import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create support_kb_articles table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_kb_articles" (
      "id" serial PRIMARY KEY NOT NULL,
      "app_slug" varchar NOT NULL,
      "title" varchar NOT NULL,
      "summary" varchar,
      "body" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "_status" varchar DEFAULT 'draft'
    );
  `)

  // Create support_kb_articles_routes array table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_kb_articles_routes" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "route" varchar NOT NULL
    );
  `)

  // Create support_playbooks table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_playbooks" (
      "id" serial PRIMARY KEY NOT NULL,
      "app_slug" varchar NOT NULL,
      "title" varchar NOT NULL,
      "summary" varchar,
      "severity" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "_status" varchar DEFAULT 'draft'
    );
  `)

  // Create support_playbooks arrays
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_playbooks_routes" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "route" varchar NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_playbooks_triggers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "phrase" varchar NOT NULL
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_playbooks_steps" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "step_title" varchar,
      "step_body" varchar
    );
  `)

  // Create support_announcements table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_announcements" (
      "id" serial PRIMARY KEY NOT NULL,
      "app_slug" varchar NOT NULL,
      "title" varchar NOT NULL,
      "message" varchar NOT NULL,
      "severity" varchar DEFAULT 'info',
      "active_from" timestamp(3) with time zone,
      "active_until" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "_status" varchar DEFAULT 'draft'
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_announcements_routes" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "route" varchar NOT NULL
    );
  `)

  // Add versioning tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_support_kb_articles_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_app_slug" varchar,
      "version_title" varchar,
      "version_summary" varchar,
      "version_body" jsonb,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "version__status" varchar DEFAULT 'draft',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "latest" boolean,
      "autosave" boolean
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_support_kb_articles_v_version_routes" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "route" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_support_playbooks_v_version_routes" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "route" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_support_playbooks_v_version_triggers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "phrase" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_support_playbooks_v_version_steps" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "step_title" varchar,
      "step_body" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_support_announcements_v_version_routes" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "route" varchar,
      "_uuid" varchar
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_support_playbooks_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_app_slug" varchar,
      "version_title" varchar,
      "version_summary" varchar,
      "version_severity" varchar,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "version__status" varchar DEFAULT 'draft',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "latest" boolean,
      "autosave" boolean
    );
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_support_announcements_v" (
      "id" serial PRIMARY KEY NOT NULL,
      "parent_id" integer,
      "version_app_slug" varchar,
      "version_title" varchar,
      "version_message" varchar,
      "version_severity" varchar,
      "version_active_from" timestamp(3) with time zone,
      "version_active_until" timestamp(3) with time zone,
      "version_updated_at" timestamp(3) with time zone,
      "version_created_at" timestamp(3) with time zone,
      "version__status" varchar DEFAULT 'draft',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "latest" boolean,
      "autosave" boolean
    );
  `)

  // Add columns to payload_locked_documents_rels for the new collections
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "support_kb_articles_id" integer;
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "support_playbooks_id" integer;
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
    ADD COLUMN IF NOT EXISTS "support_announcements_id" integer;
  `)

  // Create indexes
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_kb_articles_app_slug_idx" ON "support_kb_articles" USING btree ("app_slug");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_kb_articles_created_at_idx" ON "support_kb_articles" USING btree ("created_at");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_playbooks_app_slug_idx" ON "support_playbooks" USING btree ("app_slug");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_announcements_app_slug_idx" ON "support_announcements" USING btree ("app_slug");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_support_kb_articles_id_idx"
    ON "payload_locked_documents_rels" USING btree ("support_kb_articles_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_support_playbooks_id_idx"
    ON "payload_locked_documents_rels" USING btree ("support_playbooks_id");
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_support_announcements_id_idx"
    ON "payload_locked_documents_rels" USING btree ("support_announcements_id");
  `)

  // Add foreign keys for array tables
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "support_kb_articles_routes" ADD CONSTRAINT "support_kb_articles_routes_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "support_kb_articles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "support_playbooks_routes" ADD CONSTRAINT "support_playbooks_routes_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "support_playbooks"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "support_playbooks_triggers" ADD CONSTRAINT "support_playbooks_triggers_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "support_playbooks"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "support_playbooks_steps" ADD CONSTRAINT "support_playbooks_steps_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "support_playbooks"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "support_announcements_routes" ADD CONSTRAINT "support_announcements_routes_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "support_announcements"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  // Add foreign keys for locked documents rels
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_kb_articles_fk"
      FOREIGN KEY ("support_kb_articles_id") REFERENCES "support_kb_articles"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_playbooks_fk"
      FOREIGN KEY ("support_playbooks_id") REFERENCES "support_playbooks"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_support_announcements_fk"
      FOREIGN KEY ("support_announcements_id") REFERENCES "support_announcements"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop foreign keys from locked documents
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_support_kb_articles_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_support_playbooks_fk";
  `)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_support_announcements_fk";
  `)

  // Drop columns from locked documents
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "support_kb_articles_id";
  `)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "support_playbooks_id";
  `)
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "support_announcements_id";
  `)

  // Drop version tables
  await db.execute(sql`DROP TABLE IF EXISTS "_support_announcements_v_version_routes" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "_support_announcements_v" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "_support_playbooks_v_version_steps" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "_support_playbooks_v_version_triggers" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "_support_playbooks_v_version_routes" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "_support_playbooks_v" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "_support_kb_articles_v_version_routes" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "_support_kb_articles_v" CASCADE;`)

  // Drop array tables
  await db.execute(sql`DROP TABLE IF EXISTS "support_announcements_routes" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "support_playbooks_steps" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "support_playbooks_triggers" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "support_playbooks_routes" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "support_kb_articles_routes" CASCADE;`)

  // Drop main tables
  await db.execute(sql`DROP TABLE IF EXISTS "support_announcements" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "support_playbooks" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "support_kb_articles" CASCADE;`)
}
