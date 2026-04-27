import {
  ratesFlagsEditableCategoryKeys as sharedRatesFlagsEditableCategoryKeys,
  type RatesFlagsActivationRequest,
  type RatesFlagsCategoryValueMap,
  type RatesFlagsCreateOrUpdateRequest,
  type RatesFlagsCategory,
  type RatesFlagsDraft,
  type RatesFlagsDraftValidationResult,
  type RatesFlagsEditableCategoryKey,
  type RatesFlagsFieldDef,
  type RatesFlagsRow,
} from '../../types/estimator/ratesFlags.ts'
import {
  getRatesFlagsMutationFieldSpecsFromFields,
  validateRatesFlagsCategoryValues,
  type RatesFlagsMutationFieldSpec,
} from './ratesFlagsMutationFields.ts'

type RatesFlagsArchiveAction = 'archive' | 'reactivate'
type RatesFlagsCreateOrUpdateAction = 'create' | 'update'
type DraftValue = string | number | boolean | null
type DraftRecord = Record<string, DraftValue | undefined>

export type RatesFlagsDraftAdapter<
  TKey extends RatesFlagsEditableCategoryKey,
> = {
  key: TKey
  createEmptyDraft: (category: RatesFlagsCategory) => RatesFlagsDraft<TKey>
  rowToDraft: (category: RatesFlagsCategory, row: RatesFlagsRow) => RatesFlagsDraft<TKey>
  updateDraftField: (
    category: RatesFlagsCategory,
    currentDraft: RatesFlagsDraft,
    fieldKey: string,
    rawInput: string
  ) => RatesFlagsDraft<TKey>
  validateDraft: (
    category: RatesFlagsCategory,
    draft: RatesFlagsDraft
  ) => RatesFlagsDraftValidationResult
  toMutationRequest: (params: {
    action: RatesFlagsCreateOrUpdateAction
    category: RatesFlagsCategory
    draft: RatesFlagsDraft
    draftActive: boolean
    originalId?: string
  }) => RatesFlagsCreateOrUpdateRequest<TKey>
  toArchiveRequest: (params: {
    action: RatesFlagsArchiveAction
    rowId: string
  }) => RatesFlagsActivationRequest<TKey>
  formatDraftValue: (category: RatesFlagsCategory, draft: RatesFlagsDraft, fieldKey: string) => string
  withDuplicateId: (draft: RatesFlagsDraft, rowId: string) => RatesFlagsDraft<TKey>
}

function isYnSelect(field: RatesFlagsFieldDef) {
  return (
    field.type === 'select' &&
    field.options?.length === 2 &&
    field.options[0] === 'Y' &&
    field.options[1] === 'N'
  )
}

function findField(category: RatesFlagsCategory, fieldKey: string) {
  return category.fields.find((field) => field.key === fieldKey) ?? null
}

function parseNumberValue(value: unknown): number | null | string {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/[$,%\s,]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : value
}

function normalizeCheckboxGroupValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean).join(',')
  }
  if (value == null) return ''
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(',')
}

function parseFieldValue(field: RatesFlagsFieldDef, raw: unknown): DraftValue {
  if (isYnSelect(field)) {
    if (raw === true || raw === 'Y') return true
    if (raw === false || raw === 'N') return false
    if (raw == null) return ''
    return String(raw)
  }

  if (field.type === 'number') return parseNumberValue(raw)
  if (field.type === 'checkbox_group') return normalizeCheckboxGroupValue(raw)
  if (raw == null) return ''
  return String(raw)
}

function asDraftString(value: string | number | boolean | null | undefined) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function getFieldDefault(field: RatesFlagsFieldDef): DraftValue {
  if (field.writeDefault != null) return parseFieldValue(field, field.writeDefault)
  if (field.readOnly && field.options?.length === 1) return parseFieldValue(field, field.options[0])
  if (isYnSelect(field)) return field.options?.[0] === 'Y'
  if (field.options && field.options.length > 0) return field.options[0] ?? ''
  return field.type === 'number' ? null : ''
}

