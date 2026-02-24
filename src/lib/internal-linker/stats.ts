export type InternalLinkRunStats = {
  scanned: number
  updated: number
  linksInserted: number
  fallbackInserted: number
  skippedAlreadyLinked: number
  skippedNoMatch: number
  skippedLocked: number
}

export function createEmptyStats(): InternalLinkRunStats {
  return {
    scanned: 0,
    updated: 0,
    linksInserted: 0,
    fallbackInserted: 0,
    skippedAlreadyLinked: 0,
    skippedNoMatch: 0,
    skippedLocked: 0,
  }
}
