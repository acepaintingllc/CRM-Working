import { supabaseAdmin } from './org.ts'

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

// Keyed by check-set; cached for the process lifetime so cold starts only pay
// one round-trip per unique check-set, and warm invocations pay zero.
// Caching the Promise deduplicates concurrent first-call races.
const schemaCache = new Map<string, Promise<SchemaCheckResult>>()

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

// Exported for tests only — clears the in-process singleton so each test
// starts from a clean state.
export function clearSchemaCheckCache() {
  schemaCache.clear()
}

async function runSchemaCheck(checks: SchemaTableCheck[]): Promise<SchemaCheckResult> {
  for (const check of checks) {
    const selectColumns = check.columns.join(', ')
    const probe = await supabaseAdmin.from(check.table).select(selectColumns).limit(1)
    if (probe.error) {
      return {
        ok: false,
        table: check.table,
        error: probe.error.message ?? `Schema check failed for table ${check.table}`,
      }
    }
  }
  return { ok: true }
}

export async function assertSchema(checks: SchemaTableCheck[]): Promise<SchemaCheckResult> {
  const key = cacheKeyForChecks(checks)
  let pending = schemaCache.get(key)
  if (!pending) {
    pending = runSchemaCheck(checks)
    schemaCache.set(key, pending)
    // If the underlying call throws unexpectedly, evict so the next caller
    // retries rather than receiving a stale rejection.
    pending.catch(() => schemaCache.delete(key))
  }
  return pending
}
