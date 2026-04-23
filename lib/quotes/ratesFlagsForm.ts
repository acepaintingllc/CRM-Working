import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsRow,
} from '../../types/estimator/ratesFlags'

export function valueFromRatesFlagsRow(row: RatesFlagsRow, key: string) {
  if (key === 'active') return row.active ? 'ACTIVE' : 'ARCHIVED'
  const value = (row as Record<string, unknown>)[key]
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'Y' : 'N'
  return String(value)
}

export function categoryByKey(
  categories: RatesFlagsCategory[],
  key: RatesFlagsCategoryKey
) {
  return categories.find((category) => category.key === key) ?? null
}

const SEARCHABLE_CORE_KEYS = ['id', 'display_name', 'notes'] as const

export function buildRatesFlagsSearchableText(
  category: RatesFlagsCategory,
  row: RatesFlagsRow
) {
  const parts: string[] = []
  const seen = new Set<string>()

  function append(value: string) {
    const normalized = value.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    parts.push(normalized)
  }

  for (const key of SEARCHABLE_CORE_KEYS) {
    append(valueFromRatesFlagsRow(row, key))
  }

  append(row.active ? 'active' : 'archived')
  append(row.active ? 'enabled' : 'disabled')

  for (const field of category.fields) {
    if (SEARCHABLE_CORE_KEYS.includes(field.key as (typeof SEARCHABLE_CORE_KEYS)[number])) continue
    append(valueFromRatesFlagsRow(row, field.key))
  }

  return parts.join(' ')
}
