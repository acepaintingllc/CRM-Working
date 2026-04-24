import type {
  RatesFlagsActivationRequest,
  RatesFlagsCategoryValueMap,
  RatesFlagsCreateOrUpdateRequest,
  DoorUnitRateDraft,
  DrywallUnitRateDraft,
  HeightFactorDraft,
  RoomTemplateDraft,
  RoomTypeDraft,
  RatesFlagsCategory,
  RatesFlagsDraft,
  RatesFlagsDraftByCategory,
  RatesFlagsDraftValidationResult,
  RatesFlagsEditableCategoryKey,
  RatesFlagsFieldDef,
  RatesFlagsRow,
  TrimUnitRateDraft,
} from '../../types/estimator/ratesFlags'

type RatesFlagsArchiveAction = 'archive' | 'reactivate'
type RatesFlagsCreateOrUpdateAction = 'create' | 'update'
type DraftValue = string | number | boolean | null

export type RatesFlagsDraftAdapter<
  TKey extends RatesFlagsEditableCategoryKey,
  TDraft extends RatesFlagsDraft<TKey> = RatesFlagsDraft<TKey>,
> = {
  key: TKey
  createEmptyDraft: (category: RatesFlagsCategory) => TDraft
  rowToDraft: (category: RatesFlagsCategory, row: RatesFlagsRow) => TDraft
  updateDraftField: (
    category: RatesFlagsCategory,
    currentDraft: TDraft,
    fieldKey: string,
    rawInput: string
  ) => TDraft
  validateDraft: (category: RatesFlagsCategory, draft: TDraft) => RatesFlagsDraftValidationResult
  toMutationRequest: (params: {
    action: RatesFlagsCreateOrUpdateAction
    draft: TDraft
    draftActive: boolean
    originalId?: string
  }) => RatesFlagsCreateOrUpdateRequest<TKey>
  toArchiveRequest: (params: {
    action: RatesFlagsArchiveAction
    rowId: string
  }) => RatesFlagsActivationRequest<TKey>
  formatDraftValue: (category: RatesFlagsCategory, draft: TDraft, fieldKey: string) => string
  withDuplicateId: (draft: TDraft, rowId: string) => TDraft
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

function asDraftString(value: string | number | boolean | null | undefined) {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function asDraftNumberString(value: string | number | boolean | null | undefined) {
  return value == null ? '' : String(value)
}

function asDraftYN(value: string | number | boolean | null | undefined) {
  return value ? 'Y' : 'N'
}

function asRollerCoverScope(value: string | number | boolean | null | undefined) {
  return asDraftString(value)
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
  const draft = buildFieldDraft<TDraft>(category)
  if (category.key === 'supply_rates_area_based' && 'unit' in draft && !draft.unit) {
    draft.unit = '$/sqft'
  }
  return draft
}

function updateTypedDraftField<TDraft extends RatesFlagsDraft>(
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

function validateTypedDraft<TDraft extends RatesFlagsDraft>(
  category: RatesFlagsCategory,
  draft: TDraft
): RatesFlagsDraftValidationResult {
  for (const field of category.fields) {
    const value = draft[field.key as keyof TDraft]

    if (field.type === 'number') {
      const hasInvalidNumber = value !== null && typeof value !== 'number'
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

    const empty = value == null || (typeof value === 'string' && value.trim() === '')
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

function formatTypedDraftValue<TDraft extends RatesFlagsDraft>(
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

function withDuplicateId<TDraft extends RatesFlagsDraft>(draft: TDraft, rowId: string) {
  return {
    ...draft,
    id: `${rowId}_COPY`,
  }
}

function buildAdapter<TKey extends RatesFlagsEditableCategoryKey, TDraft extends RatesFlagsDraft<TKey>>(config: {
  key: TKey
  toValues: (draft: TDraft, draftActive: boolean) => RatesFlagsCategoryValueMap[TKey]
}): RatesFlagsDraftAdapter<TKey, TDraft> {
  return {
    key: config.key,
    createEmptyDraft(category) {
      return createEmptyTypedDraft<TDraft>(category)
    },
    rowToDraft(category, row) {
      return rowToTypedDraft<TDraft>(category, row)
    },
    updateDraftField(category, currentDraft, fieldKey, rawInput) {
      return updateTypedDraftField(category, currentDraft, fieldKey, rawInput)
    },
    validateDraft(category, draft) {
      return validateTypedDraft(category, draft)
    },
    toMutationRequest({ action, draft, draftActive, originalId }) {
      if (action === 'create') {
        return {
          category: config.key,
          action: 'create',
          values: config.toValues(draft, draftActive),
        }
      }

      return {
        category: config.key,
        action: 'update',
        original_id: originalId ?? asDraftString(draft.id),
        values: config.toValues(draft, draftActive),
      }
    },
    toArchiveRequest({ action, rowId }) {
      return {
        category: config.key,
        action,
        rowId,
      }
    },
    formatDraftValue(category, draft, fieldKey) {
      return formatTypedDraftValue(category, draft, fieldKey)
    },
    withDuplicateId(draft, rowId) {
      return withDuplicateId(draft, rowId)
    },
  }
}

function buildProductionRateValues<TKey extends 'production_rates_walls' | 'production_rates_ceilings' | 'production_rates_trim'>(
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

function buildUnitRateValues<TKey extends 'unit_rates_doors' | 'unit_rates_trim' | 'unit_rates_drywall'>(
  categoryKey: TKey,
  draft: DoorUnitRateDraft | TrimUnitRateDraft | DrywallUnitRateDraft,
  draftActive: boolean
) {
  const common = {
    id: asDraftString(draft.id),
    display_name: asDraftString(draft.display_name),
    unit_rate_type: asDraftString(draft.unit_rate_type),
    unit: asDraftString(draft.unit),
    default_qty: asDraftNumberString(draft.default_qty),
    labor_rate: asDraftNumberString(draft.labor_rate),
    material_rate: asDraftNumberString(draft.material_rate),
    amount: asDraftNumberString(draft.amount),
    notes: asDraftString(draft.notes),
    active: draftActive ? 'Y' : 'N',
  }

  if (categoryKey === 'unit_rates_trim') {
    const trimDraft = draft as TrimUnitRateDraft
    return {
      ...common,
      unit_rate_group: 'trim',
      helper_allowed: asDraftYN(trimDraft.helper_allowed),
      default_production_rate_id: asDraftString(trimDraft.default_production_rate_id),
    } as RatesFlagsCategoryValueMap[TKey]
  }

  return {
    ...common,
    unit_rate_group: categoryKey === 'unit_rates_doors' ? 'doors' : 'drywall',
  } as RatesFlagsCategoryValueMap[TKey]
}

function buildAccessFeeValues<TKey extends 'access_fees_ladders' | 'access_fees_scaffolding' | 'access_fees_specialty'>(
  categoryKey: TKey,
  draft: RatesFlagsDraftByCategory[TKey],
  draftActive: boolean
) {
  return {
    access_group:
      categoryKey === 'access_fees_ladders'
        ? 'ladders'
        : categoryKey === 'access_fees_scaffolding'
          ? 'scaffolding'
          : 'specialty',
    id: asDraftString(draft.id),
    display_name: asDraftString(draft.display_name),
    fee_type: asDraftString(draft.fee_type),
    amount: asDraftNumberString(draft.amount),
    unit: asDraftString(draft.unit),
    notes: asDraftString(draft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}

function buildSupplyValues<TKey extends 'supply_rates_per_color' | 'supply_rates_area_based' | 'supply_rates_per_job'>(
  categoryKey: TKey,
  draft: RatesFlagsDraftByCategory[TKey],
  draftActive: boolean
) {
  return {
    supply_group:
      categoryKey === 'supply_rates_per_color'
        ? 'per_color'
        : categoryKey === 'supply_rates_area_based'
          ? 'area_based'
          : 'per_job',
    id: asDraftString(draft.id),
    display_name: asDraftString(draft.display_name),
    scope: asDraftString(draft.scope),
    unit: categoryKey === 'supply_rates_area_based' ? '$/sqft' : asDraftString(draft.unit),
    cost_per: asDraftNumberString(draft.cost_per),
    notes: asDraftString(draft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}

function buildRollerCoverValues(
  draft: RatesFlagsDraftByCategory['supply_rates_roller_covers'],
  draftActive: boolean
): RatesFlagsCategoryValueMap['supply_rates_roller_covers'] {
  return {
    supply_group: 'roller_covers',
    id: asDraftString(draft.id),
    display_name: asDraftString(draft.display_name),
    scope: asRollerCoverScope(draft.scope),
    size_in: asDraftNumberString(draft.size_in),
    price_each: asDraftNumberString(draft.price_each),
    notes: asDraftString(draft.notes),
    active: draftActive ? 'Y' : 'N',
  }
}

function buildMultiplierValues<TKey extends 'wall_complexity' | 'height_factors' | 'ceiling_types' | 'condition_modifiers'>(
  categoryKey: TKey,
  draft: RatesFlagsDraftByCategory[TKey] | HeightFactorDraft,
  draftActive: boolean
) {
  if (categoryKey === 'condition_modifiers') {
    const conditionDraft = draft as RatesFlagsDraftByCategory['condition_modifiers']
    return {
      id: asDraftString(conditionDraft.id),
      display_name: asDraftString(conditionDraft.display_name),
      wall_factor: asDraftNumberString(conditionDraft.wall_factor),
      ceil_factor: asDraftNumberString(conditionDraft.ceil_factor),
      trim_factor: asDraftNumberString(conditionDraft.trim_factor),
      notes: asDraftString(conditionDraft.notes),
      active: draftActive ? 'Y' : 'N',
    } as RatesFlagsCategoryValueMap[TKey]
  }

  if (categoryKey === 'height_factors') {
    const heightDraft = draft as HeightFactorDraft
    return {
      id: asDraftString(heightDraft.id),
      display_name: asDraftString(heightDraft.display_name),
      min_height_ft: asDraftNumberString(heightDraft.min_height_ft),
      max_height_ft: asDraftNumberString(heightDraft.max_height_ft),
      primary_value: asDraftNumberString(heightDraft.primary_value),
      notes: asDraftString(heightDraft.notes),
      active: draftActive ? 'Y' : 'N',
    } as RatesFlagsCategoryValueMap[TKey]
  }

  const multiplierDraft = draft as
    | RatesFlagsDraftByCategory['wall_complexity']
    | RatesFlagsDraftByCategory['ceiling_types']
  return {
    id: asDraftString(multiplierDraft.id),
    display_name: asDraftString(multiplierDraft.display_name),
    primary_value: asDraftNumberString(multiplierDraft.primary_value),
    secondary_value: asDraftNumberString(multiplierDraft.secondary_value),
    notes: asDraftString(multiplierDraft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}

function buildRoomDefaultsValues<TKey extends 'room_types' | 'room_templates' | 'scope_defaults'>(
  categoryKey: TKey,
  draft: RoomTypeDraft | RoomTemplateDraft | RatesFlagsDraftByCategory['scope_defaults'],
  draftActive: boolean
) {
  if (categoryKey === 'room_templates') {
    const templateDraft = draft as RoomTemplateDraft
    return {
      id: asDraftString(templateDraft.id),
      display_name: asDraftString(templateDraft.display_name),
      room_type_id: asDraftString(templateDraft.room_type_id),
      default_wall_rate_id: asDraftString(templateDraft.default_wall_rate_id),
      default_ceil_rate_id: asDraftString(templateDraft.default_ceil_rate_id),
      default_complexity_id: asDraftString(templateDraft.default_complexity_id),
      default_wall_mode: asDraftString(templateDraft.default_wall_mode),
      include_walls: asDraftYN(templateDraft.include_walls),
      include_ceilings: asDraftYN(templateDraft.include_ceilings),
      include_trim: asDraftYN(templateDraft.include_trim),
      include_doors: asDraftYN(templateDraft.include_doors),
      include_drywall: asDraftYN(templateDraft.include_drywall),
      notes: asDraftString(templateDraft.notes),
      active: draftActive ? 'Y' : 'N',
    } as RatesFlagsCategoryValueMap[TKey]
  }

  if (categoryKey === 'scope_defaults') {
    const scopeDraft = draft as RatesFlagsDraftByCategory['scope_defaults']
    return {
      id: asDraftString(scopeDraft.id),
      display_name: asDraftString(scopeDraft.display_name),
      default_wall_mode: asDraftString(scopeDraft.default_wall_mode),
      top_cut_in_factor: asDraftNumberString(scopeDraft.top_cut_in_factor),
      bot_cut_in_factor: asDraftNumberString(scopeDraft.bot_cut_in_factor),
      typical_height_ft: asDraftNumberString(scopeDraft.typical_height_ft),
      include_walls: asDraftYN(scopeDraft.include_walls),
      include_ceilings: asDraftYN(scopeDraft.include_ceilings),
      include_trim: asDraftYN(scopeDraft.include_trim),
      include_doors: asDraftYN(scopeDraft.include_doors),
      include_drywall: asDraftYN(scopeDraft.include_drywall),
      notes: asDraftString(scopeDraft.notes),
      active: draftActive ? 'Y' : 'N',
    } as RatesFlagsCategoryValueMap[TKey]
  }

  const roomTypeDraft = draft as RoomTypeDraft
  return {
    id: asDraftString(roomTypeDraft.id),
    display_name: asDraftString(roomTypeDraft.display_name),
    default_wall_rate_id: asDraftString(roomTypeDraft.default_wall_rate_id),
    default_ceil_rate_id: asDraftString(roomTypeDraft.default_ceil_rate_id),
    default_complexity_id: asDraftString(roomTypeDraft.default_complexity_id),
    default_wall_mode: asDraftString(roomTypeDraft.default_wall_mode),
    top_cut_in_factor: asDraftNumberString(roomTypeDraft.top_cut_in_factor),
    bot_cut_in_factor: asDraftNumberString(roomTypeDraft.bot_cut_in_factor),
    typical_height_ft: asDraftNumberString(roomTypeDraft.typical_height_ft),
    notes: asDraftString(roomTypeDraft.notes),
    active: draftActive ? 'Y' : 'N',
  } as RatesFlagsCategoryValueMap[TKey]
}

export const ratesFlagsDraftAdapters = {
  production_rates_walls: buildAdapter({
    key: 'production_rates_walls',
    toValues: (draft, draftActive) =>
      buildProductionRateValues('production_rates_walls', draft, draftActive),
  }),
  production_rates_ceilings: buildAdapter({
    key: 'production_rates_ceilings',
    toValues: (draft, draftActive) =>
      buildProductionRateValues('production_rates_ceilings', draft, draftActive),
  }),
  production_rates_trim: buildAdapter({
    key: 'production_rates_trim',
    toValues: (draft, draftActive) =>
      buildProductionRateValues('production_rates_trim', draft, draftActive),
  }),
  unit_rates_doors: buildAdapter({
    key: 'unit_rates_doors',
    toValues: (draft, draftActive) => buildUnitRateValues('unit_rates_doors', draft, draftActive),
  }),
  unit_rates_trim: buildAdapter({
    key: 'unit_rates_trim',
    toValues: (draft, draftActive) => buildUnitRateValues('unit_rates_trim', draft, draftActive),
  }),
  unit_rates_drywall: buildAdapter({
    key: 'unit_rates_drywall',
    toValues: (draft, draftActive) => buildUnitRateValues('unit_rates_drywall', draft, draftActive),
  }),
  access_fees_ladders: buildAdapter({
    key: 'access_fees_ladders',
    toValues: (draft, draftActive) =>
      buildAccessFeeValues('access_fees_ladders', draft, draftActive),
  }),
  access_fees_scaffolding: buildAdapter({
    key: 'access_fees_scaffolding',
    toValues: (draft, draftActive) =>
      buildAccessFeeValues('access_fees_scaffolding', draft, draftActive),
  }),
  access_fees_specialty: buildAdapter({
    key: 'access_fees_specialty',
    toValues: (draft, draftActive) =>
      buildAccessFeeValues('access_fees_specialty', draft, draftActive),
  }),
  supply_rates_per_color: buildAdapter({
    key: 'supply_rates_per_color',
    toValues: (draft, draftActive) =>
      buildSupplyValues('supply_rates_per_color', draft, draftActive),
  }),
  supply_rates_area_based: buildAdapter({
    key: 'supply_rates_area_based',
    toValues: (draft, draftActive) =>
      buildSupplyValues('supply_rates_area_based', draft, draftActive),
  }),
  supply_rates_per_job: buildAdapter({
    key: 'supply_rates_per_job',
    toValues: (draft, draftActive) => buildSupplyValues('supply_rates_per_job', draft, draftActive),
  }),
  supply_rates_roller_covers: buildAdapter({
    key: 'supply_rates_roller_covers',
    toValues: (draft, draftActive) => buildRollerCoverValues(draft, draftActive),
  }),
  wall_complexity: buildAdapter({
    key: 'wall_complexity',
    toValues: (draft, draftActive) => buildMultiplierValues('wall_complexity', draft, draftActive),
  }),
  height_factors: buildAdapter({
    key: 'height_factors',
    toValues: (draft, draftActive) => buildMultiplierValues('height_factors', draft, draftActive),
  }),
  ceiling_types: buildAdapter({
    key: 'ceiling_types',
    toValues: (draft, draftActive) => buildMultiplierValues('ceiling_types', draft, draftActive),
  }),
  condition_modifiers: buildAdapter({
    key: 'condition_modifiers',
    toValues: (draft, draftActive) =>
      buildMultiplierValues('condition_modifiers', draft, draftActive),
  }),
  room_types: buildAdapter({
    key: 'room_types',
    toValues: (draft, draftActive) => buildRoomDefaultsValues('room_types', draft, draftActive),
  }),
  room_templates: buildAdapter({
    key: 'room_templates',
    toValues: (draft, draftActive) => buildRoomDefaultsValues('room_templates', draft, draftActive),
  }),
  scope_defaults: buildAdapter({
    key: 'scope_defaults',
    toValues: (draft, draftActive) => buildRoomDefaultsValues('scope_defaults', draft, draftActive),
  }),
} satisfies {
  [TKey in RatesFlagsEditableCategoryKey]: RatesFlagsDraftAdapter<TKey>
}

export const ratesFlagsEditableCategoryKeys = Object.freeze(
  Object.keys(ratesFlagsDraftAdapters)
) as readonly RatesFlagsEditableCategoryKey[]

const editableCategoryKeys = new Set<RatesFlagsEditableCategoryKey>(
  ratesFlagsEditableCategoryKeys
)

export function getRatesFlagsDraftAdapter<TKey extends RatesFlagsEditableCategoryKey>(
  key: TKey
): RatesFlagsDraftAdapter<TKey> {
  return ratesFlagsDraftAdapters[key] as unknown as RatesFlagsDraftAdapter<TKey>
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
