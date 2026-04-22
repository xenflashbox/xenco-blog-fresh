import * as migration_20251214_202754_initial from './20251214_202754_initial';
import * as migration_20251214_204544_add_role from './20251214_204544_add_role';
import * as migration_20251214_212223_add_articles from './20251214_212223_add_articles';
import * as migration_20251214_220216_add_categories_tags from './20251214_220216_add_categories_tags';
import * as migration_20251215_001_add_media_prefix from './20251215_001_add_media_prefix';
import * as migration_20251215_142716_add_sites_and_article_site from './20251215_142716_add_sites_and_article_site';
import * as migration_20251215_161702_add_site_to_categories_tags from './20251215_161702_add_site_to_categories_tags';
import * as migration_20251215_185759_fix_unique_indexes_categories_tags from './20251215_185759_fix_unique_indexes_categories_tags';
import * as migration_20251223_add_support_collections from './20251223_add_support_collections';
import * as migration_20251223_fix_announcements_columns from './20251223_fix_announcements_columns';
import * as migration_20251226_add_kb_steps_triggers from './20251226_add_kb_steps_triggers';
import * as migration_20251229_add_support_events_triage from './20251229_add_support_events_triage';
import * as migration_20260218_add_article_seo_fields from './20260218_add_article_seo_fields';
import * as migration_20260224_add_internal_linker_collections from './20260224_add_internal_linker_collections';
import * as migration_20260224_internal_linker_hardening from './20260224_internal_linker_hardening';
import * as migration_20260225_add_sites_revalidate_columns from './20260225_add_sites_revalidate_columns';
import * as migration_20260227_214422 from './20260227_214422';
import * as migration_20260302_add_author_avatar_url from './20260302_add_author_avatar_url';
import * as migration_20260317_add_published_to_directory_entries_status from './20260317_add_published_to_directory_entries_status';
import * as migration_20260324_180149 from './20260324_180149';
import * as migration_20260404_233155_add_wcc_collections from './20260404_233155_add_wcc_collections';
import * as migration_20260407_153609_add_articles_html_field from './20260407_153609_add_articles_html_field';
import * as migration_20260407_203747_add_articles_thumbnail_url from './20260407_203747_add_articles_thumbnail_url';
import * as migration_20260408_041441_add_wineries_hero_image_url from './20260408_041441_add_wineries_hero_image_url';
import * as migration_20260419_add_citad_collections from './20260419_add_citad_collections';
import * as migration_20260421_schema_addendum_2 from './20260421_schema_addendum_2';

export const migrations = [
  {
    up: migration_20251214_202754_initial.up,
    down: migration_20251214_202754_initial.down,
    name: '20251214_202754_initial',
  },
  {
    up: migration_20251214_204544_add_role.up,
    down: migration_20251214_204544_add_role.down,
    name: '20251214_204544_add_role',
  },
  {
    up: migration_20251214_212223_add_articles.up,
    down: migration_20251214_212223_add_articles.down,
    name: '20251214_212223_add_articles',
  },
  {
    up: migration_20251214_220216_add_categories_tags.up,
    down: migration_20251214_220216_add_categories_tags.down,
    name: '20251214_220216_add_categories_tags',
  },
  {
    up: migration_20251215_001_add_media_prefix.up,
    down: migration_20251215_001_add_media_prefix.down,
    name: '20251215_001_add_media_prefix',
  },
  {
    up: migration_20251215_142716_add_sites_and_article_site.up,
    down: migration_20251215_142716_add_sites_and_article_site.down,
    name: '20251215_142716_add_sites_and_article_site',
  },
  {
    up: migration_20251215_161702_add_site_to_categories_tags.up,
    down: migration_20251215_161702_add_site_to_categories_tags.down,
    name: '20251215_161702_add_site_to_categories_tags',
  },
  {
    up: migration_20251215_185759_fix_unique_indexes_categories_tags.up,
    down: migration_20251215_185759_fix_unique_indexes_categories_tags.down,
    name: '20251215_185759_fix_unique_indexes_categories_tags',
  },
  {
    up: migration_20251223_add_support_collections.up,
    down: migration_20251223_add_support_collections.down,
    name: '20251223_add_support_collections',
  },
  {
    up: migration_20251223_fix_announcements_columns.up,
    down: migration_20251223_fix_announcements_columns.down,
    name: '20251223_fix_announcements_columns',
  },
  {
    up: migration_20251226_add_kb_steps_triggers.up,
    down: migration_20251226_add_kb_steps_triggers.down,
    name: '20251226_add_kb_steps_triggers',
  },
  {
    up: migration_20251229_add_support_events_triage.up,
    down: migration_20251229_add_support_events_triage.down,
    name: '20251229_add_support_events_triage',
  },
  {
    up: migration_20260218_add_article_seo_fields.up,
    down: migration_20260218_add_article_seo_fields.down,
    name: '20260218_add_article_seo_fields',
  },
  {
    up: migration_20260224_add_internal_linker_collections.up,
    down: migration_20260224_add_internal_linker_collections.down,
    name: '20260224_add_internal_linker_collections',
  },
  {
    up: migration_20260224_internal_linker_hardening.up,
    down: migration_20260224_internal_linker_hardening.down,
    name: '20260224_internal_linker_hardening',
  },
  {
    up: migration_20260225_add_sites_revalidate_columns.up,
    down: migration_20260225_add_sites_revalidate_columns.down,
    name: '20260225_add_sites_revalidate_columns',
  },
  {
    up: migration_20260227_214422.up,
    down: migration_20260227_214422.down,
    name: '20260227_214422',
  },
  {
    up: migration_20260302_add_author_avatar_url.up,
    down: migration_20260302_add_author_avatar_url.down,
    name: '20260302_add_author_avatar_url',
  },
  {
    up: migration_20260317_add_published_to_directory_entries_status.up,
    down: migration_20260317_add_published_to_directory_entries_status.down,
    name: '20260317_add_published_to_directory_entries_status',
  },
  {
    up: migration_20260324_180149.up,
    down: migration_20260324_180149.down,
    name: '20260324_180149',
  },
  {
    up: migration_20260404_233155_add_wcc_collections.up,
    down: migration_20260404_233155_add_wcc_collections.down,
    name: '20260404_233155_add_wcc_collections',
  },
  {
    up: migration_20260407_153609_add_articles_html_field.up,
    down: migration_20260407_153609_add_articles_html_field.down,
    name: '20260407_153609_add_articles_html_field',
  },
  {
    up: migration_20260407_203747_add_articles_thumbnail_url.up,
    down: migration_20260407_203747_add_articles_thumbnail_url.down,
    name: '20260407_203747_add_articles_thumbnail_url',
  },
  {
    up: migration_20260408_041441_add_wineries_hero_image_url.up,
    down: migration_20260408_041441_add_wineries_hero_image_url.down,
    name: '20260408_041441_add_wineries_hero_image_url'
  },
  {
    up: migration_20260419_add_citad_collections.up,
    down: migration_20260419_add_citad_collections.down,
    name: '20260419_add_citad_collections',
  },
  {
    up: migration_20260421_schema_addendum_2.up,
    down: migration_20260421_schema_addendum_2.down,
    name: '20260421_schema_addendum_2',
  },
];
