import type {
  RatesFlagsCategory,
  RatesFlagsDraft,
  RatesFlagsDraftValidationResult,
  RatesFlagsFieldDef,
  RatesFlagsRow,
} from '../../types/estimator/ratesFlags'

function isYnSelect(field: RatesFlagsFieldDef) {
  return field.type === 'select' && field.options?.length === 2 && field.options[0] === 'Y' && field.options[1] === 'N'
}

function findField(category: RatesFlagsCategory, fieldKey: string) {
  return category.fields.find((field) => field.key === fieldKey) ?? null
}

function parseNumberValue(value: unknown) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[$,%\s,]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseFieldValue(field: RatesFlagsFieldDef, raw: unknown) {
  if (isYnSelect(field)) {
    if (raw === true || raw === 'Y') return true
    if (raw === false || raw === 'N') return false
    return false
  }

  if (field.type === 'number') return parseNumberValue(raw)
  if (raw == null) return ''
  return String(raw)
}

function serializeFieldValue(field: RatesFlagsFieldDef, value: RatesFlagsDraft[string]) {
  if (isYnSelect(field)) return value ? 'Y' : 'N'
  if (field.type === 'number') return value == null ? '' : String(value)
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

export function rowToDraft(category: RatesFlagsCategory, row: RatesFlagsRow): RatesFlagsDraft {
  const draft: RatesFlagsDraft = {}
  for (const field of category.fields) {
    draft[field.key] = parseFieldValue(field, (row as Record<string, unknown>)[field.key])
  }
  if (draft.id == null || draft.id === '') draft.id = row.id
  if (draft.display_name == null || draft.display_name === '') {
    draft.display_name = row.display_name ?? ''
  }
  return draft
}

export function createEmptyDraft(category: RatesFlagsCategory): RatesFlagsDraft {
  const draft: RatesFlagsDraft = {}
  for (const field of category.fields) {
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
  if ((category.key === 'area_costs' || category.key === 'supply_rates_area_based') && !draft.unit) {
    draft.unit = '$/sqft'
  }
  return draft
}

export function updateDraftField(
  category: RatesFlagsCategory,
  currentDraft: RatesFlagsDraft,
  fieldKey: string,
  rawInput: string
): RatesFlagsDraft {
  const field = findField(category, fieldKey)
  if (!field || field.readOnly) return currentDraft

  let nextValue = parseFieldValue(field, rawInput)
  if (field.type === 'select' && !isYnSelect(field) && rawInput !== '' && field.options && !field.options.includes(rawInput)) {
    nextValue = currentDraft[fieldKey] ?? ''
  }

  return {
    ...currentDraft,
    [fieldKey]: nextValue,
  }
}

export function validateDraft(
  category: RatesFlagsCategory,
  draft: RatesFlagsDraft
): RatesFlagsDraftValidationResult {
  for (const field of category.fields) {
    const value = draft[field.key]

    if (field.type === 'number') {
      const hasInvalidNumber =
        value !== null && typeof value !== 'number'
      if (hasInvalidNumber) {
        return {
          ok: false,
          error: `${field.label} must be a valid number.`,
          fieldKey: field.key,
        }
      }
    }

    if (field.type === 'select' && field.options && field.options.length > 0 && !isYnSelect(field)) {
      const textValue = typeof value === 'string' ? value : value == null ? '' : String(value)
      if (textValue && !field.options.includes(textValue)) {
        return {
          ok: false,
          error: `${field.label} must be one of: ${field.options.join(', ')}.`,
          fieldKey: field.key,
        }
      }
    }

    const empty =
      value == null ||
      (typeof value === 'string' && value.trim() === '')
    if (field.required && empty) {
      return {
        ok: false,
        error: `${field.label} is required.`,
        fieldKey: field.key,
      }
    }
  }

  return { ok: true }
}

export function draftToMutationValues(
  category: RatesFlagsCategory,
  draft: RatesFlagsDraft,
  draftActive: boolean
) {
  const values: Record<string, unknown> = {}
  for (const field of category.fields) {
    values[field.key] = serializeFieldValue(field, draft[field.key] ?? null)
  }
  values.active = draftActive ? 'Y' : 'N'
  return values
}

export function formatDraftValue(
  category: RatesFlagsCategory,
  draft: RatesFlagsDraft,
  fieldKey: string
) {
  const field = findField(category, fieldKey)
  if (!field) return ''
  const value = draft[fieldKey]
  if (isYnSelect(field)) return value ? 'Y' : 'N'
  if (field.type === 'number') return value == null ? '' : String(value)
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}
