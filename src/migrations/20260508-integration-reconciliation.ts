/**
 * Migration: 20260508-integration-reconciliation
 *
 * Workstream A integration reconciliation — Payload Admin side.
 * Addresses three coordination items flagged in the frontend integration brief:
 *
 * 1. commercial_relationships collection — new table for /commercial-model
 *    transparency page disclosure. Fields: vendor_id, connection_type (enum),
 *    effective_date, is_active, internal_notes, timestamps.
 *
 * 2. articles.last_reviewed — nullable date field. Renders in byline strip
 *    as "Last reviewed [date]" when populated and differs from published_at.
 *
 * 3. payload_locked_documents_rels — adds commercial_relationships_id column
 *    to support Payload's admin UI document locking.
 *
 * Reversible: down() drops the table, column, and enum type.
 */

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── New ENUM type ─────────────────────────────────────────────────────────────

  await db.execute(sql`
    CREATE TYPE "public"."enum_commercial_relationships_connection_type"
      AS ENUM('referral-partner', 'premium-placement', 'sponsored-content');
  `)

  // ── commercial_relationships table ────────────────────────────────────────────

  await db.execute(sql`
    CREATE TABLE "commercial_relationships" (
      "id"              serial PRIMARY KEY NOT NULL,
      "vendor_id"       integer NOT NULL,
      "connection_type" "enum_commercial_relationships_connection_type" NOT NULL,
      "effective_date"  timestamp(3) with time zone NOT NULL,
      "is_active"       boolean NOT NULL DEFAULT true,
      "internal_notes"  varchar,
      "updated_at"      timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at"      timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // ── articles: add last_reviewed column ────────────────────────────────────────

  await db.execute(sql`
    ALTER TABLE "articles"
      ADD COLUMN IF NOT EXISTS "last_reviewed" timestamp(3) with time zone;
  `)

  // ── payload_locked_documents_rels: add commercial_relationships_id ────────────

  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "commercial_relationships_id" integer;
  `)

  // ── Foreign key constraints ──────────────────────────────────────────────────

  await db.execute(sql`
    ALTER TABLE "commercial_relationships"
      ADD CONSTRAINT "commercial_relationships_vendor_id_vendors_id_fk"
        FOREIGN KEY ("vendor_id")
        REFERENCES "public"."vendors"("id")
        ON DELETE cascade ON UPDATE no action;

    ALTER TABLE "payload_locked_documents_rels"
      ADD CONSTRAINT "payload_locked_documents_rels_commercial_relationships_fk"
        FOREIGN KEY ("commercial_relationships_id")
        REFERENCES "public"."commercial_relationships"("id")
        ON DELETE cascade ON UPDATE no action;
  `)

  // ── Indexes ──────────────────────────────────────────────────────────────────

  await db.execute(sql`
    CREATE INDEX "commercial_relationships_vendor_idx"
      ON "commercial_relationships" USING btree ("vendor_id");

    CREATE INDEX "commercial_relationships_is_active_idx"
      ON "commercial_relationships" USING btree ("is_active");

    CREATE INDEX "commercial_relationships_updated_at_idx"
      ON "commercial_relationships" USING btree ("updated_at");

    CREATE INDEX "commercial_relationships_created_at_idx"
      ON "commercial_relationships" USING btree ("created_at");

    CREATE INDEX "payload_locked_documents_rels_commercial_relationships_id_idx"
      ON "payload_locked_documents_rels" USING btree ("commercial_relationships_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Drop junction table column from payload_locked_documents_rels
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_commercial_relationships_fk",
      DROP COLUMN IF EXISTS "commercial_relationships_id";
  `)

  // Drop the commercial_relationships table
  await db.execute(sql`
    DROP TABLE IF EXISTS "commercial_relationships" CASCADE;
  `)

  // Drop the articles column
  await db.execute(sql`
    ALTER TABLE "articles"
      DROP COLUMN IF EXISTS "last_reviewed";
  `)

  // Drop enum type
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_commercial_relationships_connection_type";
  `)
}
