import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Make Lexi Explains promo fields queryable from the API:
 *
 *  - placement: convert from `array` (table with _order/_parent_id/id/slot)
 *    to `select hasMany` (table with order/parent_id/value). This is what the
 *    frontend wrote against; with `select hasMany` the path `placement` is
 *    queryable directly:  where[placement][in]=sidebar-mid
 *  - active: btree index for `active = true` filters
 *  - start_date / end_date: btree indexes for date-range filters
 *  - target_categories: index handled in the existing _rels table (parent_id /
 *    categories_id) which is already created by 20260426_add_lexi_collections.
 *
 * The `promos_placement` table is empty in production, so a hard drop+recreate
 * is safe. The enum `enum_promos_placement_slot` is also dropped and replaced
 * by `enum_promos_placement` (the name Payload v3 generates for select-hasMany).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "promos_placement" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_promos_placement_slot";

    CREATE TYPE "public"."enum_promos_placement" AS ENUM(
      'home-banner',
      'sidebar-mid',
      'sidebar-bottom',
      'in-article',
      'newsletter-footer'
    );

    CREATE TABLE "promos_placement" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "public"."enum_promos_placement"
    );

    ALTER TABLE "promos_placement"
      ADD CONSTRAINT "promos_placement_parent_fk"
      FOREIGN KEY ("parent_id") REFERENCES "public"."promos"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "promos_placement_order_idx" ON "promos_placement" USING btree ("order");
    CREATE INDEX "promos_placement_parent_idx" ON "promos_placement" USING btree ("parent_id");

    CREATE INDEX IF NOT EXISTS "promos_active_idx"     ON "promos" USING btree ("active");
    CREATE INDEX IF NOT EXISTS "promos_start_date_idx" ON "promos" USING btree ("start_date");
    CREATE INDEX IF NOT EXISTS "promos_end_date_idx"   ON "promos" USING btree ("end_date");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "promos_end_date_idx";
    DROP INDEX IF EXISTS "promos_start_date_idx";
    DROP INDEX IF EXISTS "promos_active_idx";

    DROP TABLE IF EXISTS "promos_placement" CASCADE;
    DROP TYPE  IF EXISTS "public"."enum_promos_placement";

    CREATE TYPE "public"."enum_promos_placement_slot" AS ENUM(
      'home-banner',
      'sidebar-mid',
      'sidebar-bottom',
      'in-article',
      'newsletter-footer'
    );

    CREATE TABLE "promos_placement" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "slot" "public"."enum_promos_placement_slot" NOT NULL
    );

    ALTER TABLE "promos_placement"
      ADD CONSTRAINT "promos_placement_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "public"."promos"("id")
      ON DELETE cascade ON UPDATE no action;

    CREATE INDEX "promos_placement_order_idx"     ON "promos_placement" USING btree ("_order");
    CREATE INDEX "promos_placement_parent_id_idx" ON "promos_placement" USING btree ("_parent_id");
  `)
}
