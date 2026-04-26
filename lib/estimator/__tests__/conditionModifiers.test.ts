import { describe, expect, it } from 'vitest'
import {
  normalizeConditionSelections,
  resolveConditionFactor,
  setConditionSelection,
  type EstimateV2ConditionModifier,
} from '../conditionModifiers'

const catalog: EstimateV2ConditionModifier[] = [
  {
    id: 'ROOM_FURNISHED',
    label: 'Room is furnished',
    scope: 'room',
    modifier_type: 'binary',
    factor_field: null,
    levels: { active: 1.15 },
  },
  {
    id: 'TRIM_CAULKING',
    label: 'Caulking needed',
    scope: 'trim',
    modifier_type: 'severity',
    factor_field: 'caulk_fill_factor',
    levels: { minor: 1.1, moderate: 1.25, major: 1.5 },
  },
]

describe('condition modifiers', () => {
  it('normalizes valid selections and drops invalid levels', () => {
    expect(
      normalizeConditionSelections({
        trim_caulking: 'moderate',
        ignored: 'extreme',
      })
    ).toEqual({ TRIM_CAULKING: 'moderate' })
  })

  it('sets and clears selections immutably', () => {
    const selected = setConditionSelection({}, 'trim_caulking', 'major')
    expect(selected).toEqual({ TRIM_CAULKING: 'major' })
    expect(setConditionSelection(selected, 'TRIM_CAULKING', 'none')).toEqual({})
  })

  it('resolves active level factors by condition scope', () => {
    expect(
      resolveConditionFactor({
        catalog,
        scope: 'trim',
        selections: { TRIM_CAULKING: 'moderate', ROOM_FURNISHED: 'active' },
      })
    ).toBe(1.25)
    expect(
      resolveConditionFactor({
        catalog,
        scope: 'room',
        selections: { ROOM_FURNISHED: 'active' },
      })
    ).toBe(1.15)
  })
})
