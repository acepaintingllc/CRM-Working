import {
  getRatesFlagsDraftAdapter,
  ratesFlagsEditableCategoryKeys,
} from '../ratesFlagsDraftAdapters.ts'
import { CATEGORY_CONFIGS } from '../../server/rates-flags/categories.ts'
import type {
  RatesFlagsActivationRequest,
  RatesFlagsCategory,
  RatesFlagsCreateRequest,
  RatesFlagsDraft,
  RatesFlagsDraftValue,
  RatesFlagsEditableCategory,
  RatesFlagsEditableCategoryKey,
  RatesFlagsFieldDef,
  RatesFlagsUpdateRequest,
} from '../../../types/estimator/ratesFlags'

type MutableDraft = Record<string, RatesFlagsDraftValue>

const categoryConfigsByKey = new Map(
  CATEGORY_CONFIGS.map((config) => [config.key, config] as const)
)

function categoryId(key: RatesFlagsEditableCategoryKey) {
  return `TEST_${key.toUpperCase()}`
}

function isYnField(field: RatesFlagsFieldDef) {
  return field.options?.length === 2 && field.options[0] === 'Y' && field.options[1] === 'N'
}

function sampleValueForField(
  categoryKey: RatesFlagsEditableCategoryKey,
  field: RatesFlagsFieldDef,
  fieldIndex: number
): RatesFlagsDraftValue {
  if (field.key === 'id') return categoryId(categoryKey)
  if (field.key === 'display_name') return `Parity ${categoryKey}`
  if (field.key === 'notes') return 'parity test'

  if (isYnField(field)) return field.options?.[0] === 'Y'
  if (field.type === 'number') return 7.5 + fieldIndex
  if (field.options && field.options.length > 0) return field.options[0] ?? ''
  if (field.key.endsWith('_id')) return `${field.key.toUpperCase()}_${fieldIndex}`
  if (field.key === 'unit') return categoryKey === 'supply_rates_area_based' ? '$/sqft' : 'each'
  if (field.key === 'scope') return 'Wall'
  return `${field.key}_${fieldIndex}`
}

export function getRatesFlagsParityCategory<TKey extends RatesFlagsEditableCategoryKey>(
  key: TKey
): RatesFlagsEditableCategory<TKey> {
  const config = categoryConfigsByKey.get(key)
  if (!config) throw new Error(`Missing rates/flags category config for ${key}`)

  return {
    key,
    tab: config.tab,
    group: config.group,
    label: config.label,
    table_title: config.tableTitles[0] ?? config.label,
    description: config.description,
    columns: config.columns,
    fields: config.fields,
    rows: [],
  } as RatesFlagsEditableCategory<TKey>
}

export function buildValidRatesFlagsDraft<TKey extends RatesFlagsEditableCategoryKey>(
  category: RatesFlagsEditableCategory<TKey>
): RatesFlagsDraft<TKey> {
  const adapter = getRatesFlagsDraftAdapter(category.key)
  const draft = adapter.createEmptyDraft(category) as RatesFlagsDraft<TKey> & MutableDraft

  category.fields.forEach((field, fieldIndex) => {
    draft[field.key] = sampleValueForField(category.key, field, fieldIndex)
  })

  return draft as RatesFlagsDraft<TKey>
}

export function buildClientRatesFlagsMutationRequests<TKey extends RatesFlagsEditableCategoryKey>(
  key: TKey
): {
  category: RatesFlagsCategory & { key: TKey }
  draft: RatesFlagsDraft<TKey>
  create: RatesFlagsCreateRequest<TKey>
  update: RatesFlagsUpdateRequest<TKey>
  archive: RatesFlagsActivationRequest<TKey>
  reactivate: RatesFlagsActivationRequest<TKey>
} {
  const category = getRatesFlagsParityCategory(key)
  const adapter = getRatesFlagsDraftAdapter(key)
  const draft = buildValidRatesFlagsDraft(category)
  const rowId = categoryId(key)

  return {
    category,
    draft,
    create: adapter.toMutationRequest({
      action: 'create',
      category,
      draft,
      draftActive: true,
    }) as RatesFlagsCreateRequest<TKey>,
    update: adapter.toMutationRequest({
      action: 'update',
      category,
      draft,
      draftActive: false,
      originalId: rowId,
    }) as RatesFlagsUpdateRequest<TKey>,
    archive: adapter.toArchiveRequest({
      action: 'archive',
      rowId,
    }),
    reactivate: adapter.toArchiveRequest({
      action: 'reactivate',
      rowId,
    }),
  }
}

export function getRatesFlagsParityCategoryKeys() {
  return ratesFlagsEditableCategoryKeys
}
