import { supabaseAdmin } from '@/lib/server/org'

type SchemaTableCheck = {
  table: string
  columns: string[]
}

type SchemaCheckResult =
  | { ok: true }
  | {
      ok: false
      table: string
      error: string
    }

type CachedResult = {
  expiresAt: number
  result: SchemaCheckResult
}

const schemaCache = new Map<string, CachedResult>()
const defaultTtlMs = 5 * 60 * 1000

export function isMissingSchemaErrorMessage(message: string | null | undefined) {
  const text = (message ?? '').toLowerCase()
  if (!text) return false
  return (
    text.includes('schema cache') ||
    text.includes('does not exist') ||
    text.includes('could not find the table') ||
    text.includes('could not find the') ||
    text.includes('relation') ||
    text.includes('column')
  )
}

function cacheKeyForChecks(checks: SchemaTableCheck[]) {
  return checks
    .map((check) => `${check.table}:${check.columns.join(',')}`)
    .sort()
    .join('|')
}

export function clearSchemaCheckCache() {
  schemaCache.clear()
}

export async function assertSchema(checks: SchemaTableCheck[], ttlMs = defaultTtlMs) {
  const key = cacheKeyForChecks(checks)
  const now = Date.now()
  const cached = schemaCache.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.result
  }

  for (const check of checks) {
    const selectColumns = check.columns.join(', ')
    const probe = await supabaseAdmin.from(check.table).select(selectColumns).limit(1)
    if (probe.error) {
      const result: SchemaCheckResult = {
        ok: false,
        table: check.table,
        error: probe.error.message ?? `Schema check failed for table ${check.table}`,
      }
      schemaCache.set(key, { expiresAt: now + ttlMs, result })
      return result
    }
  }

  const result: SchemaCheckResult = { ok: true }
  schemaCache.set(key, { expiresAt: now + ttlMs, result })
  return result
}

