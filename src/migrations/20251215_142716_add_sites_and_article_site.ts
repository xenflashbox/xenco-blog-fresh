import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Create sites table if it doesn't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "sites" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "is_default" boolean DEFAULT false,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Create sites_domains table if it doesn't exist
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "sites_domains" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "domain" varchar NOT NULL
    );
  `)

  // Drop articles_slug_idx if it exists
  await db.execute(sql`
    DROP INDEX IF EXISTS "articles_slug_idx";
  `)

  // Add prefix column to media if it doesn't exist
  await db.execute(sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='media' AND column_name='prefix') THEN
        ALTER TABLE "media" ADD COLUMN "prefix" varchar DEFAULT 'media';
      END IF;
    END $$;
  `)

  // Add site_id column to articles if it doesn't exist (allow NULL initially)
  await db.execute(sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='articles' AND column_name='site_id') THEN
        ALTER TABLE "articles" ADD COLUMN "site_id" integer;
      END IF;
    END $$;
  `)

  // Add sites_id column to payload_locked_documents_rels if it doesn't exist
  await db.execute(sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                     WHERE table_name='payload_locked_documents_rels' AND column_name='sites_id') THEN
        ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sites_id" integer;
      END IF;
    END $$;
  `)

  // Add constraints and indexes
  await db.execute(sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sites_domains_parent_id_fk') THEN
        ALTER TABLE "sites_domains" ADD CONSTRAINT "sites_domains_parent_id_fk" 
          FOREIGN KEY ("_parent_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "sites_domains_order_idx" ON "sites_domains" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "sites_domains_parent_id_idx" ON "sites_domains" USING btree ("_parent_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "sites_slug_idx" ON "sites" USING btree ("slug");
    CREATE INDEX IF NOT EXISTS "sites_updated_at_idx" ON "sites" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "sites_created_at_idx" ON "sites" USING btree ("created_at");
  `)

  await db.execute(sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'articles_site_id_sites_id_fk') THEN
        ALTER TABLE "articles" ADD CONSTRAINT "articles_site_id_sites_id_fk" 
          FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payload_locked_documents_rels_sites_fk') THEN
        ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sites_fk" 
          FOREIGN KEY ("sites_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;
      END IF;
    END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "articles_site_idx" ON "articles" USING btree ("site_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sites_id_idx" ON "payload_locked_documents_rels" USING btree ("sites_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sites_domains" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sites" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sites_domains" CASCADE;
  DROP TABLE "sites" CASCADE;
  ALTER TABLE "articles" DROP CONSTRAINT "articles_site_id_sites_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sites_fk";
  
  DROP INDEX "articles_site_idx";
  DROP INDEX "payload_locked_documents_rels_sites_id_idx";
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  ALTER TABLE "media" DROP COLUMN "prefix";
  ALTER TABLE "articles" DROP COLUMN "site_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sites_id";`)
}
