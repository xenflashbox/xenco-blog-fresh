import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // New enum types for the 4 new collections
  await db.execute(sql`
    CREATE TYPE "public"."enum_suites_details_floor" AS ENUM('ground', 'upper');
    CREATE TYPE "public"."enum_suites_status" AS ENUM('active', 'inactive');
    CREATE TYPE "public"."enum_reviews_source" AS ENUM('airbnb', 'vrbo', 'booking', 'direct', 'google');
    CREATE TYPE "public"."enum_reviews_status" AS ENUM('active', 'hidden');
    CREATE TYPE "public"."enum_directory_entries_category" AS ENUM('wineries', 'restaurants', 'activities', 'venues');
    CREATE TYPE "public"."enum_directory_entries_details_price_range" AS ENUM('$', '$$', '$$$', '$$$$');
    CREATE TYPE "public"."enum_directory_entries_status" AS ENUM('active', 'inactive');
    CREATE TYPE "public"."enum_events_category" AS ENUM('music', 'wine-food', 'arts-culture', 'seasonal', 'community', 'festivals');
    CREATE TYPE "public"."enum_events_status" AS ENUM('active', 'past');
  `)

  // Suites array tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "suites_amenities" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "icon" varchar
    );

    CREATE TABLE IF NOT EXISTS "suites_images" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer NOT NULL,
      "alt" varchar NOT NULL,
      "caption" varchar,
      "is_primary" boolean DEFAULT false
    );
  `)

  // Suites main table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "suites" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_id" integer NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "tagline" varchar NOT NULL,
      "description" jsonb NOT NULL,
      "short_description" varchar,
      "details_bedrooms" numeric NOT NULL,
      "details_bathrooms" numeric NOT NULL,
      "details_max_guests" numeric NOT NULL,
      "details_sqft" numeric,
      "details_floor" "enum_suites_details_floor",
      "details_has_patio" boolean DEFAULT false,
      "details_has_en_suite" boolean DEFAULT false,
      "details_is_a_d_a_compliant" boolean DEFAULT false,
      "lodgify_property_id" varchar NOT NULL,
      "pricing_base_nightly_rate" numeric,
      "pricing_cleaning_fee" numeric,
      "pricing_direct_booking_discount" numeric,
      "seo_meta_title" varchar,
      "seo_meta_description" varchar,
      "seo_og_image_id" integer,
      "status" "enum_suites_status" DEFAULT 'active',
      "sort_order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Reviews array table + main table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "reviews_highlights" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "item" varchar
    );

    CREATE TABLE IF NOT EXISTS "reviews" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_id" integer NOT NULL,
      "reviewer_name" varchar NOT NULL,
      "reviewer_location" varchar,
      "suite_id" integer NOT NULL,
      "rating" numeric NOT NULL,
      "title" varchar,
      "content" varchar NOT NULL,
      "date" timestamp(3) with time zone NOT NULL,
      "source" "enum_reviews_source" DEFAULT 'direct',
      "is_featured" boolean DEFAULT false,
      "status" "enum_reviews_status" DEFAULT 'active',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Directory entries array table + main table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "directory_entries_tags" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tag" varchar
    );

    CREATE TABLE IF NOT EXISTS "directory_entries" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_id" integer NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "description" jsonb NOT NULL,
      "short_description" varchar,
      "category" "enum_directory_entries_category" NOT NULL,
      "subcategory" varchar,
      "featured_image_id" integer,
      "logo_id" integer,
      "location_address" varchar,
      "location_city" varchar,
      "location_latitude" numeric,
      "location_longitude" numeric,
      "location_distance_from_property" varchar,
      "location_drive_time_minutes" numeric,
      "contact_website" varchar,
      "contact_phone" varchar,
      "contact_email" varchar,
      "details_price_range" "enum_directory_entries_details_price_range",
      "details_hours" varchar,
      "details_reservation_required" boolean DEFAULT false,
      "details_tasting_fee_range" varchar,
      "details_cuisine_type" varchar,
      "details_capacity" varchar,
      "seo_meta_title" varchar,
      "seo_meta_description" varchar,
      "is_featured" boolean DEFAULT false,
      "sort_order" numeric DEFAULT 0,
      "status" "enum_directory_entries_status" DEFAULT 'active',
      "source_url" varchar,
      "last_crawled_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Events main table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events" (
      "id" serial PRIMARY KEY NOT NULL,
      "site_id" integer NOT NULL,
      "name" varchar NOT NULL,
      "slug" varchar NOT NULL,
      "description" jsonb NOT NULL,
      "short_description" varchar,
      "featured_image_id" integer,
      "start_date" timestamp(3) with time zone NOT NULL,
      "end_date" timestamp(3) with time zone,
      "category" "enum_events_category",
      "location_venue_name" varchar,
      "location_address" varchar,
      "location_city" varchar,
      "external_url" varchar,
      "seo_meta_title" varchar,
      "seo_meta_description" varchar,
      "is_featured" boolean DEFAULT false,
      "status" "enum_events_status" DEFAULT 'active',
      "source_url" varchar,
      "last_crawled_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Foreign key constraints
  await db.execute(sql`
    ALTER TABLE "suites_amenities" ADD CONSTRAINT "suites_amenities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."suites"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "suites_images" ADD CONSTRAINT "suites_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "suites_images" ADD CONSTRAINT "suites_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."suites"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "suites" ADD CONSTRAINT "suites_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "suites" ADD CONSTRAINT "suites_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "reviews_highlights" ADD CONSTRAINT "reviews_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "reviews" ADD CONSTRAINT "reviews_suite_id_suites_id_fk" FOREIGN KEY ("suite_id") REFERENCES "public"."suites"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "directory_entries_tags" ADD CONSTRAINT "directory_entries_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."directory_entries"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "directory_entries" ADD CONSTRAINT "directory_entries_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "directory_entries" ADD CONSTRAINT "directory_entries_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "directory_entries" ADD CONSTRAINT "directory_entries_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "events" ADD CONSTRAINT "events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
    ALTER TABLE "events" ADD CONSTRAINT "events_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  `)

  // Indexes for suites
  await db.execute(sql`
    CREATE INDEX "suites_amenities_order_idx" ON "suites_amenities" USING btree ("_order");
    CREATE INDEX "suites_amenities_parent_id_idx" ON "suites_amenities" USING btree ("_parent_id");
    CREATE INDEX "suites_images_order_idx" ON "suites_images" USING btree ("_order");
    CREATE INDEX "suites_images_parent_id_idx" ON "suites_images" USING btree ("_parent_id");
    CREATE INDEX "suites_images_image_idx" ON "suites_images" USING btree ("image_id");
    CREATE INDEX "suites_site_idx" ON "suites" USING btree ("site_id");
    CREATE UNIQUE INDEX "suites_slug_idx" ON "suites" USING btree ("slug");
    CREATE INDEX "suites_seo_seo_og_image_idx" ON "suites" USING btree ("seo_og_image_id");
    CREATE INDEX "suites_updated_at_idx" ON "suites" USING btree ("updated_at");
    CREATE INDEX "suites_created_at_idx" ON "suites" USING btree ("created_at");
  `)

  // Indexes for reviews
  await db.execute(sql`
    CREATE INDEX "reviews_highlights_order_idx" ON "reviews_highlights" USING btree ("_order");
    CREATE INDEX "reviews_highlights_parent_id_idx" ON "reviews_highlights" USING btree ("_parent_id");
    CREATE INDEX "reviews_site_idx" ON "reviews" USING btree ("site_id");
    CREATE INDEX "reviews_suite_idx" ON "reviews" USING btree ("suite_id");
    CREATE INDEX "reviews_date_idx" ON "reviews" USING btree ("date");
    CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
    CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  `)

  // Indexes for directory_entries
  await db.execute(sql`
    CREATE INDEX "directory_entries_tags_order_idx" ON "directory_entries_tags" USING btree ("_order");
    CREATE INDEX "directory_entries_tags_parent_id_idx" ON "directory_entries_tags" USING btree ("_parent_id");
    CREATE INDEX "directory_entries_site_idx" ON "directory_entries" USING btree ("site_id");
    CREATE UNIQUE INDEX "directory_entries_slug_idx" ON "directory_entries" USING btree ("slug");
    CREATE INDEX "directory_entries_category_idx" ON "directory_entries" USING btree ("category");
    CREATE INDEX "directory_entries_featured_image_idx" ON "directory_entries" USING btree ("featured_image_id");
    CREATE INDEX "directory_entries_logo_idx" ON "directory_entries" USING btree ("logo_id");
    CREATE INDEX "directory_entries_updated_at_idx" ON "directory_entries" USING btree ("updated_at");
    CREATE INDEX "directory_entries_created_at_idx" ON "directory_entries" USING btree ("created_at");
  `)

  // Indexes for events
  await db.execute(sql`
    CREATE INDEX "events_site_idx" ON "events" USING btree ("site_id");
    CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");
    CREATE INDEX "events_featured_image_idx" ON "events" USING btree ("featured_image_id");
    CREATE INDEX "events_start_date_idx" ON "events" USING btree ("start_date");
    CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
    CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  `)

  // Add columns to payload_locked_documents_rels for the new collections
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "suites_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "reviews_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "directory_entries_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "events_id" integer;
  `)

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_suites_fk" FOREIGN KEY ("suites_id") REFERENCES "public"."suites"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_directory_entries_fk" FOREIGN KEY ("directory_entries_id") REFERENCES "public"."directory_entries"("id") ON DELETE cascade ON UPDATE no action;
    ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
    CREATE INDEX "payload_locked_documents_rels_suites_id_idx" ON "payload_locked_documents_rels" USING btree ("suites_id");
    CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
    CREATE INDEX "payload_locked_documents_rels_directory_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("directory_entries_id");
    CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_suites_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_reviews_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_directory_entries_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_events_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_suites_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_reviews_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_directory_entries_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_events_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "suites_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "reviews_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "directory_entries_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "events_id";
    DROP TABLE IF EXISTS "suites_amenities" CASCADE;
    DROP TABLE IF EXISTS "suites_images" CASCADE;
    DROP TABLE IF EXISTS "suites" CASCADE;
    DROP TABLE IF EXISTS "reviews_highlights" CASCADE;
    DROP TABLE IF EXISTS "reviews" CASCADE;
    DROP TABLE IF EXISTS "directory_entries_tags" CASCADE;
    DROP TABLE IF EXISTS "directory_entries" CASCADE;
    DROP TABLE IF EXISTS "events" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_suites_details_floor";
    DROP TYPE IF EXISTS "public"."enum_suites_status";
    DROP TYPE IF EXISTS "public"."enum_reviews_source";
    DROP TYPE IF EXISTS "public"."enum_reviews_status";
    DROP TYPE IF EXISTS "public"."enum_directory_entries_category";
    DROP TYPE IF EXISTS "public"."enum_directory_entries_details_price_range";
    DROP TYPE IF EXISTS "public"."enum_directory_entries_status";
    DROP TYPE IF EXISTS "public"."enum_events_category";
    DROP TYPE IF EXISTS "public"."enum_events_status";
  `)
}
