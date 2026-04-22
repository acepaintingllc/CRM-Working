import type {
  RatesFlagsCategory,
  RatesFlagsCategoryKey,
  RatesFlagsRow,
} from '@/types/estimator/ratesFlags'

export function valueFromRatesFlagsRow(row: RatesFlagsRow, key: string) {
  if (key === 'active') return row.active ? 'ACTIVE' : 'ARCHIVED'
  const value = (row as Record<string, unknown>)[key]
  if (value == null) return ''
  if (typeof value === 'boolean') return value ? 'Y' : 'N'
  return String(value)
}

export function buildRatesFlagsDraftFromRow(category: RatesFlagsCategory, row: RatesFlagsRow) {
  const draft: Record<string, string> = {}
  for (const field of category.fields) {
    draft[field.key] = valueFromRatesFlagsRow(row, field.key)
  }
  if (!draft.id) draft.id = row.id
  if (!draft.display_name) draft.display_name = valueFromRatesFlagsRow(row, 'display_name')
  return draft
}

export function getDefaultRatesFlagsDraft(category: RatesFlagsCategory) {
  const draft: Record<string, string> = {}
  for (const field of category.fields) {
    if (field.options && field.options.length > 0) {
      draft[field.key] = field.options[0]
      continue
    }
    draft[field.key] = ''
  }
  if (category.key === 'area_costs' || category.key === 'supply_rates_area_based') {
    draft.unit = '$/sqft'
  }
  return draft
}

export function categoryByKey(
  categories: RatesFlagsCategory[],
  key: RatesFlagsCategoryKey
) {
  return categories.find((category) => category.key === key) ?? null
}
