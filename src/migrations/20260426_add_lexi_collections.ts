import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Lexi Explains content collections.
 *
 * Adds:
 *   - 3 optional fields to `categories` (color / icon_id / tagline) used only by
 *     the Lexi Explains site. All other tenants leave them blank.
 *   - `series` collection (multi-tenant, slug unique per site).
 *   - `episodes` collection (multi-tenant, slug unique per site, tabbed admin
 *     with Video / Article / Cross-Posting / SEO sections).
 *   - `episodes_key_takeaways`, `episodes_tags` (Payload array tables).
 *   - `promos` collection (multi-tenant cross-promo slots).
 *   - `promos_placement` (array table for placement slots).
 *   - `promos_rels` (relationship table for promos.targetCategories hasMany).
 *
 * Tenant isolation: everything scopes to `site_id` and slugs are unique per
 * site, matching the pattern used by `articles`, `categories`, `tags`, etc.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── Enums ───────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TYPE "public"."enum_categories_color" AS ENUM('green', 'violet', 'blue', 'coral', 'champagne');
    CREATE TYPE "public"."enum_series_status" AS ENUM('active', 'complete', 'paused');
    CREATE TYPE "public"."enum_episodes_video_source" AS ENUM('youtube', 'tiktok', 'direct');
    CREATE TYPE "public"."enum_episodes_status" AS ENUM('draft', 'scheduled', 'published', 'archived');
    CREATE TYPE "public"."enum_promos_product" AS ENUM('blogcraft', 'resumecoach', 'imagecrafter', 'devmaestro', 'mcpforge', 'hisatech', 'other');
    CREATE TYPE "public"."enum_promos_placement_slot" AS ENUM('home-banner', 'sidebar-mid', 'sidebar-bottom', 'in-article', 'newsletter-footer');
  `)

  // ── Categories: Lexi Explains styling fields ────────────────────────────
  await db.execute(sql`
    ALTER TABLE "categories"
      ADD COLUMN IF NOT EXISTS "color"   "enum_categories_color",
      ADD COLUMN IF NOT EXISTS "icon_id" integer,
      ADD COLUMN IF NOT EXISTS "tagline" varchar;

    ALTER TABLE "categories"
      ADD CONSTRAINT "categories_icon_id_media_id_fk"
        FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "categories_icon_idx" ON "categories" USING btree ("icon_id");
  `)

  // ── Series ──────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "series" (
      "id"               serial PRIMARY KEY NOT NULL,
      "site_id"          integer NOT NULL,
      "title"            varchar NOT NULL,
      "slug"             varchar NOT NULL,
      "description"      varchar,
      "category_id"      integer NOT NULL,
      "hero_image_id"    integer,
      "total_episodes"   numeric,
      "status"           "enum_series_status" DEFAULT 'active',
      "updated_at"       timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"       timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "series"
      ADD CONSTRAINT "series_site_id_sites_id_fk"
        FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "series_category_id_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "series_hero_image_id_media_id_fk"
        FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;

    CREATE INDEX        "series_site_idx"               ON "series" USING btree ("site_id");
    CREATE INDEX        "series_category_idx"           ON "series" USING btree ("category_id");
    CREATE INDEX        "series_hero_image_idx"         ON "series" USING btree ("hero_image_id");
    CREATE INDEX        "series_status_idx"             ON "series" USING btree ("status");
    CREATE INDEX        "series_updated_at_idx"         ON "series" USING btree ("updated_at");
    CREATE INDEX        "series_created_at_idx"         ON "series" USING btree ("created_at");
    CREATE UNIQUE INDEX "series_site_id_slug_idx"       ON "series" USING btree ("site_id", "slug");
  `)

  // ── Episodes (main + array tables) ──────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "episodes_key_takeaways" (
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id"         varchar PRIMARY KEY NOT NULL,
      "point"      varchar NOT NULL
    );

    CREATE TABLE "episodes_tags" (
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id"         varchar PRIMARY KEY NOT NULL,
      "tag"        varchar NOT NULL
    );

    CREATE TABLE "episodes" (
      "id"                   serial PRIMARY KEY NOT NULL,
      "site_id"              integer NOT NULL,
      "title"                varchar NOT NULL,
      "slug"                 varchar NOT NULL,
      "hook"                 varchar,
      "category_id"          integer NOT NULL,
      "series_id"            integer,
      "episode_number"       numeric,
      "video_source"         "enum_episodes_video_source" DEFAULT 'youtube' NOT NULL,
      "youtube_id"           varchar,
      "tiktok_url"           varchar,
      "direct_video_id"      integer,
      "duration"             numeric,
      "poster_image_id"      integer NOT NULL,
      "hero_image_id"        integer,
      "transcript"           varchar,
      "extended_content"     jsonb,
      "tiktok_post_url"      varchar,
      "instagram_url"        varchar,
      "youtube_short_url"    varchar,
      "tiktok_views"         numeric,
      "meta_title"           varchar,
      "meta_description"     varchar,
      "og_image_id"          integer,
      "featured"             boolean DEFAULT false NOT NULL,
      "status"               "enum_episodes_status" DEFAULT 'draft' NOT NULL,
      "published_at"         timestamp(3) with time zone,
      "updated_at"           timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"           timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    ALTER TABLE "episodes_key_takeaways"
      ADD CONSTRAINT "episodes_key_takeaways_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."episodes"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "episodes_tags"
      ADD CONSTRAINT "episodes_tags_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."episodes"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "episodes"
      ADD CONSTRAINT "episodes_site_id_sites_id_fk"
        FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "episodes_category_id_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "episodes_series_id_series_id_fk"
        FOREIGN KEY ("series_id") REFERENCES "public"."series"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "episodes_direct_video_id_media_id_fk"
        FOREIGN KEY ("direct_video_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "episodes_poster_image_id_media_id_fk"
        FOREIGN KEY ("poster_image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "episodes_hero_image_id_media_id_fk"
        FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "episodes_og_image_id_media_id_fk"
        FOREIGN KEY ("og_image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;

    CREATE INDEX        "episodes_key_takeaways_order_idx"      ON "episodes_key_takeaways" USING btree ("_order");
    CREATE INDEX        "episodes_key_takeaways_parent_id_idx"  ON "episodes_key_takeaways" USING btree ("_parent_id");
    CREATE INDEX        "episodes_tags_order_idx"               ON "episodes_tags"          USING btree ("_order");
    CREATE INDEX        "episodes_tags_parent_id_idx"           ON "episodes_tags"          USING btree ("_parent_id");

    CREATE INDEX        "episodes_site_idx"               ON "episodes" USING btree ("site_id");
    CREATE INDEX        "episodes_category_idx"           ON "episodes" USING btree ("category_id");
    CREATE INDEX        "episodes_series_idx"             ON "episodes" USING btree ("series_id");
    CREATE INDEX        "episodes_status_idx"             ON "episodes" USING btree ("status");
    CREATE INDEX        "episodes_featured_idx"           ON "episodes" USING btree ("featured");
    CREATE INDEX        "episodes_published_at_idx"       ON "episodes" USING btree ("published_at");
    CREATE INDEX        "episodes_poster_image_idx"       ON "episodes" USING btree ("poster_image_id");
    CREATE INDEX        "episodes_hero_image_idx"         ON "episodes" USING btree ("hero_image_id");
    CREATE INDEX        "episodes_og_image_idx"           ON "episodes" USING btree ("og_image_id");
    CREATE INDEX        "episodes_direct_video_idx"       ON "episodes" USING btree ("direct_video_id");
    CREATE INDEX        "episodes_updated_at_idx"         ON "episodes" USING btree ("updated_at");
    CREATE INDEX        "episodes_created_at_idx"         ON "episodes" USING btree ("created_at");
    CREATE INDEX        "episodes_slug_idx"               ON "episodes" USING btree ("slug");
    CREATE UNIQUE INDEX "episodes_site_id_slug_idx"       ON "episodes" USING btree ("site_id", "slug");
  `)

  // ── Promos (main + placement array + rels for hasMany categories) ───────
  await db.execute(sql`
    CREATE TABLE "promos_placement" (
      "_order"     integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id"         varchar PRIMARY KEY NOT NULL,
      "slot"       "enum_promos_placement_slot" NOT NULL
    );

    CREATE TABLE "promos" (
      "id"          serial PRIMARY KEY NOT NULL,
      "site_id"     integer NOT NULL,
      "name"        varchar NOT NULL,
      "product"     "enum_promos_product",
      "headline"    varchar NOT NULL,
      "subhead"     varchar,
      "cta_text"    varchar DEFAULT 'Learn more' NOT NULL,
      "cta_url"     varchar NOT NULL,
      "image_id"    integer NOT NULL,
      "active"      boolean DEFAULT true NOT NULL,
      "start_date"  timestamp(3) with time zone,
      "end_date"    timestamp(3) with time zone,
      "updated_at"  timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"  timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE "promos_rels" (
      "id"             serial PRIMARY KEY NOT NULL,
      "order"          integer,
      "parent_id"      integer NOT NULL,
      "path"           varchar NOT NULL,
      "categories_id"  integer
    );

    ALTER TABLE "promos_placement"
      ADD CONSTRAINT "promos_placement_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."promos"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "promos"
      ADD CONSTRAINT "promos_site_id_sites_id_fk"
        FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "promos_image_id_media_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;

    ALTER TABLE "promos_rels"
      ADD CONSTRAINT "promos_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."promos"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "promos_rels_categories_fk"
        FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id")
        ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "promos_placement_order_idx"     ON "promos_placement" USING btree ("_order");
    CREATE INDEX "promos_placement_parent_id_idx" ON "promos_placement" USING btree ("_parent_id");
    CREATE INDEX "promos_placement_slot_idx"      ON "promos_placement" USING btree ("slot");

    CREATE INDEX "promos_site_idx"                ON "promos" USING btree ("site_id");
    CREATE INDEX "promos_product_idx"             ON "promos" USING btree ("product");
    CREATE INDEX "promos_active_idx"              ON "promos" USING btree ("active");
    CREATE INDEX "promos_image_idx"               ON "promos" USING btree ("image_id");
    CREATE INDEX "promos_updated_at_idx"          ON "promos" USING btree ("updated_at");
    CREATE INDEX "promos_created_at_idx"          ON "promos" USING btree ("created_at");

    CREATE INDEX "promos_rels_order_idx"          ON "promos_rels" USING btree ("order");
    CREATE INDEX "promos_rels_parent_idx"         ON "promos_rels" USING btree ("parent_id");
    CREATE INDEX "promos_rels_path_idx"           ON "promos_rels" USING btree ("path");
    CREATE INDEX "promos_rels_categories_id_idx"  ON "promos_rels" USING btree ("categories_id");
  `)

  // ── payload_locked_documents_rels: register the new collections ────────
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "series_id"   integer,
      ADD COLUMN IF NOT EXISTS "episodes_id" integer,
      ADD COLUMN IF NOT EXISTS "promos_id"   integer;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_series_fk"
        FOREIGN KEY ("series_id") REFERENCES "public"."series"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "payload_locked_documents_rels_episodes_fk"
        FOREIGN KEY ("episodes_id") REFERENCES "public"."episodes"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "payload_locked_documents_rels_promos_fk"
        FOREIGN KEY ("promos_id") REFERENCES "public"."promos"("id")
        ON DELETE cascade ON UPDATE no action;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_series_id_idx"
      ON "payload_locked_documents_rels" USING btree ("series_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_episodes_id_idx"
      ON "payload_locked_documents_rels" USING btree ("episodes_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_promos_id_idx"
      ON "payload_locked_documents_rels" USING btree ("promos_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_series_fk",
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_episodes_fk",
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_promos_fk";

    DROP INDEX IF EXISTS "payload_locked_documents_rels_series_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_episodes_id_idx";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_promos_id_idx";

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "series_id",
      DROP COLUMN IF EXISTS "episodes_id",
      DROP COLUMN IF EXISTS "promos_id";

    DROP TABLE IF EXISTS "promos_rels"           CASCADE;
    DROP TABLE IF EXISTS "promos_placement"      CASCADE;
    DROP TABLE IF EXISTS "promos"                CASCADE;
    DROP TABLE IF EXISTS "episodes_tags"         CASCADE;
    DROP TABLE IF EXISTS "episodes_key_takeaways" CASCADE;
    DROP TABLE IF EXISTS "episodes"              CASCADE;
    DROP TABLE IF EXISTS "series"                CASCADE;

    ALTER TABLE "categories"
      DROP CONSTRAINT IF EXISTS "categories_icon_id_media_id_fk";
    DROP INDEX IF EXISTS "categories_icon_idx";
    ALTER TABLE "categories"
      DROP COLUMN IF EXISTS "color",
      DROP COLUMN IF EXISTS "icon_id",
      DROP COLUMN IF EXISTS "tagline";

    DROP TYPE IF EXISTS "public"."enum_promos_placement_slot";
    DROP TYPE IF EXISTS "public"."enum_promos_product";
    DROP TYPE IF EXISTS "public"."enum_episodes_status";
    DROP TYPE IF EXISTS "public"."enum_episodes_video_source";
    DROP TYPE IF EXISTS "public"."enum_series_status";
    DROP TYPE IF EXISTS "public"."enum_categories_color";
  `)
}
