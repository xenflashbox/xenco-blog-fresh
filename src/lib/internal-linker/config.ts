export const INTERNAL_LINKER_STRATEGY_VERSION = 'v1'
export const INTERNAL_LINKER_DEFAULT_BATCH_LIMIT = 20
export const INTERNAL_LINKER_DEFAULT_MAX_LINKS_PER_ARTICLE = 3
export const INTERNAL_LINKER_DEFAULT_MAX_PER_PARAGRAPH = 1
export const INTERNAL_LINKER_FALLBACK_HEADING = 'Related reading'
export const INTERNAL_LINKER_REQUIRE_RECENT_DRY_RUN_HOURS = 24
export const INTERNAL_LINKER_PUBLISHED_ONLY = true
export const INTERNAL_LINKER_PRESERVE_MANUAL_LINKS = true
export const INTERNAL_LINKER_PERSIST_GENERATED_RULES = false

export type InternalLinkRunMode = 'dry_run' | 'apply'
export type InternalLinkRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'partial'
export type InternalLinkPlacement = 'in_body' | 'related_reading'
