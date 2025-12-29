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
    name: '20251223_add_support_collections'
  },
  {
    up: migration_20251223_fix_announcements_columns.up,
    down: migration_20251223_fix_announcements_columns.down,
    name: '20251223_fix_announcements_columns'
  },
  {
    up: migration_20251226_add_kb_steps_triggers.up,
    down: migration_20251226_add_kb_steps_triggers.down,
    name: '20251226_add_kb_steps_triggers'
  },
  {
    up: migration_20251229_add_support_events_triage.up,
    down: migration_20251229_add_support_events_triage.down,
    name: '20251229_add_support_events_triage'
  },
];
