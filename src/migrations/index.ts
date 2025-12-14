import * as migration_20251214_202754_initial from './20251214_202754_initial';
import * as migration_20251214_204544_add_role from './20251214_204544_add_role';
import * as migration_20251214_212223_add_articles from './20251214_212223_add_articles';

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
    name: '20251214_212223_add_articles'
  },
];
