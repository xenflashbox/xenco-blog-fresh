import fs from 'fs'

let cachedApiKey: string | null | undefined

function readFileApiKey(path: string): string | null {
  try {
    const value = fs.readFileSync(path, 'utf8').trim()
    return value || null
  } catch {
    return null
  }
}

export function getInternalLinkerApiKey(): string | null {
  if (cachedApiKey !== undefined) return cachedApiKey

  const envValue = process.env.INTERNAL_LINKER_API_KEY?.trim()
  if (envValue) {
    cachedApiKey = envValue
    return cachedApiKey
  }

  const filePath =
    process.env.INTERNAL_LINKER_API_KEY_FILE?.trim() || '/run/secrets/internal_linker_api_key'
  const fromFile = readFileApiKey(filePath)
  cachedApiKey = fromFile
  return cachedApiKey
}

export function isInternalLinkerApiKeyValid(candidate: string | null): boolean {
  const configured = getInternalLinkerApiKey()
  if (!configured || !candidate) return false
  return candidate.trim() === configured
}
