import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Create support_tickets table if not exists (for proper persistence)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_tickets" (
      "id" serial PRIMARY KEY NOT NULL,
      "app_slug" varchar NOT NULL,
      "message" text NOT NULL,
      "severity" varchar DEFAULT 'medium',
      "page_url" varchar,
      "route" varchar,
      "user_agent" varchar,
      "client_ip" varchar,
      "sentry_event_id" varchar,
      "user_id" varchar,
      "user_email" varchar,
      "details" jsonb DEFAULT '{}'::jsonb,
      "status" varchar DEFAULT 'open',
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Create support_events table for telemetry
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "app_slug" varchar NOT NULL,
      "event_type" varchar NOT NULL,
      "event_data" jsonb DEFAULT '{}'::jsonb,
      "page_url" varchar,
      "route" varchar,
      "user_agent" varchar,
      "client_ip" varchar,
      "user_id" varchar,
      "session_id" varchar,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Create triage_reports table for scheduled AI triage
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "support_triage_reports" (
      "id" serial PRIMARY KEY NOT NULL,
      "app_slug" varchar,
      "report_date" date NOT NULL,
      "period_start" timestamp(3) with time zone NOT NULL,
      "period_end" timestamp(3) with time zone NOT NULL,
      "ticket_count" integer DEFAULT 0,
      "event_count" integer DEFAULT 0,
      "clusters" jsonb DEFAULT '[]'::jsonb,
      "suggested_actions" jsonb DEFAULT '[]'::jsonb,
      "ai_summary" text,
      "slack_posted" boolean DEFAULT false,
      "slack_ts" varchar,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `)

  // Add indexes for efficient querying
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_tickets_app_slug_idx" ON "support_tickets" USING btree ("app_slug");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_tickets_created_at_idx" ON "support_tickets" USING btree ("created_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_tickets_status_idx" ON "support_tickets" USING btree ("status");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_events_app_slug_idx" ON "support_events" USING btree ("app_slug");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_events_event_type_idx" ON "support_events" USING btree ("event_type");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_events_created_at_idx" ON "support_events" USING btree ("created_at");
  `)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "support_triage_reports_report_date_idx" ON "support_triage_reports" USING btree ("report_date");
  `)

  // Note: support_tickets was created above with all columns, so ALTER statements
  // are only needed if the table existed before this migration with fewer columns.
  // Since CREATE TABLE IF NOT EXISTS won't run if table exists, we use a safe approach:
  // These are wrapped in individual try blocks in case some columns exist but not others.
  await db.execute(sql`
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "route" varchar;
  `).catch(() => { /* may not exist yet */ })

  await db.execute(sql`
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "client_ip" varchar;
  `).catch(() => { /* may not exist yet */ })

  await db.execute(sql`
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "user_email" varchar;
  `).catch(() => { /* may not exist yet */ })

  await db.execute(sql`
    ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "status" varchar DEFAULT 'open';
  `).catch(() => { /* may not exist yet */ })
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "support_triage_reports" CASCADE;`)
  await db.execute(sql`DROP TABLE IF EXISTS "support_events" CASCADE;`)
  // Don't drop support_tickets as it may have important data
}
