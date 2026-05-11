import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── Enum types for Specialists ───────────────────────────────────────────────
  await db.execute(sql`
    CREATE TYPE "public"."enum_specialists_type"
      AS ENUM(
        'endocrinologist',
        'cdces',
        'diabetes-clinic',
        'primary-care-with-diabetes-focus',
        'pediatric-endocrinologist'
      );

    CREATE TYPE "public"."enum_specialists_featured_tier"
      AS ENUM('flagship', 'featured', 'standard');

    CREATE TYPE "public"."enum_specialists_status"
      AS ENUM('draft', 'published', 'archived');

    CREATE TYPE "public"."enum_specialists_data_source"
      AS ENUM('npi-registry', 'manual-entry', 'claimed', 'imported');

    CREATE TYPE "public"."enum_regions_tier"
      AS ENUM('state', 'metro', 'region');
  `)

  // ── regions ──────────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "regions" (
      "id"          serial PRIMARY KEY NOT NULL,
      "site_id"     integer NOT NULL,
      "name"        varchar NOT NULL,
      "slug"        varchar NOT NULL,
      "tier"        "enum_regions_tier" NOT NULL,
      "state_code"  varchar,
      "description" varchar,
      "updated_at"  timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"  timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ── specialists ───────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "specialists" (
      "id"                          serial PRIMARY KEY NOT NULL,
      "site_id"                     integer NOT NULL,
      "name"                        varchar NOT NULL,
      "slug"                        varchar NOT NULL,
      "type"                        "enum_specialists_type" NOT NULL,
      "credentials"                 varchar,
      "npi"                         varchar,
      "practice_name"               varchar,
      "bio"                         jsonb,
      "years_in_practice"           numeric,
      "accepting_new_patients"      boolean DEFAULT true NOT NULL,
      "telehealth_available"        boolean DEFAULT false NOT NULL,
      "location_address1"           varchar,
      "location_address2"           varchar,
      "location_city"               varchar NOT NULL,
      "location_state"              varchar NOT NULL,
      "location_zip_code"           varchar NOT NULL,
      "location_latitude"           numeric,
      "location_longitude"          numeric,
      "phone"                       varchar,
      "fax"                         varchar,
      "website_url"                 varchar,
      "booking_url"                 varchar,
      "photo_id"                    integer,
      "featured"                    boolean DEFAULT false NOT NULL,
      "featured_tier"               "enum_specialists_featured_tier",
      "featured_order"              numeric,
      "claimed_by_owner"            boolean DEFAULT false NOT NULL,
      "verified_date"               timestamp(3) with time zone,
      "editorial_note"              jsonb,
      "patient_review_summary"      jsonb,
      "status"                      "enum_specialists_status" DEFAULT 'draft' NOT NULL,
      "published_at"                timestamp(3) with time zone,
      "data_source"                 "enum_specialists_data_source",
      "updated_at"                  timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"                  timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ── specialists_specialties (hasMany select) ─────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "specialists_specialties" (
      "id"         serial PRIMARY KEY NOT NULL,
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "value"      varchar
    );
  `)

  // ── specialists_languages_spoken (array of text) ──────────────────────────────
  await db.execute(sql`
    CREATE TABLE "specialists_languages_spoken" (
      "id"         serial PRIMARY KEY NOT NULL,
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "language"   varchar
    );
  `)

  // ── specialists_insurance_accepted (array of text) ────────────────────────────
  await db.execute(sql`
    CREATE TABLE "specialists_insurance_accepted" (
      "id"         serial PRIMARY KEY NOT NULL,
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "plan"       varchar
    );
  `)

  // ── specialists_photo_gallery (array of uploads) ──────────────────────────────
  await db.execute(sql`
    CREATE TABLE "specialists_photo_gallery" (
      "id"         serial PRIMARY KEY NOT NULL,
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "image_id"   integer
    );
  `)

  // ── specialists_rels (for hasMany relationships: regions) ─────────────────────
  await db.execute(sql`
    CREATE TABLE "specialists_rels" (
      "id"          serial PRIMARY KEY NOT NULL,
      "order"       integer,
      "parent_id"   integer NOT NULL,
      "path"        varchar NOT NULL,
      "regions_id"  integer
    );
  `)

  // ── Sites: branding + newsletter columns ─────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "sites"
      ADD COLUMN IF NOT EXISTS "tagline"            varchar,
      ADD COLUMN IF NOT EXISTS "description"        varchar,
      ADD COLUMN IF NOT EXISTS "logo_id"            integer,
      ADD COLUMN IF NOT EXISTS "favicon_id"         integer,
      ADD COLUMN IF NOT EXISTS "theme_color"        varchar,
      ADD COLUMN IF NOT EXISTS "background_color"   varchar,
      ADD COLUMN IF NOT EXISTS "listmonk_list_id"   varchar,
      ADD COLUMN IF NOT EXISTS "mautic_segment_id"  varchar;
  `)

  // ── Authors: role + email columns ─────────────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "authors"
      ADD COLUMN IF NOT EXISTS "role"  varchar,
      ADD COLUMN IF NOT EXISTS "email" varchar;
  `)

  // ── payload_locked_documents_rels: new collection columns ─────────────────────
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "specialists_id" integer,
      ADD COLUMN IF NOT EXISTS "regions_id"     integer;
  `)

  // ── Foreign key constraints ────────────────────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "regions"
      ADD CONSTRAINT "regions_site_id_sites_id_fk"
        FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id")
        ON DELETE set null ON UPDATE no action;

    ALTER TABLE "specialists"
      ADD CONSTRAINT "specialists_site_id_sites_id_fk"
        FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "specialists_photo_id_media_id_fk"
        FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;

    ALTER TABLE "sites"
      ADD CONSTRAINT "sites_logo_id_media_id_fk"
        FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "sites_favicon_id_media_id_fk"
        FOREIGN KEY ("favicon_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;

    ALTER TABLE "specialists_specialties"
      ADD CONSTRAINT "specialists_specialties_parent_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."specialists"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "specialists_languages_spoken"
      ADD CONSTRAINT "specialists_languages_spoken_parent_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."specialists"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "specialists_insurance_accepted"
      ADD CONSTRAINT "specialists_insurance_accepted_parent_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."specialists"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "specialists_photo_gallery"
      ADD CONSTRAINT "specialists_photo_gallery_parent_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."specialists"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "specialists_photo_gallery_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;

    ALTER TABLE "specialists_rels"
      ADD CONSTRAINT "specialists_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."specialists"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "specialists_rels_regions_fk"
        FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_specialists_fk"
        FOREIGN KEY ("specialists_id") REFERENCES "public"."specialists"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "payload_locked_documents_rels_regions_fk"
        FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id")
        ON DELETE cascade ON UPDATE no action;
  `)

  // ── Indexes ────────────────────────────────────────────────────────────────────
  await db.execute(sql`
    -- regions
    CREATE UNIQUE INDEX "regions_site_slug_idx"    ON "regions" USING btree ("site_id", "slug");
    CREATE INDEX        "regions_site_idx"          ON "regions" USING btree ("site_id");
    CREATE INDEX        "regions_tier_idx"          ON "regions" USING btree ("tier");
    CREATE INDEX        "regions_state_code_idx"    ON "regions" USING btree ("state_code");
    CREATE INDEX        "regions_updated_at_idx"    ON "regions" USING btree ("updated_at");
    CREATE INDEX        "regions_created_at_idx"    ON "regions" USING btree ("created_at");

    -- specialists (directory listing query pattern + location)
    CREATE UNIQUE INDEX "specialists_site_slug_idx"   ON "specialists" USING btree ("site_id", "slug");
    CREATE INDEX        "specialists_site_idx"         ON "specialists" USING btree ("site_id");
    CREATE INDEX        "specialists_status_idx"       ON "specialists" USING btree ("status");
    CREATE INDEX        "specialists_featured_idx"     ON "specialists" USING btree ("featured");
    CREATE INDEX        "specialists_featured_tier_idx" ON "specialists" USING btree ("featured_tier");
    CREATE INDEX        "specialists_featured_order_idx" ON "specialists" USING btree ("featured_order");
    CREATE INDEX        "specialists_type_idx"         ON "specialists" USING btree ("type");
    CREATE INDEX        "specialists_state_city_idx"   ON "specialists" USING btree ("location_state", "location_city");
    CREATE UNIQUE INDEX "specialists_npi_idx"
      ON "specialists" USING btree ("npi")
      WHERE "npi" IS NOT NULL;
    CREATE INDEX        "specialists_updated_at_idx"   ON "specialists" USING btree ("updated_at");
    CREATE INDEX        "specialists_created_at_idx"   ON "specialists" USING btree ("created_at");

    -- specialists child tables
    CREATE INDEX "specialists_specialties_order_idx"  ON "specialists_specialties" USING btree ("_order");
    CREATE INDEX "specialists_specialties_parent_idx" ON "specialists_specialties" USING btree ("_parent_id");

    CREATE INDEX "specialists_languages_spoken_order_idx"  ON "specialists_languages_spoken" USING btree ("_order");
    CREATE INDEX "specialists_languages_spoken_parent_idx" ON "specialists_languages_spoken" USING btree ("_parent_id");

    CREATE INDEX "specialists_insurance_accepted_order_idx"  ON "specialists_insurance_accepted" USING btree ("_order");
    CREATE INDEX "specialists_insurance_accepted_parent_idx" ON "specialists_insurance_accepted" USING btree ("_parent_id");

    CREATE INDEX "specialists_photo_gallery_order_idx"  ON "specialists_photo_gallery" USING btree ("_order");
    CREATE INDEX "specialists_photo_gallery_parent_idx" ON "specialists_photo_gallery" USING btree ("_parent_id");

    CREATE INDEX "specialists_rels_order_idx"       ON "specialists_rels" USING btree ("order");
    CREATE INDEX "specialists_rels_parent_idx"      ON "specialists_rels" USING btree ("parent_id");
    CREATE INDEX "specialists_rels_path_idx"        ON "specialists_rels" USING btree ("path");
    CREATE INDEX "specialists_rels_regions_id_idx"  ON "specialists_rels" USING btree ("regions_id");

    -- payload_locked_documents_rels
    CREATE INDEX "payload_locked_documents_rels_specialists_id_idx"
      ON "payload_locked_documents_rels" USING btree ("specialists_id");
    CREATE INDEX "payload_locked_documents_rels_regions_id_idx"
      ON "payload_locked_documents_rels" USING btree ("regions_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "specialists_rels"              CASCADE;
    DROP TABLE IF EXISTS "specialists_photo_gallery"     CASCADE;
    DROP TABLE IF EXISTS "specialists_insurance_accepted" CASCADE;
    DROP TABLE IF EXISTS "specialists_languages_spoken"  CASCADE;
    DROP TABLE IF EXISTS "specialists_specialties"       CASCADE;
    DROP TABLE IF EXISTS "specialists"                   CASCADE;
    DROP TABLE IF EXISTS "regions"                       CASCADE;

    ALTER TABLE "sites"
      DROP COLUMN IF EXISTS "tagline",
      DROP COLUMN IF EXISTS "description",
      DROP COLUMN IF EXISTS "logo_id",
      DROP COLUMN IF EXISTS "favicon_id",
      DROP COLUMN IF EXISTS "theme_color",
      DROP COLUMN IF EXISTS "background_color",
      DROP COLUMN IF EXISTS "listmonk_list_id",
      DROP COLUMN IF EXISTS "mautic_segment_id";

    ALTER TABLE "authors"
      DROP COLUMN IF EXISTS "role",
      DROP COLUMN IF EXISTS "email";

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "specialists_id",
      DROP COLUMN IF EXISTS "regions_id";

    DROP TYPE IF EXISTS "public"."enum_specialists_type";
    DROP TYPE IF EXISTS "public"."enum_specialists_featured_tier";
    DROP TYPE IF EXISTS "public"."enum_specialists_status";
    DROP TYPE IF EXISTS "public"."enum_specialists_data_source";
    DROP TYPE IF EXISTS "public"."enum_regions_tier";
  `)
}
