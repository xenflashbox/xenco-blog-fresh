// src/lib/meili.ts
import { MeiliSearch } from 'meilisearch'

export function getMeili() {
  const host = process.env.MEILISEARCH_HOST
  const apiKey = process.env.MEILISEARCH_KEY
  if (!host || !apiKey) return null
  return new MeiliSearch({ host, apiKey })
}
