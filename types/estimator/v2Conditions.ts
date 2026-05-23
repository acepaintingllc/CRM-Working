// Condition modifier types — room & scope condition selections on the details page

export type ConditionLevel = 'active' | 'minor' | 'moderate' | 'major'

export type ConditionScopeFactors = {
  room: number
  wall: number
  ceiling: number
  trim: number
}

export type EstimateV2ConditionModifier = {
  id: string
  displayName: string
  scope: 'room' | 'wall' | 'ceiling' | 'trim'
  modifierType: 'binary' | 'severity'
  factorField: string
  levels: Partial<Record<ConditionLevel, number>>
}

export type EstimateV2ConditionSelections = {
  room: Record<string, ConditionLevel>
  wall: Record<string, ConditionLevel>
  ceiling: Record<string, ConditionLevel>
  trim: Record<string, ConditionLevel>
}
