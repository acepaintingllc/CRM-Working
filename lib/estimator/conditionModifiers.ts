import { asNullableNumber, asText } from './parsing.ts'

export type EstimateV2ConditionScope = 'room' | 'wall' | 'ceiling' | 'trim'
export type EstimateV2ConditionModifierType = 'binary' | 'severity'
export type EstimateV2ConditionLevel = 'active' | 'minor' | 'moderate' | 'major'
export type EstimateV2ConditionSelections = Partial<Record<string, EstimateV2ConditionLevel>>

export type EstimateV2ConditionModifier = {
  id: string
  label: string
  scope: EstimateV2ConditionScope
  modifier_type: EstimateV2ConditionModifierType
  factor_field: string | null
  levels: Partial<Record<EstimateV2ConditionLevel, number>>
  active?: 'Y' | 'N'
}

const VALID_LEVELS = new Set(['active', 'minor', 'moderate', 'major'])
const VALID_SCOPES = new Set(['room', 'wall', 'ceiling', 'trim'])

function normalizeLevel(value: unknown): EstimateV2ConditionLevel | null {
  const raw = asText(value).toLowerCase()
  return VALID_LEVELS.has(raw) ? (raw as EstimateV2ConditionLevel) : null
}

export function normalizeConditionSelections(value: unknown): EstimateV2ConditionSelections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const selections: EstimateV2ConditionSelections = {}
  for (const [key, rawLevel] of Object.entries(value as Record<string, unknown>)) {
    const id = asText(key).toUpperCase()
    const level = normalizeLevel(rawLevel)
    if (id && level) selections[id] = level
  }
  return selections
}

export function setConditionSelection(
  current: EstimateV2ConditionSelections | null | undefined,
  conditionId: string,
  level: EstimateV2ConditionLevel | 'none' | ''
): EstimateV2ConditionSelections {
  const next = { ...(current ?? {}) }
  const id = asText(conditionId).toUpperCase()
  if (!id) return next
  if (!level || level === 'none') {
    delete next[id]
    return next
  }
  next[id] = level
  return next
}

function normalizeScope(value: unknown): EstimateV2ConditionScope | null {
  const raw = asText(value).toLowerCase()
  if (raw === 'ceil' || raw === 'ceilings') return 'ceiling'
  if (raw === 'walls') return 'wall'
  if (VALID_SCOPES.has(raw)) return raw as EstimateV2ConditionScope
  return null
}

function normalizeModifierType(value: unknown): EstimateV2ConditionModifierType {
  return asText(value).toLowerCase() === 'binary' ? 'binary' : 'severity'
}

export function parseConditionModifierRow(row: {
  id?: unknown
  row_id?: unknown
  label?: unknown
  display_name?: unknown
  scope?: unknown
  modifier_type?: unknown
  factor_field?: unknown
  levels?: unknown
  active?: unknown
}): EstimateV2ConditionModifier | null {
  const id = asText(row.id ?? row.row_id).toUpperCase()
  const scope = normalizeScope(row.scope)
  if (!id || !scope) return null
  const rawLevels = row.levels
  const levels: EstimateV2ConditionModifier['levels'] = {}
  if (rawLevels && typeof rawLevels === 'object' && !Array.isArray(rawLevels)) {
    for (const [key, value] of Object.entries(rawLevels as Record<string, unknown>)) {
      const level = normalizeLevel(key)
      const factor = asNullableNumber(value)
      if (level && factor != null && factor > 0) levels[level] = factor
    }
  }
  if (Object.keys(levels).length === 0) return null
  return {
    id,
    label: asText(row.display_name ?? row.label) || id,
    scope,
    modifier_type: normalizeModifierType(row.modifier_type),
    factor_field: asText(row.factor_field) || null,
    levels,
    active: asText(row.active).toUpperCase() === 'N' ? 'N' : 'Y',
  }
}

export function resolveConditionFactor(params: {
  catalog: EstimateV2ConditionModifier[] | null | undefined
  scope: EstimateV2ConditionScope
  selections: EstimateV2ConditionSelections | null | undefined
}) {
  const selections = params.selections ?? {}
  let factor = 1
  for (const condition of params.catalog ?? []) {
    if (condition.active === 'N' || condition.scope !== params.scope) continue
    const level = selections[condition.id]
    if (!level) continue
    factor *= condition.levels[level] ?? 1
  }
  return factor
}

export function activeConditionCount(selections: EstimateV2ConditionSelections | null | undefined) {
  return Object.keys(selections ?? {}).length
}
