import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_categories_color" AS ENUM('green', 'violet', 'blue', 'coral', 'champagne');
  CREATE TYPE "public"."enum_tags_group" AS ENUM('industry', 'persona', 'regulation', 'certification', 'topic', 'media', 'method', 'vendor-relationship', 'diabetes-type', 'audience', 'format');
  CREATE TYPE "public"."enum_directory_entries_tier" AS ENUM('tier-1', 'tier-2', 'tier-3');
  CREATE TYPE "public"."enum_directory_entries_winery_details_ava" AS ENUM('sonoma-valley', 'russian-river-valley', 'dry-creek-valley', 'alexander-valley', 'knights-valley', 'bennett-valley', 'chalk-hill', 'rockpile', 'sonoma-coast', 'sonoma-mountain', 'carneros-sonoma', 'napa-valley', 'stags-leap', 'oakville', 'rutherford', 'st-helena', 'calistoga', 'mount-veeder', 'howell-mountain', 'spring-mountain', 'atlas-peak', 'diamond-mountain', 'yountville', 'oak-knoll', 'wild-horse-valley', 'carneros-napa', 'coombsville');
  CREATE TYPE "public"."enum_directory_entries_winery_details_winery_type" AS ENUM('boutique', 'small-estate', 'mid-size', 'large');
  CREATE TYPE "public"."enum_directory_entries_commerce7_confidence_level" AS ENUM('high', 'medium', 'low');
  CREATE TYPE "public"."enum_directory_entries_commerce7_partnership_status" AS ENUM('not-contacted', 'outreach-sent', 'in-conversation', 'active', 'declined');
  CREATE TYPE "public"."enum_specialists_specialties" AS ENUM('type-1-diabetes', 'type-2-diabetes', 'lada', 'mody', 'type-3c', 'gestational', 'pediatric', 'geriatric', 'insulin-pump-management', 'cgm-management', 'diabetic-neuropathy', 'diabetic-retinopathy', 'diabetic-kidney-disease', 'weight-management-glp1');
  CREATE TYPE "public"."enum_specialists_type" AS ENUM('endocrinologist', 'cdces', 'diabetes-clinic', 'primary-care-with-diabetes-focus', 'pediatric-endocrinologist');
  CREATE TYPE "public"."enum_specialists_featured_tier" AS ENUM('flagship', 'featured', 'standard');
  CREATE TYPE "public"."enum_specialists_status" AS ENUM('draft', 'published', 'archived');
  CREATE TYPE "public"."enum_specialists_data_source" AS ENUM('npi-registry', 'manual-entry', 'claimed', 'imported');
  CREATE TYPE "public"."enum_regions_tier" AS ENUM('state', 'metro', 'region');
  CREATE TYPE "public"."enum_vendors_coverage_area" AS ENUM('northeast', 'southeast', 'midwest', 'southwest', 'west', 'national', 'global', 'regional-specify');
  CREATE TYPE "public"."enum_vendors_regional_states_state_code" AS ENUM('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK');
  CREATE TYPE "public"."enum_vendors_editorial_summary_status" AS ENUM('draft', 'published', 'needs-review');
  CREATE TYPE "public"."enum_vendors_claim_status" AS ENUM('unclaimed', 'pending-claim', 'claimed');
  CREATE TYPE "public"."enum_vendors_acquisition_subsidiary_status" AS ENUM('operating-as-brand', 'merged-into-parent', 'winding-down');
  CREATE TYPE "public"."enum_vendor_certifications_verification_status" AS ENUM('self-reported', 'verified', 'expired', 'unverifiable');
  CREATE TYPE "public"."enum_vendor_facilities_ownership" AS ENUM('owned', 'leased', 'partner');
  CREATE TYPE "public"."enum_vendor_services_service_type" AS ENUM('itad', 'media-destruction', 'data-wiping', 'remarketing', 'recycling', 'refurbishment', 'logistics', 'leased-equipment-return', 'itam', 'cod', 'on-site', 'cloud-decommission', 'other');
  CREATE TYPE "public"."enum_commercial_relationships_connection_type" AS ENUM('referral-partner', 'premium-placement', 'sponsored-content');
  CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'contacted', 'qualified', 'closed');
  CREATE TYPE "public"."enum_series_status" AS ENUM('active', 'complete', 'paused');
  CREATE TYPE "public"."enum_episodes_video_source" AS ENUM('youtube', 'tiktok', 'direct');
  CREATE TYPE "public"."enum_episodes_status" AS ENUM('draft', 'scheduled', 'published', 'archived');
  CREATE TYPE "public"."enum_promos_placement" AS ENUM('home-banner', 'sidebar-mid', 'sidebar-bottom', 'in-article', 'newsletter-footer');
  CREATE TYPE "public"."enum_promos_product" AS ENUM('blogcraft', 'resumecoach', 'imagecrafter', 'devmaestro', 'mcpforge', 'hisatech', 'other');
  ALTER TYPE "public"."enum_directory_entries_category" ADD VALUE 'lodging';
  ALTER TYPE "public"."enum_directory_entries_status" ADD VALUE 'draft';
  CREATE TABLE "directory_entries_extended_content_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" jsonb
  );
  
  CREATE TABLE "directory_entries_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"alt" varchar,
  	"caption" varchar
  );
  
  CREATE TABLE "directory_entries_winery_details_varietals_produced" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"varietal" varchar
  );
  
  CREATE TABLE "directory_entries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer,
  	"directory_entries_id" integer
  );
  
  CREATE TABLE "specialists_specialties" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_specialists_specialties",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "specialists_languages_spoken" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"language" varchar NOT NULL
  );
  
  CREATE TABLE "specialists_insurance_accepted" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"plan" varchar NOT NULL
  );
  
  CREATE TABLE "specialists_photo_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "specialists" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"type" "enum_specialists_type" NOT NULL,
  	"credentials" varchar,
  	"npi" varchar,
  	"practice_name" varchar,
  	"bio" jsonb,
  	"years_in_practice" numeric,
  	"accepting_new_patients" boolean DEFAULT true,
  	"telehealth_available" boolean DEFAULT false,
  	"location_address1" varchar,
  	"location_address2" varchar,
  	"location_city" varchar NOT NULL,
  	"location_state" varchar NOT NULL,
  	"location_zip_code" varchar NOT NULL,
  	"location_latitude" numeric,
  	"location_longitude" numeric,
  	"phone" varchar,
  	"fax" varchar,
  	"website_url" varchar,
  	"booking_url" varchar,
  	"photo_id" integer,
  	"featured" boolean DEFAULT false,
  	"featured_tier" "enum_specialists_featured_tier",
  	"featured_order" numeric,
  	"claimed_by_owner" boolean DEFAULT false,
  	"verified_date" timestamp(3) with time zone,
  	"editorial_note" jsonb,
  	"patient_review_summary" jsonb,
  	"status" "enum_specialists_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"data_source" "enum_specialists_data_source",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "specialists_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"regions_id" integer
  );
  
  CREATE TABLE "regions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"tier" "enum_regions_tier" NOT NULL,
  	"state_code" varchar,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "industries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"display_name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vendors_coverage_area" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_vendors_coverage_area",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "vendors_regional_states" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"state_code" "enum_vendors_regional_states_state_code"
  );
  
  CREATE TABLE "vendors_notable_clients" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"client_name" varchar NOT NULL,
  	"is_publicly_disclosed" boolean DEFAULT false,
  	"disclosure_source_url" varchar
  );
  
  CREATE TABLE "vendors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"website" varchar,
  	"description" varchar,
  	"logo_id" integer,
  	"hq_city" varchar,
  	"hq_state" varchar,
  	"hq_country" varchar DEFAULT 'US',
  	"phone" varchar,
  	"email" varchar,
  	"founded_year" numeric,
  	"employee_count_range" varchar,
  	"editorial_canonical_descriptor" varchar,
  	"editorial_summary" jsonb,
  	"editorial_summary_status" "enum_vendors_editorial_summary_status" DEFAULT 'draft',
  	"editorial_summary_reviewer_id" integer,
  	"editorial_summary_last_reviewed" timestamp(3) with time zone,
  	"editorial_industry_notes" jsonb,
  	"has_verified_certifications" boolean DEFAULT false,
  	"is_published" boolean DEFAULT false,
  	"claim_status" "enum_vendors_claim_status" DEFAULT 'unclaimed',
  	"provenance_primary_source_url" varchar,
  	"provenance_crawled_at" timestamp(3) with time zone,
  	"provenance_last_verified_at" timestamp(3) with time zone,
  	"provenance_crawler_version" varchar,
  	"provenance_verification_notes" varchar,
  	"data_quality_flags_sparse_data" boolean DEFAULT false,
  	"data_quality_flags_awaiting_re_verification" boolean DEFAULT false,
  	"data_quality_flags_bot_protection_limited_crawl" boolean DEFAULT false,
  	"data_quality_flags_editor_note" varchar,
  	"parent_company_id" integer,
  	"acquisition_acquired_date" timestamp(3) with time zone,
  	"acquisition_announcement_url" varchar,
  	"acquisition_subsidiary_status" "enum_vendors_acquisition_subsidiary_status",
  	"acquisition_acquired_entity_notes" varchar,
  	"parent_company_text" varchar,
  	"parent_company_text_notes" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vendors_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"industries_id" integer
  );
  
  CREATE TABLE "vendor_certifications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendor_id" integer NOT NULL,
  	"certification_name" varchar NOT NULL,
  	"certification_body" varchar,
  	"cert_number" varchar,
  	"valid_from" timestamp(3) with time zone,
  	"valid_through" timestamp(3) with time zone,
  	"verification_status" "enum_vendor_certifications_verification_status" DEFAULT 'self-reported',
  	"verification_url" varchar,
  	"verification_notes" varchar,
  	"source_quote" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vendor_facilities" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendor_id" integer NOT NULL,
  	"facility_name" varchar,
  	"address" varchar,
  	"city" varchar NOT NULL,
  	"state" varchar,
  	"country" varchar DEFAULT 'US',
  	"postal_code" varchar,
  	"lat" numeric,
  	"lng" numeric,
  	"ownership" "enum_vendor_facilities_ownership",
  	"is_headquarters" boolean DEFAULT false,
  	"sq_footage" numeric,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "vendor_services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendor_id" integer NOT NULL,
  	"service_type" "enum_vendor_services_service_type" NOT NULL,
  	"description" varchar,
  	"service_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "commercial_relationships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"vendor_id" integer NOT NULL,
  	"connection_type" "enum_commercial_relationships_connection_type" NOT NULL,
  	"effective_date" timestamp(3) with time zone NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"internal_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "leads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"first_name" varchar,
  	"last_name" varchar,
  	"email" varchar NOT NULL,
  	"phone" varchar,
  	"company" varchar,
  	"vendor_id" integer,
  	"message" varchar,
  	"source" varchar,
  	"utm_source" varchar,
  	"utm_medium" varchar,
  	"utm_campaign" varchar,
  	"utm_term" varchar,
  	"utm_content" varchar,
  	"status" "enum_leads_status" DEFAULT 'new',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "series" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"category_id" integer NOT NULL,
  	"hero_image_id" integer,
  	"total_episodes" numeric,
  	"status" "enum_series_status" DEFAULT 'active',
  	"site_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "episodes_key_takeaways" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar NOT NULL
  );
  
  CREATE TABLE "episodes_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "episodes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"hook" varchar,
  	"category_id" integer NOT NULL,
  	"author_id" integer NOT NULL,
  	"series_id" integer,
  	"episode_number" numeric,
  	"video_source" "enum_episodes_video_source" DEFAULT 'youtube' NOT NULL,
  	"youtube_id" varchar,
  	"tiktok_url" varchar,
  	"direct_video_id" integer,
  	"duration" numeric,
  	"poster_image_id" integer NOT NULL,
  	"hero_image_id" integer,
  	"transcript" varchar,
  	"extended_content" jsonb,
  	"tiktok_post_url" varchar,
  	"instagram_url" varchar,
  	"youtube_short_url" varchar,
  	"tiktok_views" numeric,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"og_image_id" integer,
  	"featured" boolean DEFAULT false,
  	"status" "enum_episodes_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"site_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "promos_placement" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_promos_placement",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "promos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"product" "enum_promos_product",
  	"headline" varchar NOT NULL,
  	"subhead" varchar,
  	"cta_text" varchar DEFAULT 'Learn more' NOT NULL,
  	"cta_url" varchar NOT NULL,
  	"image_id" integer NOT NULL,
  	"active" boolean DEFAULT true,
  	"start_date" timestamp(3) with time zone,
  	"end_date" timestamp(3) with time zone,
  	"site_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "promos_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  ALTER TABLE "sites" ADD COLUMN "tagline" varchar;
  ALTER TABLE "sites" ADD COLUMN "description" varchar;
  ALTER TABLE "sites" ADD COLUMN "logo_id" integer;
  ALTER TABLE "sites" ADD COLUMN "favicon_id" integer;
  ALTER TABLE "sites" ADD COLUMN "theme_color" varchar;
  ALTER TABLE "sites" ADD COLUMN "background_color" varchar;
  ALTER TABLE "sites" ADD COLUMN "listmonk_list_id" varchar;
  ALTER TABLE "sites" ADD COLUMN "mautic_segment_id" varchar;
  ALTER TABLE "articles" ADD COLUMN "last_reviewed" timestamp(3) with time zone;
  ALTER TABLE "authors" ADD COLUMN "role" varchar;
  ALTER TABLE "authors" ADD COLUMN "email" varchar;
  ALTER TABLE "categories" ADD COLUMN "url_segment" varchar NOT NULL;
  ALTER TABLE "categories" ADD COLUMN "sort_order" numeric;
  ALTER TABLE "categories" ADD COLUMN "color" "enum_categories_color";
  ALTER TABLE "categories" ADD COLUMN "icon_id" integer;
  ALTER TABLE "categories" ADD COLUMN "tagline" varchar;
  ALTER TABLE "tags" ADD COLUMN "group" "enum_tags_group" NOT NULL;
  ALTER TABLE "tags" ADD COLUMN "description" varchar;
  ALTER TABLE "directory_entries" ADD COLUMN "tier" "enum_directory_entries_tier" DEFAULT 'tier-1' NOT NULL;
  ALTER TABLE "directory_entries" ADD COLUMN "extended_content_what_makes_it_special" jsonb;
  ALTER TABLE "directory_entries" ADD COLUMN "extended_content_who_its_right_for" jsonb;
  ALTER TABLE "directory_entries" ADD COLUMN "extended_content_what_to_expect" jsonb;
  ALTER TABLE "directory_entries" ADD COLUMN "extended_content_local_context" jsonb;
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_ava" "enum_directory_entries_winery_details_ava";
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_winery_type" "enum_directory_entries_winery_details_winery_type";
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_family_owned" boolean DEFAULT false;
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_year_founded" numeric;
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_reservations_required" boolean DEFAULT false;
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_walk_ins_accepted" boolean DEFAULT false;
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_dog_friendly" boolean DEFAULT false;
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_family_friendly" boolean DEFAULT false;
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_picnic_friendly" boolean DEFAULT false;
  ALTER TABLE "directory_entries" ADD COLUMN "winery_details_walking_distance_from_sonoma_plaza" boolean DEFAULT false;
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_enabled" boolean DEFAULT false;
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_detected_domain" varchar;
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_detected_at" timestamp(3) with time zone;
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_confidence_level" "enum_directory_entries_commerce7_confidence_level";
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_partnership_status" "enum_directory_entries_commerce7_partnership_status" DEFAULT 'not-contacted';
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_shop_embed_code" varchar;
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_wine_club_embed_code" varchar;
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_reservation_embed_code" varchar;
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_partner_since" timestamp(3) with time zone;
  ALTER TABLE "directory_entries" ADD COLUMN "commerce7_revenue_share_rate" numeric;
  ALTER TABLE "directory_entries" ADD COLUMN "metrics_gsc_impressions30d" numeric;
  ALTER TABLE "directory_entries" ADD COLUMN "metrics_gsc_clicks30d" numeric;
  ALTER TABLE "directory_entries" ADD COLUMN "metrics_gsc_avg_position" numeric;
  ALTER TABLE "directory_entries" ADD COLUMN "metrics_last_sync_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "specialists_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "regions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "industries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vendors_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vendor_certifications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vendor_facilities_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "vendor_services_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commercial_relationships_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "leads_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "series_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "episodes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "promos_id" integer;
  ALTER TABLE "directory_entries_extended_content_faqs" ADD CONSTRAINT "directory_entries_extended_content_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."directory_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "directory_entries_gallery" ADD CONSTRAINT "directory_entries_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "directory_entries_gallery" ADD CONSTRAINT "directory_entries_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."directory_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "directory_entries_winery_details_varietals_produced" ADD CONSTRAINT "directory_entries_winery_details_varietals_produced_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."directory_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "directory_entries_rels" ADD CONSTRAINT "directory_entries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."directory_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "directory_entries_rels" ADD CONSTRAINT "directory_entries_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "directory_entries_rels" ADD CONSTRAINT "directory_entries_rels_directory_entries_fk" FOREIGN KEY ("directory_entries_id") REFERENCES "public"."directory_entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "specialists_specialties" ADD CONSTRAINT "specialists_specialties_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."specialists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "specialists_languages_spoken" ADD CONSTRAINT "specialists_languages_spoken_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."specialists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "specialists_insurance_accepted" ADD CONSTRAINT "specialists_insurance_accepted_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."specialists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "specialists_photo_gallery" ADD CONSTRAINT "specialists_photo_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "specialists_photo_gallery" ADD CONSTRAINT "specialists_photo_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."specialists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "specialists" ADD CONSTRAINT "specialists_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "specialists" ADD CONSTRAINT "specialists_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "specialists_rels" ADD CONSTRAINT "specialists_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."specialists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "specialists_rels" ADD CONSTRAINT "specialists_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "regions" ADD CONSTRAINT "regions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendors_coverage_area" ADD CONSTRAINT "vendors_coverage_area_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vendors_regional_states" ADD CONSTRAINT "vendors_regional_states_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vendors_notable_clients" ADD CONSTRAINT "vendors_notable_clients_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vendors" ADD CONSTRAINT "vendors_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendors" ADD CONSTRAINT "vendors_editorial_summary_reviewer_id_users_id_fk" FOREIGN KEY ("editorial_summary_reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendors" ADD CONSTRAINT "vendors_parent_company_id_vendors_id_fk" FOREIGN KEY ("parent_company_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendors_rels" ADD CONSTRAINT "vendors_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vendors_rels" ADD CONSTRAINT "vendors_rels_industries_fk" FOREIGN KEY ("industries_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "vendor_certifications" ADD CONSTRAINT "vendor_certifications_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_facilities" ADD CONSTRAINT "vendor_facilities_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "vendor_services" ADD CONSTRAINT "vendor_services_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "commercial_relationships" ADD CONSTRAINT "commercial_relationships_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "series" ADD CONSTRAINT "series_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "series" ADD CONSTRAINT "series_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "series" ADD CONSTRAINT "series_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "episodes_key_takeaways" ADD CONSTRAINT "episodes_key_takeaways_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "episodes_tags" ADD CONSTRAINT "episodes_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "episodes" ADD CONSTRAINT "episodes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "episodes" ADD CONSTRAINT "episodes_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "episodes" ADD CONSTRAINT "episodes_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "episodes" ADD CONSTRAINT "episodes_direct_video_id_media_id_fk" FOREIGN KEY ("direct_video_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "episodes" ADD CONSTRAINT "episodes_poster_image_id_media_id_fk" FOREIGN KEY ("poster_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "episodes" ADD CONSTRAINT "episodes_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "episodes" ADD CONSTRAINT "episodes_og_image_id_media_id_fk" FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "episodes" ADD CONSTRAINT "episodes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promos_placement" ADD CONSTRAINT "promos_placement_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promos" ADD CONSTRAINT "promos_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promos" ADD CONSTRAINT "promos_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "promos_rels" ADD CONSTRAINT "promos_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."promos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "promos_rels" ADD CONSTRAINT "promos_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "directory_entries_extended_content_faqs_order_idx" ON "directory_entries_extended_content_faqs" USING btree ("_order");
  CREATE INDEX "directory_entries_extended_content_faqs_parent_id_idx" ON "directory_entries_extended_content_faqs" USING btree ("_parent_id");
  CREATE INDEX "directory_entries_gallery_order_idx" ON "directory_entries_gallery" USING btree ("_order");
  CREATE INDEX "directory_entries_gallery_parent_id_idx" ON "directory_entries_gallery" USING btree ("_parent_id");
  CREATE INDEX "directory_entries_gallery_image_idx" ON "directory_entries_gallery" USING btree ("image_id");
  CREATE INDEX "directory_entries_winery_details_varietals_produced_order_idx" ON "directory_entries_winery_details_varietals_produced" USING btree ("_order");
  CREATE INDEX "directory_entries_winery_details_varietals_produced_parent_id_idx" ON "directory_entries_winery_details_varietals_produced" USING btree ("_parent_id");
  CREATE INDEX "directory_entries_rels_order_idx" ON "directory_entries_rels" USING btree ("order");
  CREATE INDEX "directory_entries_rels_parent_idx" ON "directory_entries_rels" USING btree ("parent_id");
  CREATE INDEX "directory_entries_rels_path_idx" ON "directory_entries_rels" USING btree ("path");
  CREATE INDEX "directory_entries_rels_articles_id_idx" ON "directory_entries_rels" USING btree ("articles_id");
  CREATE INDEX "directory_entries_rels_directory_entries_id_idx" ON "directory_entries_rels" USING btree ("directory_entries_id");
  CREATE INDEX "specialists_specialties_order_idx" ON "specialists_specialties" USING btree ("order");
  CREATE INDEX "specialists_specialties_parent_idx" ON "specialists_specialties" USING btree ("parent_id");
  CREATE INDEX "specialists_languages_spoken_order_idx" ON "specialists_languages_spoken" USING btree ("_order");
  CREATE INDEX "specialists_languages_spoken_parent_id_idx" ON "specialists_languages_spoken" USING btree ("_parent_id");
  CREATE INDEX "specialists_insurance_accepted_order_idx" ON "specialists_insurance_accepted" USING btree ("_order");
  CREATE INDEX "specialists_insurance_accepted_parent_id_idx" ON "specialists_insurance_accepted" USING btree ("_parent_id");
  CREATE INDEX "specialists_photo_gallery_order_idx" ON "specialists_photo_gallery" USING btree ("_order");
  CREATE INDEX "specialists_photo_gallery_parent_id_idx" ON "specialists_photo_gallery" USING btree ("_parent_id");
  CREATE INDEX "specialists_photo_gallery_image_idx" ON "specialists_photo_gallery" USING btree ("image_id");
  CREATE INDEX "specialists_site_idx" ON "specialists" USING btree ("site_id");
  CREATE INDEX "specialists_slug_idx" ON "specialists" USING btree ("slug");
  CREATE INDEX "specialists_type_idx" ON "specialists" USING btree ("type");
  CREATE INDEX "specialists_photo_idx" ON "specialists" USING btree ("photo_id");
  CREATE INDEX "specialists_status_idx" ON "specialists" USING btree ("status");
  CREATE INDEX "specialists_updated_at_idx" ON "specialists" USING btree ("updated_at");
  CREATE INDEX "specialists_created_at_idx" ON "specialists" USING btree ("created_at");
  CREATE INDEX "specialists_rels_order_idx" ON "specialists_rels" USING btree ("order");
  CREATE INDEX "specialists_rels_parent_idx" ON "specialists_rels" USING btree ("parent_id");
  CREATE INDEX "specialists_rels_path_idx" ON "specialists_rels" USING btree ("path");
  CREATE INDEX "specialists_rels_regions_id_idx" ON "specialists_rels" USING btree ("regions_id");
  CREATE INDEX "regions_site_idx" ON "regions" USING btree ("site_id");
  CREATE INDEX "regions_slug_idx" ON "regions" USING btree ("slug");
  CREATE INDEX "regions_tier_idx" ON "regions" USING btree ("tier");
  CREATE INDEX "regions_updated_at_idx" ON "regions" USING btree ("updated_at");
  CREATE INDEX "regions_created_at_idx" ON "regions" USING btree ("created_at");
  CREATE UNIQUE INDEX "industries_slug_idx" ON "industries" USING btree ("slug");
  CREATE INDEX "industries_updated_at_idx" ON "industries" USING btree ("updated_at");
  CREATE INDEX "industries_created_at_idx" ON "industries" USING btree ("created_at");
  CREATE INDEX "vendors_coverage_area_order_idx" ON "vendors_coverage_area" USING btree ("order");
  CREATE INDEX "vendors_coverage_area_parent_idx" ON "vendors_coverage_area" USING btree ("parent_id");
  CREATE INDEX "vendors_regional_states_order_idx" ON "vendors_regional_states" USING btree ("_order");
  CREATE INDEX "vendors_regional_states_parent_id_idx" ON "vendors_regional_states" USING btree ("_parent_id");
  CREATE INDEX "vendors_notable_clients_order_idx" ON "vendors_notable_clients" USING btree ("_order");
  CREATE INDEX "vendors_notable_clients_parent_id_idx" ON "vendors_notable_clients" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "vendors_slug_idx" ON "vendors" USING btree ("slug");
  CREATE INDEX "vendors_logo_idx" ON "vendors" USING btree ("logo_id");
  CREATE INDEX "vendors_editorial_editorial_summary_status_idx" ON "vendors" USING btree ("editorial_summary_status");
  CREATE INDEX "vendors_editorial_editorial_summary_reviewer_idx" ON "vendors" USING btree ("editorial_summary_reviewer_id");
  CREATE INDEX "vendors_has_verified_certifications_idx" ON "vendors" USING btree ("has_verified_certifications");
  CREATE INDEX "vendors_parent_company_idx" ON "vendors" USING btree ("parent_company_id");
  CREATE INDEX "vendors_updated_at_idx" ON "vendors" USING btree ("updated_at");
  CREATE INDEX "vendors_created_at_idx" ON "vendors" USING btree ("created_at");
  CREATE INDEX "vendors_rels_order_idx" ON "vendors_rels" USING btree ("order");
  CREATE INDEX "vendors_rels_parent_idx" ON "vendors_rels" USING btree ("parent_id");
  CREATE INDEX "vendors_rels_path_idx" ON "vendors_rels" USING btree ("path");
  CREATE INDEX "vendors_rels_industries_id_idx" ON "vendors_rels" USING btree ("industries_id");
  CREATE INDEX "vendor_certifications_vendor_idx" ON "vendor_certifications" USING btree ("vendor_id");
  CREATE INDEX "vendor_certifications_updated_at_idx" ON "vendor_certifications" USING btree ("updated_at");
  CREATE INDEX "vendor_certifications_created_at_idx" ON "vendor_certifications" USING btree ("created_at");
  CREATE INDEX "vendor_facilities_vendor_idx" ON "vendor_facilities" USING btree ("vendor_id");
  CREATE INDEX "vendor_facilities_updated_at_idx" ON "vendor_facilities" USING btree ("updated_at");
  CREATE INDEX "vendor_facilities_created_at_idx" ON "vendor_facilities" USING btree ("created_at");
  CREATE INDEX "vendor_services_vendor_idx" ON "vendor_services" USING btree ("vendor_id");
  CREATE INDEX "vendor_services_updated_at_idx" ON "vendor_services" USING btree ("updated_at");
  CREATE INDEX "vendor_services_created_at_idx" ON "vendor_services" USING btree ("created_at");
  CREATE INDEX "commercial_relationships_vendor_idx" ON "commercial_relationships" USING btree ("vendor_id");
  CREATE INDEX "commercial_relationships_is_active_idx" ON "commercial_relationships" USING btree ("is_active");
  CREATE INDEX "commercial_relationships_updated_at_idx" ON "commercial_relationships" USING btree ("updated_at");
  CREATE INDEX "commercial_relationships_created_at_idx" ON "commercial_relationships" USING btree ("created_at");
  CREATE INDEX "leads_vendor_idx" ON "leads" USING btree ("vendor_id");
  CREATE INDEX "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");
  CREATE INDEX "series_category_idx" ON "series" USING btree ("category_id");
  CREATE INDEX "series_hero_image_idx" ON "series" USING btree ("hero_image_id");
  CREATE INDEX "series_site_idx" ON "series" USING btree ("site_id");
  CREATE INDEX "series_updated_at_idx" ON "series" USING btree ("updated_at");
  CREATE INDEX "series_created_at_idx" ON "series" USING btree ("created_at");
  CREATE INDEX "episodes_key_takeaways_order_idx" ON "episodes_key_takeaways" USING btree ("_order");
  CREATE INDEX "episodes_key_takeaways_parent_id_idx" ON "episodes_key_takeaways" USING btree ("_parent_id");
  CREATE INDEX "episodes_tags_order_idx" ON "episodes_tags" USING btree ("_order");
  CREATE INDEX "episodes_tags_parent_id_idx" ON "episodes_tags" USING btree ("_parent_id");
  CREATE INDEX "episodes_slug_idx" ON "episodes" USING btree ("slug");
  CREATE INDEX "episodes_category_idx" ON "episodes" USING btree ("category_id");
  CREATE INDEX "episodes_author_idx" ON "episodes" USING btree ("author_id");
  CREATE INDEX "episodes_series_idx" ON "episodes" USING btree ("series_id");
  CREATE INDEX "episodes_direct_video_idx" ON "episodes" USING btree ("direct_video_id");
  CREATE INDEX "episodes_poster_image_idx" ON "episodes" USING btree ("poster_image_id");
  CREATE INDEX "episodes_hero_image_idx" ON "episodes" USING btree ("hero_image_id");
  CREATE INDEX "episodes_og_image_idx" ON "episodes" USING btree ("og_image_id");
  CREATE INDEX "episodes_site_idx" ON "episodes" USING btree ("site_id");
  CREATE INDEX "episodes_updated_at_idx" ON "episodes" USING btree ("updated_at");
  CREATE INDEX "episodes_created_at_idx" ON "episodes" USING btree ("created_at");
  CREATE INDEX "promos_placement_order_idx" ON "promos_placement" USING btree ("order");
  CREATE INDEX "promos_placement_parent_idx" ON "promos_placement" USING btree ("parent_id");
  CREATE INDEX "promos_placement_value_idx" ON "promos_placement" USING btree ("value");
  CREATE INDEX "promos_image_idx" ON "promos" USING btree ("image_id");
  CREATE INDEX "promos_active_idx" ON "promos" USING btree ("active");
  CREATE INDEX "promos_start_date_idx" ON "promos" USING btree ("start_date");
  CREATE INDEX "promos_end_date_idx" ON "promos" USING btree ("end_date");
  CREATE INDEX "promos_site_idx" ON "promos" USING btree ("site_id");
  CREATE INDEX "promos_updated_at_idx" ON "promos" USING btree ("updated_at");
  CREATE INDEX "promos_created_at_idx" ON "promos" USING btree ("created_at");
  CREATE INDEX "promos_rels_order_idx" ON "promos_rels" USING btree ("order");
  CREATE INDEX "promos_rels_parent_idx" ON "promos_rels" USING btree ("parent_id");
  CREATE INDEX "promos_rels_path_idx" ON "promos_rels" USING btree ("path");
  CREATE INDEX "promos_rels_categories_id_idx" ON "promos_rels" USING btree ("categories_id");
  ALTER TABLE "sites" ADD CONSTRAINT "sites_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sites" ADD CONSTRAINT "sites_favicon_id_media_id_fk" FOREIGN KEY ("favicon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_specialists_fk" FOREIGN KEY ("specialists_id") REFERENCES "public"."specialists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_regions_fk" FOREIGN KEY ("regions_id") REFERENCES "public"."regions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_industries_fk" FOREIGN KEY ("industries_id") REFERENCES "public"."industries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vendors_fk" FOREIGN KEY ("vendors_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vendor_certifications_fk" FOREIGN KEY ("vendor_certifications_id") REFERENCES "public"."vendor_certifications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vendor_facilities_fk" FOREIGN KEY ("vendor_facilities_id") REFERENCES "public"."vendor_facilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_vendor_services_fk" FOREIGN KEY ("vendor_services_id") REFERENCES "public"."vendor_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commercial_relationships_fk" FOREIGN KEY ("commercial_relationships_id") REFERENCES "public"."commercial_relationships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_series_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_episodes_fk" FOREIGN KEY ("episodes_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_promos_fk" FOREIGN KEY ("promos_id") REFERENCES "public"."promos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "sites_logo_idx" ON "sites" USING btree ("logo_id");
  CREATE INDEX "sites_favicon_idx" ON "sites" USING btree ("favicon_id");
  CREATE INDEX "categories_icon_idx" ON "categories" USING btree ("icon_id");
  CREATE INDEX "directory_entries_tier_idx" ON "directory_entries" USING btree ("tier");
  CREATE INDEX "directory_entries_commerce7_commerce7_enabled_idx" ON "directory_entries" USING btree ("commerce7_enabled");
  CREATE INDEX "payload_locked_documents_rels_specialists_id_idx" ON "payload_locked_documents_rels" USING btree ("specialists_id");
  CREATE INDEX "payload_locked_documents_rels_regions_id_idx" ON "payload_locked_documents_rels" USING btree ("regions_id");
  CREATE INDEX "payload_locked_documents_rels_industries_id_idx" ON "payload_locked_documents_rels" USING btree ("industries_id");
  CREATE INDEX "payload_locked_documents_rels_vendors_id_idx" ON "payload_locked_documents_rels" USING btree ("vendors_id");
  CREATE INDEX "payload_locked_documents_rels_vendor_certifications_id_idx" ON "payload_locked_documents_rels" USING btree ("vendor_certifications_id");
  CREATE INDEX "payload_locked_documents_rels_vendor_facilities_id_idx" ON "payload_locked_documents_rels" USING btree ("vendor_facilities_id");
  CREATE INDEX "payload_locked_documents_rels_vendor_services_id_idx" ON "payload_locked_documents_rels" USING btree ("vendor_services_id");
  CREATE INDEX "payload_locked_documents_rels_commercial_relationships_i_idx" ON "payload_locked_documents_rels" USING btree ("commercial_relationships_id");
  CREATE INDEX "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");
  CREATE INDEX "payload_locked_documents_rels_series_id_idx" ON "payload_locked_documents_rels" USING btree ("series_id");
  CREATE INDEX "payload_locked_documents_rels_episodes_id_idx" ON "payload_locked_documents_rels" USING btree ("episodes_id");
  CREATE INDEX "payload_locked_documents_rels_promos_id_idx" ON "payload_locked_documents_rels" USING btree ("promos_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "directory_entries_extended_content_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "directory_entries_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "directory_entries_winery_details_varietals_produced" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "directory_entries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "specialists_specialties" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "specialists_languages_spoken" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "specialists_insurance_accepted" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "specialists_photo_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "specialists" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "specialists_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "regions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "industries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendors_coverage_area" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendors_regional_states" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendors_notable_clients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendors_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendor_certifications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendor_facilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "vendor_services" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "commercial_relationships" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "leads" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "series" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "episodes_key_takeaways" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "episodes_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "episodes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promos_placement" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "promos_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "directory_entries_extended_content_faqs" CASCADE;
  DROP TABLE "directory_entries_gallery" CASCADE;
  DROP TABLE "directory_entries_winery_details_varietals_produced" CASCADE;
  DROP TABLE "directory_entries_rels" CASCADE;
  DROP TABLE "specialists_specialties" CASCADE;
  DROP TABLE "specialists_languages_spoken" CASCADE;
  DROP TABLE "specialists_insurance_accepted" CASCADE;
  DROP TABLE "specialists_photo_gallery" CASCADE;
  DROP TABLE "specialists" CASCADE;
  DROP TABLE "specialists_rels" CASCADE;
  DROP TABLE "regions" CASCADE;
  DROP TABLE "industries" CASCADE;
  DROP TABLE "vendors_coverage_area" CASCADE;
  DROP TABLE "vendors_regional_states" CASCADE;
  DROP TABLE "vendors_notable_clients" CASCADE;
  DROP TABLE "vendors" CASCADE;
  DROP TABLE "vendors_rels" CASCADE;
  DROP TABLE "vendor_certifications" CASCADE;
  DROP TABLE "vendor_facilities" CASCADE;
  DROP TABLE "vendor_services" CASCADE;
  DROP TABLE "commercial_relationships" CASCADE;
  DROP TABLE "leads" CASCADE;
  DROP TABLE "series" CASCADE;
  DROP TABLE "episodes_key_takeaways" CASCADE;
  DROP TABLE "episodes_tags" CASCADE;
  DROP TABLE "episodes" CASCADE;
  DROP TABLE "promos_placement" CASCADE;
  DROP TABLE "promos" CASCADE;
  DROP TABLE "promos_rels" CASCADE;
  ALTER TABLE "sites" DROP CONSTRAINT "sites_logo_id_media_id_fk";
  
  ALTER TABLE "sites" DROP CONSTRAINT "sites_favicon_id_media_id_fk";
  
  ALTER TABLE "categories" DROP CONSTRAINT "categories_icon_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_specialists_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_regions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_industries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vendors_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vendor_certifications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vendor_facilities_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_vendor_services_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commercial_relationships_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_leads_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_series_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_episodes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_promos_fk";
  
  ALTER TABLE "directory_entries" ALTER COLUMN "category" SET DATA TYPE text;
  DROP TYPE "public"."enum_directory_entries_category";
  CREATE TYPE "public"."enum_directory_entries_category" AS ENUM('wineries', 'restaurants', 'activities', 'venues');
  ALTER TABLE "directory_entries" ALTER COLUMN "category" SET DATA TYPE "public"."enum_directory_entries_category" USING "category"::"public"."enum_directory_entries_category";
  ALTER TABLE "directory_entries" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "directory_entries" ALTER COLUMN "status" SET DEFAULT 'published'::text;
  DROP TYPE "public"."enum_directory_entries_status";
  CREATE TYPE "public"."enum_directory_entries_status" AS ENUM('published', 'active', 'inactive');
  ALTER TABLE "directory_entries" ALTER COLUMN "status" SET DEFAULT 'published'::"public"."enum_directory_entries_status";
  ALTER TABLE "directory_entries" ALTER COLUMN "status" SET DATA TYPE "public"."enum_directory_entries_status" USING "status"::"public"."enum_directory_entries_status";
  DROP INDEX "sites_logo_idx";
  DROP INDEX "sites_favicon_idx";
  DROP INDEX "categories_icon_idx";
  DROP INDEX "directory_entries_tier_idx";
  DROP INDEX "directory_entries_commerce7_commerce7_enabled_idx";
  DROP INDEX "payload_locked_documents_rels_specialists_id_idx";
  DROP INDEX "payload_locked_documents_rels_regions_id_idx";
  DROP INDEX "payload_locked_documents_rels_industries_id_idx";
  DROP INDEX "payload_locked_documents_rels_vendors_id_idx";
  DROP INDEX "payload_locked_documents_rels_vendor_certifications_id_idx";
  DROP INDEX "payload_locked_documents_rels_vendor_facilities_id_idx";
  DROP INDEX "payload_locked_documents_rels_vendor_services_id_idx";
  DROP INDEX "payload_locked_documents_rels_commercial_relationships_i_idx";
  DROP INDEX "payload_locked_documents_rels_leads_id_idx";
  DROP INDEX "payload_locked_documents_rels_series_id_idx";
  DROP INDEX "payload_locked_documents_rels_episodes_id_idx";
  DROP INDEX "payload_locked_documents_rels_promos_id_idx";
  ALTER TABLE "sites" DROP COLUMN "tagline";
  ALTER TABLE "sites" DROP COLUMN "description";
  ALTER TABLE "sites" DROP COLUMN "logo_id";
  ALTER TABLE "sites" DROP COLUMN "favicon_id";
  ALTER TABLE "sites" DROP COLUMN "theme_color";
  ALTER TABLE "sites" DROP COLUMN "background_color";
  ALTER TABLE "sites" DROP COLUMN "listmonk_list_id";
  ALTER TABLE "sites" DROP COLUMN "mautic_segment_id";
  ALTER TABLE "articles" DROP COLUMN "last_reviewed";
  ALTER TABLE "authors" DROP COLUMN "role";
  ALTER TABLE "authors" DROP COLUMN "email";
  ALTER TABLE "categories" DROP COLUMN "url_segment";
  ALTER TABLE "categories" DROP COLUMN "sort_order";
  ALTER TABLE "categories" DROP COLUMN "color";
  ALTER TABLE "categories" DROP COLUMN "icon_id";
  ALTER TABLE "categories" DROP COLUMN "tagline";
  ALTER TABLE "tags" DROP COLUMN "group";
  ALTER TABLE "tags" DROP COLUMN "description";
  ALTER TABLE "directory_entries" DROP COLUMN "tier";
  ALTER TABLE "directory_entries" DROP COLUMN "extended_content_what_makes_it_special";
  ALTER TABLE "directory_entries" DROP COLUMN "extended_content_who_its_right_for";
  ALTER TABLE "directory_entries" DROP COLUMN "extended_content_what_to_expect";
  ALTER TABLE "directory_entries" DROP COLUMN "extended_content_local_context";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_ava";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_winery_type";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_family_owned";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_year_founded";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_reservations_required";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_walk_ins_accepted";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_dog_friendly";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_family_friendly";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_picnic_friendly";
  ALTER TABLE "directory_entries" DROP COLUMN "winery_details_walking_distance_from_sonoma_plaza";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_enabled";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_detected_domain";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_detected_at";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_confidence_level";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_partnership_status";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_shop_embed_code";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_wine_club_embed_code";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_reservation_embed_code";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_partner_since";
  ALTER TABLE "directory_entries" DROP COLUMN "commerce7_revenue_share_rate";
  ALTER TABLE "directory_entries" DROP COLUMN "metrics_gsc_impressions30d";
  ALTER TABLE "directory_entries" DROP COLUMN "metrics_gsc_clicks30d";
  ALTER TABLE "directory_entries" DROP COLUMN "metrics_gsc_avg_position";
  ALTER TABLE "directory_entries" DROP COLUMN "metrics_last_sync_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "specialists_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "regions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "industries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vendors_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vendor_certifications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vendor_facilities_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "vendor_services_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commercial_relationships_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "leads_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "series_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "episodes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "promos_id";
  DROP TYPE "public"."enum_categories_color";
  DROP TYPE "public"."enum_tags_group";
  DROP TYPE "public"."enum_directory_entries_tier";
  DROP TYPE "public"."enum_directory_entries_winery_details_ava";
  DROP TYPE "public"."enum_directory_entries_winery_details_winery_type";
  DROP TYPE "public"."enum_directory_entries_commerce7_confidence_level";
  DROP TYPE "public"."enum_directory_entries_commerce7_partnership_status";
  DROP TYPE "public"."enum_specialists_specialties";
  DROP TYPE "public"."enum_specialists_type";
  DROP TYPE "public"."enum_specialists_featured_tier";
  DROP TYPE "public"."enum_specialists_status";
  DROP TYPE "public"."enum_specialists_data_source";
  DROP TYPE "public"."enum_regions_tier";
  DROP TYPE "public"."enum_vendors_coverage_area";
  DROP TYPE "public"."enum_vendors_regional_states_state_code";
  DROP TYPE "public"."enum_vendors_editorial_summary_status";
  DROP TYPE "public"."enum_vendors_claim_status";
  DROP TYPE "public"."enum_vendors_acquisition_subsidiary_status";
  DROP TYPE "public"."enum_vendor_certifications_verification_status";
  DROP TYPE "public"."enum_vendor_facilities_ownership";
  DROP TYPE "public"."enum_vendor_services_service_type";
  DROP TYPE "public"."enum_commercial_relationships_connection_type";
  DROP TYPE "public"."enum_leads_status";
  DROP TYPE "public"."enum_series_status";
  DROP TYPE "public"."enum_episodes_video_source";
  DROP TYPE "public"."enum_episodes_status";
  DROP TYPE "public"."enum_promos_placement";
  DROP TYPE "public"."enum_promos_product";`)
}
