import * as migration_20251214_202754_initial from './20251214_202754_initial';

export const migrations = [
  {
    up: migration_20251214_202754_initial.up,
    down: migration_20251214_202754_initial.down,
    name: '20251214_202754_initial'
  },
];
