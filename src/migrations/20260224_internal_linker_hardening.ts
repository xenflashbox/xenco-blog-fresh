import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "internal_link_run_locks" (
      "scope_key" varchar PRIMARY KEY NOT NULL,
      "owner_token" varchar NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  await db.execute(sql`
    ALTER TABLE "internal_link_runs"
      ADD COLUMN IF NOT EXISTS "action" varchar DEFAULT 'link' NOT NULL;
  `)

  await db.execute(sql`
    ALTER TABLE "internal_link_edges"
      ADD COLUMN IF NOT EXISTS "target_url" varchar,
      ADD COLUMN IF NOT EXISTS "left_context" varchar,
      ADD COLUMN IF NOT EXISTS "right_context" varchar,
      ADD COLUMN IF NOT EXISTS "fingerprint" varchar,
      ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'active' NOT NULL,
      ADD COLUMN IF NOT EXISTS "last_seen_run_id_id" integer,
      ADD COLUMN IF NOT EXISTS "revert_run_id_id" integer;
  `)

  await db.execute(sql`
    UPDATE "internal_link_edges"
    SET "status" = 'active'
    WHERE "status" IS NULL;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "internal_link_edges_status_idx" ON "internal_link_edges" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_target_url_idx" ON "internal_link_edges" USING btree ("target_url");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_fingerprint_idx" ON "internal_link_edges" USING btree ("fingerprint");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_last_seen_run_idx" ON "internal_link_edges" USING btree ("last_seen_run_id_id");
    CREATE INDEX IF NOT EXISTS "internal_link_edges_revert_run_idx" ON "internal_link_edges" USING btree ("revert_run_id_id");
    CREATE INDEX IF NOT EXISTS "internal_link_runs_action_idx" ON "internal_link_runs" USING btree ("action");
  `)

  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "internal_link_edges" ADD CONSTRAINT "internal_link_edges_last_seen_run_fk"
      FOREIGN KEY ("last_seen_run_id_id") REFERENCES "internal_link_runs"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "internal_link_edges" ADD CONSTRAINT "internal_link_edges_revert_run_fk"
      FOREIGN KEY ("revert_run_id_id") REFERENCES "internal_link_runs"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "internal_link_edges" DROP CONSTRAINT IF EXISTS "internal_link_edges_last_seen_run_fk";
    ALTER TABLE "internal_link_edges" DROP CONSTRAINT IF EXISTS "internal_link_edges_revert_run_fk";

    ALTER TABLE "internal_link_edges"
      DROP COLUMN IF EXISTS "target_url",
      DROP COLUMN IF EXISTS "left_context",
      DROP COLUMN IF EXISTS "right_context",
      DROP COLUMN IF EXISTS "fingerprint",
      DROP COLUMN IF EXISTS "status",
      DROP COLUMN IF EXISTS "last_seen_run_id_id",
      DROP COLUMN IF EXISTS "revert_run_id_id";

    ALTER TABLE "internal_link_runs"
      DROP COLUMN IF EXISTS "action";

    DROP TABLE IF EXISTS "internal_link_run_locks" CASCADE;
  `)
}