function buildFieldDraft<TDraft extends RatesFlagsDraft>(
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
    draft[field.key] = getFieldDefault(field)
  }
  return draft as TDraft
}

function rowToTypedDraft<TDraft extends RatesFlagsDraft>(
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

function createEmptyTypedDraft<TDraft extends RatesFlagsDraft>(category: RatesFlagsCategory) {
  return buildFieldDraft<TDraft>(category)
}

function updateTypedDraftField<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  currentDraft: TDraft,
  fieldKey: string,
  rawInput: string
) {
  const field = findField(category, fieldKey)
  if (!field || field.readOnly) return currentDraft

  return {
    ...currentDraft,
    [fieldKey]: parseFieldValue(field, rawInput),
  } as TDraft
}

function getReadOnlyLiteralValue(field: RatesFlagsFieldDef) {
  if (!field.readOnly) return null
  if (field.writeDefault != null) return field.writeDefault
  if (field.options?.length === 1) return field.options[0] ?? ''
  return null
}

function validateTypedDraft<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  draft: TDraft
): RatesFlagsDraftValidationResult {
  for (const field of category.fields) {
    const value = draft[field.key as keyof TDraft]
    const empty = value == null || (typeof value === 'string' && value.trim() === '')

    const literalValue = getReadOnlyLiteralValue(field)
    if (literalValue != null && !empty && asDraftString(value as DraftValue) !== literalValue) {
      return {
        ok: false,
        error: `${field.label} must be '${literalValue}'.`,
        fieldKey: field.key,
      }
    }

    if (field.type === 'number') {
      const hasInvalidNumber = !empty && typeof value !== 'number'
      if (hasInvalidNumber) {
        return {
          ok: false,
          error: `${field.label} must be a valid number.`,
          fieldKey: field.key,
        }
      }
    }

    if (isYnSelect(field)) {
      const validYn =
        empty ||
        value === true ||
        value === false ||
        value === 'Y' ||
        value === 'N'
      if (!validYn) {
        return {
          ok: false,
          error: `${field.label} must be Y or N.`,
          fieldKey: field.key,
        }
      }
    } else if (field.type === 'select' && field.options && field.options.length > 0) {
      const textValue = typeof value === 'string' ? value : value == null ? '' : String(value)
      if (textValue && !field.options.includes(textValue)) {
        return {
          ok: false,
          error: `${field.label} must be one of: ${field.options.join(', ')}.`,
          fieldKey: field.key,
        }
      }
    } else if (field.type === 'checkbox_group' && field.options && field.options.length > 0) {
      const selected = asDraftString(value as DraftValue)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
      const invalid = selected.find((entry) => !field.options?.includes(entry))
      if (invalid) {
        return {
          ok: false,
          error: `${field.label} must only include: ${field.options.join(', ')}.`,
          fieldKey: field.key,
        }
      }
    }

    if (field.required && empty) {
      return {
        ok: false,
        error: `${field.label} is required.`,
        fieldKey: field.key,
      }
    }
  }

  const categoryIssue = validateRatesFlagsCategoryValues({
    categoryKey: category.key as RatesFlagsEditableCategoryKey,
    specs: getRatesFlagsMutationFieldSpecsFromFields(category.fields),
    values: draft as Record<string, unknown>,
  })
  if (categoryIssue) {
    return {
      ok: false,
      error: categoryIssue.error,
      fieldKey: categoryIssue.fieldKey,
    }
  }

  return { ok: true }
}

