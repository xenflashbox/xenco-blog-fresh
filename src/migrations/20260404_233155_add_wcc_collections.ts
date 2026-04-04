import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_wineries_region" AS ENUM('Napa Valley', 'Sonoma County', 'Coombsville AVA', 'Stags Leap District', 'Other');
  CREATE TYPE "public"."enum_wineries_featured_tier" AS ENUM('flagship', 'featured', 'listed');
  CREATE TYPE "public"."enum_wines_price_tier" AS ENUM('under-50', '50-100', '100-200', 'over-200');
  CREATE TYPE "public"."enum_restaurants_region" AS ENUM('Napa Valley', 'Sonoma County', 'Other');
  CREATE TYPE "public"."enum_restaurants_price_range" AS ENUM('$', '$$', '$$$', '$$$$');
  CREATE TYPE "public"."enum_restaurants_featured_tier" AS ENUM('flagship', 'featured', 'listed');
  CREATE TYPE "public"."enum_accommodations_region" AS ENUM('Napa Valley', 'Sonoma County', 'Other');
  CREATE TYPE "public"."enum_accommodations_type" AS ENUM('hotel', 'bb', 'vacation-rental', 'resort', 'inn');
  CREATE TYPE "public"."enum_accommodations_price_range" AS ENUM('$', '$$', '$$$', '$$$$');
  CREATE TYPE "public"."enum_accommodations_featured_tier" AS ENUM('flagship', 'featured', 'listed');
  CREATE TYPE "public"."enum_winery_events_event_type" AS ENUM('tasting', 'dinner', 'harvest', 'release', 'club', 'other');
  CREATE TABLE "wineries_varietal_focus" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"varietal" varchar
  );

  CREATE TABLE "wineries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"website" varchar,
  	"region" "enum_wineries_region",
  	"sub_appellation" varchar,
  	"tasting_available" boolean DEFAULT false,
  	"tasting_booking_url" varchar,
  	"wine_club_enabled" boolean DEFAULT false,
  	"featured" boolean DEFAULT false,
  	"featured_tier" "enum_wineries_featured_tier",
  	"featured_order" numeric,
  	"featured_hero_id" integer,
  	"featured_story" jsonb,
  	"featured_quote" varchar,
  	"featured_quote_attribution" varchar,
  	"phone" varchar,
  	"email" varchar,
  	"instagram_handle" varchar,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_zip" varchar,
  	"coordinates_lat" numeric,
  	"coordinates_lng" numeric,
  	"partner_since" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "wines" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"winery_id" integer,
  	"varietal" varchar,
  	"vintage" numeric,
  	"tasting_notes" varchar,
  	"price" numeric,
  	"price_tier" "enum_wines_price_tier",
  	"rating" numeric,
  	"purchase_url" varchar,
  	"image_id" integer,
  	"featured" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "restaurants_cuisine_type" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"cuisine" varchar
  );

  CREATE TABLE "restaurants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"website" varchar,
  	"region" "enum_restaurants_region",
  	"city" varchar,
  	"price_range" "enum_restaurants_price_range",
  	"wine_focused" boolean DEFAULT false,
  	"reservations_url" varchar,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_zip" varchar,
  	"phone" varchar,
  	"hours" varchar,
  	"featured_image_id" integer,
  	"featured" boolean DEFAULT false,
  	"featured_tier" "enum_restaurants_featured_tier",
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "accommodations_amenities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amenity" varchar
  );

  CREATE TABLE "accommodations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"website" varchar,
  	"region" "enum_accommodations_region",
  	"city" varchar,
  	"type" "enum_accommodations_type",
  	"price_range" "enum_accommodations_price_range",
  	"booking_url" varchar,
  	"address_street" varchar,
  	"address_city" varchar,
  	"address_state" varchar,
  	"address_zip" varchar,
  	"phone" varchar,
  	"featured_image_id" integer,
  	"featured" boolean DEFAULT false,
  	"featured_tier" "enum_accommodations_featured_tier",
  	"description" varchar,
  	"is_owned" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "winery_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"winery_id" integer,
  	"event_type" "enum_winery_events_event_type",
  	"start_date" timestamp(3) with time zone NOT NULL,
  	"end_date" timestamp(3) with time zone,
  	"price" numeric,
  	"price_free" boolean DEFAULT false,
  	"registration_url" varchar,
  	"description" varchar,
  	"featured_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "wineries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "wines_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "restaurants_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "accommodations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "winery_events_id" integer;
  ALTER TABLE "wineries_varietal_focus" ADD CONSTRAINT "wineries_varietal_focus_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."wineries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "wineries" ADD CONSTRAINT "wineries_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wineries" ADD CONSTRAINT "wineries_featured_hero_id_media_id_fk" FOREIGN KEY ("featured_hero_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wines" ADD CONSTRAINT "wines_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wines" ADD CONSTRAINT "wines_winery_id_wineries_id_fk" FOREIGN KEY ("winery_id") REFERENCES "public"."wineries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "wines" ADD CONSTRAINT "wines_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "restaurants_cuisine_type" ADD CONSTRAINT "restaurants_cuisine_type_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accommodations_amenities" ADD CONSTRAINT "accommodations_amenities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "accommodations" ADD CONSTRAINT "accommodations_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "winery_events" ADD CONSTRAINT "winery_events_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "winery_events" ADD CONSTRAINT "winery_events_winery_id_wineries_id_fk" FOREIGN KEY ("winery_id") REFERENCES "public"."wineries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "winery_events" ADD CONSTRAINT "winery_events_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "wineries_varietal_focus_order_idx" ON "wineries_varietal_focus" USING btree ("_order");
  CREATE INDEX "wineries_varietal_focus_parent_id_idx" ON "wineries_varietal_focus" USING btree ("_parent_id");
  CREATE INDEX "wineries_site_idx" ON "wineries" USING btree ("site_id");
  CREATE UNIQUE INDEX "wineries_slug_idx" ON "wineries" USING btree ("slug");
  CREATE INDEX "wineries_featured_hero_idx" ON "wineries" USING btree ("featured_hero_id");
  CREATE INDEX "wineries_updated_at_idx" ON "wineries" USING btree ("updated_at");
  CREATE INDEX "wineries_created_at_idx" ON "wineries" USING btree ("created_at");
  CREATE INDEX "wines_site_idx" ON "wines" USING btree ("site_id");
  CREATE UNIQUE INDEX "wines_slug_idx" ON "wines" USING btree ("slug");
  CREATE INDEX "wines_winery_idx" ON "wines" USING btree ("winery_id");
  CREATE INDEX "wines_image_idx" ON "wines" USING btree ("image_id");
  CREATE INDEX "wines_updated_at_idx" ON "wines" USING btree ("updated_at");
  CREATE INDEX "wines_created_at_idx" ON "wines" USING btree ("created_at");
  CREATE INDEX "restaurants_cuisine_type_order_idx" ON "restaurants_cuisine_type" USING btree ("_order");
  CREATE INDEX "restaurants_cuisine_type_parent_id_idx" ON "restaurants_cuisine_type" USING btree ("_parent_id");
  CREATE INDEX "restaurants_site_idx" ON "restaurants" USING btree ("site_id");
  CREATE UNIQUE INDEX "restaurants_slug_idx" ON "restaurants" USING btree ("slug");
  CREATE INDEX "restaurants_featured_image_idx" ON "restaurants" USING btree ("featured_image_id");
  CREATE INDEX "restaurants_updated_at_idx" ON "restaurants" USING btree ("updated_at");
  CREATE INDEX "restaurants_created_at_idx" ON "restaurants" USING btree ("created_at");
  CREATE INDEX "accommodations_amenities_order_idx" ON "accommodations_amenities" USING btree ("_order");
  CREATE INDEX "accommodations_amenities_parent_id_idx" ON "accommodations_amenities" USING btree ("_parent_id");
  CREATE INDEX "accommodations_site_idx" ON "accommodations" USING btree ("site_id");
  CREATE UNIQUE INDEX "accommodations_slug_idx" ON "accommodations" USING btree ("slug");
  CREATE INDEX "accommodations_featured_image_idx" ON "accommodations" USING btree ("featured_image_id");
  CREATE INDEX "accommodations_updated_at_idx" ON "accommodations" USING btree ("updated_at");
  CREATE INDEX "accommodations_created_at_idx" ON "accommodations" USING btree ("created_at");
  CREATE INDEX "winery_events_site_idx" ON "winery_events" USING btree ("site_id");
  CREATE UNIQUE INDEX "winery_events_slug_idx" ON "winery_events" USING btree ("slug");
  CREATE INDEX "winery_events_winery_idx" ON "winery_events" USING btree ("winery_id");
  CREATE INDEX "winery_events_featured_image_idx" ON "winery_events" USING btree ("featured_image_id");
  CREATE INDEX "winery_events_updated_at_idx" ON "winery_events" USING btree ("updated_at");
  CREATE INDEX "winery_events_created_at_idx" ON "winery_events" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wineries_fk" FOREIGN KEY ("wineries_id") REFERENCES "public"."wineries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_wines_fk" FOREIGN KEY ("wines_id") REFERENCES "public"."wines"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_restaurants_fk" FOREIGN KEY ("restaurants_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_accommodations_fk" FOREIGN KEY ("accommodations_id") REFERENCES "public"."accommodations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_winery_events_fk" FOREIGN KEY ("winery_events_id") REFERENCES "public"."winery_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_wineries_id_idx" ON "payload_locked_documents_rels" USING btree ("wineries_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_wines_id_idx" ON "payload_locked_documents_rels" USING btree ("wines_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_restaurants_id_idx" ON "payload_locked_documents_rels" USING btree ("restaurants_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_accommodations_id_idx" ON "payload_locked_documents_rels" USING btree ("accommodations_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_winery_events_id_idx" ON "payload_locked_documents_rels" USING btree ("winery_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "wineries_varietal_focus" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wineries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "wines" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "restaurants_cuisine_type" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "restaurants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "accommodations_amenities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "accommodations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "winery_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "wineries_varietal_focus" CASCADE;
  DROP TABLE "wineries" CASCADE;
  DROP TABLE "wines" CASCADE;
  DROP TABLE "restaurants_cuisine_type" CASCADE;
  DROP TABLE "restaurants" CASCADE;
  DROP TABLE "accommodations_amenities" CASCADE;
  DROP TABLE "accommodations" CASCADE;
  DROP TABLE "winery_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_wineries_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_wines_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_restaurants_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_accommodations_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_winery_events_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_wineries_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_wines_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_restaurants_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_accommodations_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_winery_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "wineries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "wines_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "restaurants_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "accommodations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "winery_events_id";
  DROP TYPE "public"."enum_wineries_region";
  DROP TYPE "public"."enum_wineries_featured_tier";
  DROP TYPE "public"."enum_wines_price_tier";
  DROP TYPE "public"."enum_restaurants_region";
  DROP TYPE "public"."enum_restaurants_price_range";
  DROP TYPE "public"."enum_restaurants_featured_tier";
  DROP TYPE "public"."enum_accommodations_region";
  DROP TYPE "public"."enum_accommodations_type";
  DROP TYPE "public"."enum_accommodations_price_range";
  DROP TYPE "public"."enum_accommodations_featured_tier";
  DROP TYPE "public"."enum_winery_events_event_type";`)
}
