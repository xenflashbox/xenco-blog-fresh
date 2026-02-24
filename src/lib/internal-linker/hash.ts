import crypto from 'crypto'

export function stableHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function buildContextHash(args: {
  sourceArticleId: string
  targetArticleId: string
  keyword: string
  anchorText: string
  strategyVersion: string
}): string {
  const normalized = [
    args.sourceArticleId,
    args.targetArticleId,
    args.keyword.trim().toLowerCase(),
    args.anchorText.trim().toLowerCase(),
    args.strategyVersion,
  ].join('|')
  return stableHash(normalized)
}
