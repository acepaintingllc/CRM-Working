export type UnsafeRecord = Record<string, unknown>

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

export function asNullableNumber(value: unknown) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function asMaybeNumber(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export function toYN(value: unknown, fallback: 'Y' | 'N' = 'N') {
  const raw = asText(value).toUpperCase()
  if (raw === 'Y' || raw === 'N') return raw
  return fallback
}

export function toColorId(value: unknown) {
  return asText(value)
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

export function normalizeKey(value: unknown) {
  return asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function pickValue(row: UnsafeRecord, keys: string[]) {
  for (const key of keys) {
    if (key in row) return row[key]
  }
  return undefined
}

export function asNullableNumberFromKeys(row: UnsafeRecord, keys: string[]) {
  return asNullableNumber(pickValue(row, keys))
}

export function isUuid(value: unknown) {
  const raw = asText(value)
  return !!raw && UUID_RE.test(raw)
}
