import type {
  ConditionLevel,
  ConditionScopeFactors,
  EstimateV2ConditionModifier,
  EstimateV2ConditionSelections,
} from '@/types/estimator/v2'
import type { ConditionModifierCatalogRow, RatesFlagsPayload } from '@/types/estimator/ratesFlags'

export function emptyConditionSelections(): EstimateV2ConditionSelections {
  return { room: {}, wall: {}, ceiling: {}, trim: {} }
}

export function parseConditionModifiers(payload: RatesFlagsPayload): EstimateV2ConditionModifier[] {
  const catalog = payload.condition_modifier_catalog
  if (!catalog || catalog.length === 0) return []
  return catalog
    .filter((row: ConditionModifierCatalogRow) => row.active === 'Y')
    .map((row: ConditionModifierCatalogRow): EstimateV2ConditionModifier => ({
      id: row.id,
      displayName: row.label,
      scope: row.scope,
      modifierType: row.modifier_type,
      factorField: row.factor_field ?? '',
      levels: row.levels,
    }))
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function resolveConditionFactor(
  conditions: EstimateV2ConditionModifier[],
  scope: EstimateV2ConditionModifier['scope'],
  selections: Record<string, ConditionLevel>
): number {
  // Details UI resolves the draft condition preview for save payload shaping; server
  // calculations recompute canonical condition factors in estimator preparation.
  return conditions
    .filter((c) => c.scope === scope)
    .reduce((acc, condition) => {
      const level = selections[condition.id]
      if (!level) return acc
      const factor = condition.levels[level]
      if (factor == null || factor <= 0) return acc
      return acc * factor
    }, 1)
}

export function resolveAllConditionFactors(
  conditions: EstimateV2ConditionModifier[],
  selections: EstimateV2ConditionSelections
): ConditionScopeFactors {
  return {
    room: resolveConditionFactor(conditions, 'room', selections.room),
    wall: resolveConditionFactor(conditions, 'wall', selections.wall),
    ceiling: resolveConditionFactor(conditions, 'ceiling', selections.ceiling),
    trim: resolveConditionFactor(conditions, 'trim', selections.trim),
  }
}

export function countActiveConditions(selections: Record<string, ConditionLevel>): number {
  return Object.keys(selections).length
}

export function setConditionSelection(
  selections: EstimateV2ConditionSelections,
  scope: EstimateV2ConditionModifier['scope'],
  conditionId: string,
  level: ConditionLevel | null
): EstimateV2ConditionSelections {
  const scopeSelections = { ...selections[scope] }
  if (level == null) {
    delete scopeSelections[conditionId]
  } else {
    scopeSelections[conditionId] = level
  }
  return { ...selections, [scope]: scopeSelections }
}

export function hydrateConditionSelections(raw: unknown): EstimateV2ConditionSelections {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyConditionSelections()
  }
  const r = raw as Record<string, unknown>
  const pick = (key: string): Record<string, ConditionLevel> => {
    const val = r[key]
    if (val == null || typeof val !== 'object' || Array.isArray(val)) return {}
    return val as Record<string, ConditionLevel>
  }
  return {
    room: pick('room'),
    wall: pick('wall'),
    ceiling: pick('ceiling'),
    trim: pick('trim'),
  }
}
