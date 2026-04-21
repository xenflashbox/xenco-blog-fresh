import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── Enum types ──────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TYPE "public"."enum_vendors_claim_status"
      AS ENUM('unclaimed', 'pending-claim', 'claimed');
    CREATE TYPE "public"."enum_vendors_acquisition_subsidiary_status"
      AS ENUM('operating-as-brand', 'merged-into-parent', 'winding-down');
    CREATE TYPE "public"."enum_vendor_certifications_verification_status"
      AS ENUM('self-reported', 'verified', 'expired', 'unverifiable');
    CREATE TYPE "public"."enum_vendor_facilities_ownership"
      AS ENUM('owned', 'leased', 'partner');
    CREATE TYPE "public"."enum_vendor_services_service_type"
      AS ENUM('itad', 'media-destruction', 'data-wiping', 'remarketing', 'recycling',
              'refurbishment', 'logistics', 'leased-equipment-return', 'itam', 'cod',
              'on-site', 'cloud-decommission', 'other');
    CREATE TYPE "public"."enum_leads_status"
      AS ENUM('new', 'contacted', 'qualified', 'closed');
  `)

  // ── industries ───────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "industries" (
      "id"           serial PRIMARY KEY NOT NULL,
      "display_name" varchar NOT NULL,
      "slug"         varchar NOT NULL,
      "description"  varchar,
      "updated_at"   timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"   timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ── vendors ──────────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "vendors" (
      "id"                                  serial PRIMARY KEY NOT NULL,
      "name"                                varchar NOT NULL,
      "slug"                                varchar NOT NULL,
      "website"                             varchar,
      "description"                         varchar,
      "logo_id"                             integer,
      "hq_city"                             varchar,
      "hq_state"                            varchar,
      "hq_country"                          varchar DEFAULT 'US',
      "phone"                               varchar,
      "email"                               varchar,
      "founded_year"                        numeric,
      "employee_count_range"                varchar,
      "is_published"                        boolean DEFAULT false NOT NULL,
      "claim_status"                        "enum_vendors_claim_status" DEFAULT 'unclaimed',
      "provenance_primary_source_url"       varchar,
      "provenance_crawled_at"               timestamp(3) with time zone,
      "provenance_last_verified_at"         timestamp(3) with time zone,
      "provenance_crawler_version"          varchar,
      "provenance_verification_notes"       varchar,
      "parent_company_id"                   integer,
      "acquisition_acquired_date"           timestamp(3) with time zone,
      "acquisition_announcement_url"        varchar,
      "acquisition_subsidiary_status"       "enum_vendors_acquisition_subsidiary_status",
      "acquisition_acquired_entity_notes"   varchar,
      "seo_meta_title"                      varchar,
      "seo_meta_description"                varchar,
      "updated_at"                          timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"                          timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // hasMany relationship: vendors.industries_served → industries
  await db.execute(sql`
    CREATE TABLE "vendors_rels" (
      "id"           serial PRIMARY KEY NOT NULL,
      "order"        integer,
      "parent_id"    integer NOT NULL,
      "path"         varchar NOT NULL,
      "industries_id" integer
    );
  `)

  // ── vendor_certifications ────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "vendor_certifications" (
      "id"                  serial PRIMARY KEY NOT NULL,
      "vendor_id"           integer NOT NULL,
      "certification_name"  varchar NOT NULL,
      "certification_body"  varchar,
      "cert_number"         varchar,
      "valid_from"          timestamp(3) with time zone,
      "valid_through"       timestamp(3) with time zone,
      "verification_status" "enum_vendor_certifications_verification_status" DEFAULT 'self-reported',
      "verification_url"    varchar,
      "verification_notes"  varchar,
      "updated_at"          timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"          timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ── vendor_facilities ────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "vendor_facilities" (
      "id"              serial PRIMARY KEY NOT NULL,
      "vendor_id"       integer NOT NULL,
      "facility_name"   varchar,
      "address"         varchar,
      "city"            varchar NOT NULL,
      "state"           varchar,
      "country"         varchar DEFAULT 'US',
      "postal_code"     varchar,
      "lat"             numeric,
      "lng"             numeric,
      "ownership"       "enum_vendor_facilities_ownership",
      "is_headquarters" boolean DEFAULT false,
      "sq_footage"      numeric,
      "notes"           varchar,
      "updated_at"      timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"      timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ── vendor_services ──────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "vendor_services" (
      "id"           serial PRIMARY KEY NOT NULL,
      "vendor_id"    integer NOT NULL,
      "service_type" "enum_vendor_services_service_type" NOT NULL,
      "description"  varchar,
      "service_url"  varchar,
      "updated_at"   timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"   timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ── leads ────────────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE "leads" (
      "id"           serial PRIMARY KEY NOT NULL,
      "first_name"   varchar,
      "last_name"    varchar,
      "email"        varchar NOT NULL,
      "phone"        varchar,
      "company"      varchar,
      "vendor_id"    integer,
      "message"      varchar,
      "source"       varchar,
      "utm_source"   varchar,
      "utm_medium"   varchar,
      "utm_campaign" varchar,
      "utm_term"     varchar,
      "utm_content"  varchar,
      "status"       "enum_leads_status" DEFAULT 'new',
      "updated_at"   timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"   timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ── payload_locked_documents_rels columns ────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "vendors_id"               integer,
      ADD COLUMN IF NOT EXISTS "vendor_certifications_id" integer,
      ADD COLUMN IF NOT EXISTS "vendor_facilities_id"     integer,
      ADD COLUMN IF NOT EXISTS "vendor_services_id"       integer,
      ADD COLUMN IF NOT EXISTS "industries_id"            integer,
      ADD COLUMN IF NOT EXISTS "leads_id"                 integer;
  `)

  // ── Foreign key constraints ──────────────────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "industries"
      ADD CONSTRAINT "industries_updated_at_not_null"
        CHECK ("updated_at" IS NOT NULL);

    ALTER TABLE "vendors"
      ADD CONSTRAINT "vendors_logo_id_media_id_fk"
        FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action,
      ADD CONSTRAINT "vendors_parent_company_id_vendors_id_fk"
        FOREIGN KEY ("parent_company_id") REFERENCES "public"."vendors"("id")
        ON DELETE set null ON UPDATE no action;

    ALTER TABLE "vendors_rels"
      ADD CONSTRAINT "vendors_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "vendors_rels_industries_fk"
        FOREIGN KEY ("industries_id") REFERENCES "public"."industries"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "vendor_certifications"
      ADD CONSTRAINT "vendor_certifications_vendor_id_vendors_id_fk"
        FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "vendor_facilities"
      ADD CONSTRAINT "vendor_facilities_vendor_id_vendors_id_fk"
        FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "vendor_services"
      ADD CONSTRAINT "vendor_services_vendor_id_vendors_id_fk"
        FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "leads"
      ADD CONSTRAINT "leads_vendor_id_vendors_id_fk"
        FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id")
        ON DELETE set null ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_vendors_fk"
        FOREIGN KEY ("vendors_id") REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "payload_locked_documents_rels_vendor_certifications_fk"
        FOREIGN KEY ("vendor_certifications_id") REFERENCES "public"."vendor_certifications"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "payload_locked_documents_rels_vendor_facilities_fk"
        FOREIGN KEY ("vendor_facilities_id") REFERENCES "public"."vendor_facilities"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "payload_locked_documents_rels_vendor_services_fk"
        FOREIGN KEY ("vendor_services_id") REFERENCES "public"."vendor_services"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "payload_locked_documents_rels_industries_fk"
        FOREIGN KEY ("industries_id") REFERENCES "public"."industries"("id")
        ON DELETE cascade ON UPDATE no action,
      ADD CONSTRAINT "payload_locked_documents_rels_leads_fk"
        FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id")
        ON DELETE cascade ON UPDATE no action;
  `)

  // ── Indexes ──────────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE UNIQUE INDEX "industries_slug_idx"        ON "industries"             USING btree ("slug");
    CREATE INDEX        "industries_updated_at_idx"  ON "industries"             USING btree ("updated_at");
    CREATE INDEX        "industries_created_at_idx"  ON "industries"             USING btree ("created_at");

    CREATE UNIQUE INDEX "vendors_slug_idx"            ON "vendors"               USING btree ("slug");
    CREATE INDEX        "vendors_is_published_idx"    ON "vendors"               USING btree ("is_published");
    CREATE INDEX        "vendors_claim_status_idx"    ON "vendors"               USING btree ("claim_status");
    CREATE INDEX        "vendors_updated_at_idx"      ON "vendors"               USING btree ("updated_at");
    CREATE INDEX        "vendors_created_at_idx"      ON "vendors"               USING btree ("created_at");

    CREATE INDEX        "vendors_rels_order_idx"       ON "vendors_rels"         USING btree ("order");
    CREATE INDEX        "vendors_rels_parent_idx"      ON "vendors_rels"         USING btree ("parent_id");
    CREATE INDEX        "vendors_rels_path_idx"        ON "vendors_rels"         USING btree ("path");
    CREATE INDEX        "vendors_rels_industries_id_idx" ON "vendors_rels"       USING btree ("industries_id");

    CREATE INDEX        "vendor_certifications_vendor_idx"     ON "vendor_certifications" USING btree ("vendor_id");
    CREATE INDEX        "vendor_certifications_updated_at_idx" ON "vendor_certifications" USING btree ("updated_at");
    CREATE INDEX        "vendor_certifications_created_at_idx" ON "vendor_certifications" USING btree ("created_at");

    CREATE INDEX        "vendor_facilities_vendor_idx"     ON "vendor_facilities" USING btree ("vendor_id");
    CREATE INDEX        "vendor_facilities_updated_at_idx" ON "vendor_facilities" USING btree ("updated_at");
    CREATE INDEX        "vendor_facilities_created_at_idx" ON "vendor_facilities" USING btree ("created_at");

    CREATE INDEX        "vendor_services_vendor_idx"     ON "vendor_services"    USING btree ("vendor_id");
    CREATE INDEX        "vendor_services_updated_at_idx" ON "vendor_services"    USING btree ("updated_at");
    CREATE INDEX        "vendor_services_created_at_idx" ON "vendor_services"    USING btree ("created_at");

    CREATE INDEX        "leads_email_idx"       ON "leads"                       USING btree ("email");
    CREATE INDEX        "leads_vendor_idx"      ON "leads"                       USING btree ("vendor_id");
    CREATE INDEX        "leads_updated_at_idx"  ON "leads"                       USING btree ("updated_at");
    CREATE INDEX        "leads_created_at_idx"  ON "leads"                       USING btree ("created_at");

    CREATE INDEX "payload_locked_documents_rels_vendors_id_idx"
      ON "payload_locked_documents_rels" USING btree ("vendors_id");
    CREATE INDEX "payload_locked_documents_rels_vendor_certifications_id_idx"
      ON "payload_locked_documents_rels" USING btree ("vendor_certifications_id");
    CREATE INDEX "payload_locked_documents_rels_vendor_facilities_id_idx"
      ON "payload_locked_documents_rels" USING btree ("vendor_facilities_id");
    CREATE INDEX "payload_locked_documents_rels_vendor_services_id_idx"
      ON "payload_locked_documents_rels" USING btree ("vendor_services_id");
    CREATE INDEX "payload_locked_documents_rels_industries_id_idx"
      ON "payload_locked_documents_rels" USING btree ("industries_id");
    CREATE INDEX "payload_locked_documents_rels_leads_id_idx"
      ON "payload_locked_documents_rels" USING btree ("leads_id");
  `)

  // ── Seed: 15 industry verticals ──────────────────────────────────────────────
  // Slugs must exactly match compareITAD vendor dossier industries_served[] values.
  await db.execute(sql`
    INSERT INTO "industries" ("display_name", "slug", "updated_at", "created_at")
    VALUES
      ('Healthcare',                 'healthcare',             now(), now()),
      ('Financial Services',         'financial-services',     now(), now()),
      ('Government (Federal)',        'government-federal',     now(), now()),
      ('Government (State & Local)', 'government-state-local', now(), now()),
      ('Education (K-12)',           'education-k12',          now(), now()),
      ('Education (Higher Ed)',      'education-higher-ed',    now(), now()),
      ('Technology',                 'technology',             now(), now()),
      ('Manufacturing',              'manufacturing',          now(), now()),
      ('Retail',                     'retail',                 now(), now()),
      ('Legal',                      'legal',                  now(), now()),
      ('Energy & Utilities',         'energy-utilities',       now(), now()),
      ('Telecommunications',         'telecommunications',     now(), now()),
      ('Defense',                    'defense',                now(), now()),
      ('Transportation',             'transportation',         now(), now()),
      ('Nonprofit',                  'nonprofit',              now(), now())
    ON CONFLICT ("slug") DO NOTHING;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "leads"                   CASCADE;
    DROP TABLE IF EXISTS "vendor_services"          CASCADE;
    DROP TABLE IF EXISTS "vendor_facilities"        CASCADE;
    DROP TABLE IF EXISTS "vendor_certifications"    CASCADE;
    DROP TABLE IF EXISTS "vendors_rels"             CASCADE;
    DROP TABLE IF EXISTS "vendors"                  CASCADE;
    DROP TABLE IF EXISTS "industries"               CASCADE;

    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "vendors_id",
      DROP COLUMN IF EXISTS "vendor_certifications_id",
      DROP COLUMN IF EXISTS "vendor_facilities_id",
      DROP COLUMN IF EXISTS "vendor_services_id",
      DROP COLUMN IF EXISTS "industries_id",
      DROP COLUMN IF EXISTS "leads_id";

    DROP TYPE IF EXISTS "public"."enum_vendors_claim_status";
    DROP TYPE IF EXISTS "public"."enum_vendors_acquisition_subsidiary_status";
    DROP TYPE IF EXISTS "public"."enum_vendor_certifications_verification_status";
    DROP TYPE IF EXISTS "public"."enum_vendor_facilities_ownership";
    DROP TYPE IF EXISTS "public"."enum_vendor_services_service_type";
    DROP TYPE IF EXISTS "public"."enum_leads_status";
  `)
}
