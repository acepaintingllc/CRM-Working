import type {
  ConditionLevel,
  ConditionScopeFactors,
  EstimateV2ConditionModifier,
  EstimateV2ConditionSelections,
} from '@/types/estimator/v2'
import type { RatesFlagsPayload } from '@/types/estimator/ratesFlags'

export function emptyConditionSelections(): EstimateV2ConditionSelections {
  return { room: {}, wall: {}, ceiling: {}, trim: {} }
}

export function parseConditionModifiers(payload: RatesFlagsPayload): EstimateV2ConditionModifier[] {
  const category = payload.categories.find((c) => c.key === 'condition_modifiers')
  if (!category) return []
  return (category.rows as unknown as Record<string, unknown>[])
    .filter((row) => row.active === 'Y')
    .flatMap((row) => {
      const v = row.values_json as Record<string, unknown>
      const scope = String(v.scope ?? '')
      if (!['room', 'wall', 'ceiling', 'trim'].includes(scope)) return []
      return [
        {
          id: String(v.id ?? row.row_id),
          displayName: String(v.display_name ?? row.display_name ?? ''),
          scope: scope as EstimateV2ConditionModifier['scope'],
          modifierType: String(v.modifier_type ?? 'binary') as 'binary' | 'severity',
          factorField: String(v.factor_field ?? ''),
          levels: (v.levels ?? {}) as Partial<Record<ConditionLevel, number>>,
        },
      ]
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

export function resolveConditionFactor(
  conditions: EstimateV2ConditionModifier[],
  scope: EstimateV2ConditionModifier['scope'],
  selections: Record<string, ConditionLevel>
): number {
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
