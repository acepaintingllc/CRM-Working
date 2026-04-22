import type { RatesFlagsCategory, RatesFlagsCategoryKey, RatesFlagsRow } from '../../types/estimator/ratesFlags'

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