function formatTypedDraftValue<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  draft: TDraft,
  fieldKey: string
) {
  const field = findField(category, fieldKey)
  if (!field) return ''
  const value = draft[fieldKey as keyof TDraft]
  if (isYnSelect(field)) {
    if (value === true || value === 'Y') return 'Y'
    if (value === false || value === 'N') return 'N'
    return value == null ? '' : String(value)
  }
  if (field.type === 'number') return value == null ? '' : String(value)
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function withDuplicateId<TDraft extends RatesFlagsDraft>(draft: TDraft, rowId: string) {
  return {
    ...draft,
    id: `${rowId}_COPY`,
  }
}

function serializeDraftMutationValue(
  spec: RatesFlagsMutationFieldSpec,
  draft: DraftRecord,
  draftActive: boolean
) {
  if (spec.key === 'active') return draftActive ? 'Y' : 'N'
  if (spec.kind === 'literal') return spec.value

  const raw = draft[spec.key]
  const value = asDraftString(raw)
  if (!value && spec.defaultValue != null) return spec.defaultValue

  if (spec.kind === 'yn') {
    if (raw === true || raw === 'Y') return 'Y'
    if (raw === false || raw === 'N') return 'N'
    return value
  }

  return value
}

function toMutationValues<TKey extends RatesFlagsEditableCategoryKey>(
  categoryKey: TKey,
  category: RatesFlagsCategory,
  draft: RatesFlagsDraft,
  draftActive: boolean
): RatesFlagsCategoryValueMap[TKey] {
  const values: Record<string, string> = {}
  const draftRecord = draft as DraftRecord
  for (const spec of getRatesFlagsMutationFieldSpecsFromFields(category.fields)) {
    values[spec.key] = serializeDraftMutationValue(spec, draftRecord, draftActive)
  }
  return values as RatesFlagsCategoryValueMap[TKey]
}

function buildAdapter<TKey extends RatesFlagsEditableCategoryKey>(
  key: TKey
): RatesFlagsDraftAdapter<TKey> {
  return {
    key,
    createEmptyDraft(category) {
      return createEmptyTypedDraft<RatesFlagsDraft<TKey>>(category)
    },
    rowToDraft(category, row) {
      return rowToTypedDraft<RatesFlagsDraft<TKey>>(category, row)
    },
    updateDraftField(category, currentDraft, fieldKey, rawInput) {
      return updateTypedDraftField(category, currentDraft, fieldKey, rawInput) as RatesFlagsDraft<TKey>
    },
    validateDraft(category, draft) {
      return validateTypedDraft(category, draft)
    },
    toMutationRequest({ action, category, draft, draftActive, originalId }) {
      if (action === 'create') {
        return {
          category: key,
          action: 'create',
          values: toMutationValues(key, category, draft, draftActive),
        }
      }

      return {
        category: key,
        action: 'update',
        original_id: originalId ?? asDraftString(draft.id),
        values: toMutationValues(key, category, draft, draftActive),
      }
    },
    toArchiveRequest({ action, rowId }) {
      return {
        category: key,
        action,
        rowId,
      }
    },
    formatDraftValue(category, draft, fieldKey) {
      return formatTypedDraftValue(category, draft, fieldKey)
    },
    withDuplicateId(draft, rowId) {
      return withDuplicateId(draft, rowId) as RatesFlagsDraft<TKey>
    },
  }
}

type RatesFlagsDraftAdapterMap = {
  [TKey in RatesFlagsEditableCategoryKey]: RatesFlagsDraftAdapter<TKey>
}

export const ratesFlagsEditableCategoryKeys = sharedRatesFlagsEditableCategoryKeys

export const ratesFlagsDraftAdapters = Object.fromEntries(
  ratesFlagsEditableCategoryKeys.map((key) => [key, buildAdapter(key)] as const)
) as RatesFlagsDraftAdapterMap

const editableCategoryKeys = new Set<RatesFlagsEditableCategoryKey>(
  ratesFlagsEditableCategoryKeys
)

export function getRatesFlagsDraftAdapter<TKey extends RatesFlagsEditableCategoryKey>(
  key: TKey
): RatesFlagsDraftAdapterMap[TKey] {
  return ratesFlagsDraftAdapters[key]
}

export function isRatesFlagsEditableCategoryKey(
  key: string
): key is RatesFlagsEditableCategoryKey {
  return editableCategoryKeys.has(key as RatesFlagsEditableCategoryKey)
}

export function isRatesFlagsEditableCategory(
  category: RatesFlagsCategory
): category is RatesFlagsCategory & { key: RatesFlagsEditableCategoryKey } {
  return isRatesFlagsEditableCategoryKey(category.key)
}
