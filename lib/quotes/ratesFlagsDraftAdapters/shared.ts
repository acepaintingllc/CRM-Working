import type {
  RatesFlagsCategory,
  RatesFlagsCategoryValueMap,
  RatesFlagsDraft,
  RatesFlagsDraftByCategory,
  RatesFlagsFieldDef,
  RatesFlagsRow,
} from '../../../types/estimator/ratesFlags'
import type { DraftValue } from './types.ts'

export function isYnSelect(field: RatesFlagsFieldDef) {
  return (
    field.type === 'select' &&
    field.options?.length === 2 &&
    field.options[0] === 'Y' &&
    field.options[1] === 'N'
  )
}

export function findField(category: RatesFlagsCategory, fieldKey: string) {
  return category.fields.find((field) => field.key === fieldKey) ?? null
}

export function parseNumberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[$,%\s,]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseFieldValue(field: RatesFlagsFieldDef, raw: unknown) {
  if (isYnSelect(field)) {
    if (raw === true || raw === 'Y') return true
    if (raw === false || raw === 'N') return false
    return false
  }

  if (field.type === 'number') return parseNumberValue(raw)
  if (raw == null) return ''
  return String(raw)
}

export function asDraftString(value: string | number | boolean | null | undefined) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function asDraftNumberString(value: string | number | boolean | null | undefined) {
  return value == null ? '' : String(value)
}

export function asDraftYN(value: string | number | boolean | null | undefined) {
  return value ? 'Y' : 'N'
}

export function buildFieldDraft<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  rowValues?: Map<string, unknown>
) {
  const draft: Record<string, DraftValue> = {}
  for (const field of category.fields) {
    const raw = rowValues?.get(field.key)
    if (rowValues) {
      draft[field.key] = parseFieldValue(field, raw)
      continue
    }
    if (isYnSelect(field)) {
      draft[field.key] = field.options?.[0] === 'Y'
      continue
    }
    if (field.options && field.options.length > 0) {
      draft[field.key] = field.options[0]
      continue
    }
    draft[field.key] = field.type === 'number' ? null : ''
  }
  return draft as TDraft
}

export function rowToTypedDraft<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  row: RatesFlagsRow
) {
  const rowValues = new Map<string, unknown>(Object.entries(row))
  const draft = buildFieldDraft<TDraft>(category, rowValues)
  if (!('id' in draft) || draft.id == null || draft.id === '') draft.id = String(row.id ?? '')
  if (!('display_name' in draft) || draft.display_name == null || draft.display_name === '') {
    draft.display_name = String(row.display_name ?? '')
  }
  if (!('notes' in draft) || draft.notes == null) {
    draft.notes = typeof row.notes === 'string' ? row.notes : ''
  }
  return draft
}

export function createEmptyTypedDraft<TDraft extends RatesFlagsDraft>(category: RatesFlagsCategory) {
  const draft = buildFieldDraft<TDraft>(category)
  if (category.key === 'supply_rates_area_based' && 'unit' in draft && !draft.unit) {
    draft.unit = '$/sqft'
  }
  return draft
}

export function updateTypedDraftField<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  currentDraft: TDraft,
  fieldKey: string,
  rawInput: string
) {
  const field = findField(category, fieldKey)
  if (!field || field.readOnly) return currentDraft

  let nextValue = parseFieldValue(field, rawInput)
  if (
    field.type === 'select' &&
    !isYnSelect(field) &&
    rawInput !== '' &&
    field.options &&
    !field.options.includes(rawInput)
  ) {
    const currentValue = (currentDraft as Record<string, string | number | boolean | null>)[fieldKey]
    nextValue = currentValue ?? ''
  }

  return {
    ...currentDraft,
    [fieldKey]: nextValue,
  } as TDraft
}

export function validateTypedDraft<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  draft: TDraft
) {
  for (const field of category.fields) {
    const value = draft[field.key as keyof TDraft]

    if (field.type === 'number') {
      const hasInvalidNumber = value !== null && typeof value !== 'number'
      if (hasInvalidNumber) {
        return {
          ok: false as const,
          error: `${field.label} must be a valid number.`,
          fieldKey: field.key,
        }
      }
    }

    if (field.type === 'select' && field.options && field.options.length > 0 && !isYnSelect(field)) {
      const textValue = typeof value === 'string' ? value : value == null ? '' : String(value)
      if (textValue && !field.options.includes(textValue)) {
        return {
          ok: false as const,
          error: `${field.label} must be one of: ${field.options.join(', ')}.`,
          fieldKey: field.key,
        }
      }
    }

    const empty = value == null || (typeof value === 'string' && value.trim() === '')
    if (field.required && empty) {
      return {
        ok: false as const,
        error: `${field.label} is required.`,
        fieldKey: field.key,
      }
    }
  }

  return { ok: true as const }
}

export function formatTypedDraftValue<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  draft: TDraft,
  fieldKey: string
) {
  const field = findField(category, fieldKey)
  if (!field) return ''
  const value = draft[fieldKey as keyof TDraft]
  if (isYnSelect(field)) return value ? 'Y' : 'N'
  if (field.type === 'number') return value == null ? '' : String(value)
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function withDuplicateId<TDraft extends RatesFlagsDraft>(draft: TDraft, rowId: string) {
  return {
    ...draft,
    id: `${rowId}_COPY`,
  }
}

export function buildProductionRateValues<
  TKey extends 'production_rates_walls' | 'production_rates_ceilings' | 'production_rates_trim',
>(
  categoryKey: TKey,
  draft: RatesFlagsDraftByCategory[TKey],
  draftActive: boolean
) {
  return {
    production_scope:
      categoryKey === 'production_rates_walls'
        ? 'walls'
        : categoryKey === 'production_rates_ceilings'
          ? 'ceilings'
          : 'trim',
    id: asDraftString(draft.id),
    scope_id: asDraftString(draft.scope_id),
    display_name: asDraftString(draft.display_name),
    surface_type: asDraftString(draft.surface_type),
    condition: asDraftString(draft.condition),
    prep_sqft_per_hr: asDraftNumberString(draft.prep_sqft_per_hr),
    sqft_per_hr: asDraftNumberString(draft.sqft_per_hr),
    primer_sqft_per_hr: asDraftNumberString(draft.primer_sqft_per_hr),
    notes: asDraftString(draft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}
