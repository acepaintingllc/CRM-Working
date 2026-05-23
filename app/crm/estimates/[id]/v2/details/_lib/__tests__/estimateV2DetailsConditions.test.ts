import { describe, expect, it } from 'vitest'
import {
  parseConditionModifiers,
  resolveConditionFactor,
  resolveAllConditionFactors,
  setConditionSelection,
  hydrateConditionSelections,
  countActiveConditions,
  emptyConditionSelections,
} from '../estimateV2DetailsConditions'
import type { ConditionModifierCatalogRow, RatesFlagsPayload } from '@/types/estimator/ratesFlags'
import type {
  EstimateV2ConditionModifier,
  EstimateV2ConditionSelections,
} from '@/types/estimator/v2Conditions'

function makePayload(rows: ConditionModifierCatalogRow[]): RatesFlagsPayload {
  return {
    source: 'db',
    seeded: true,
    template_version: 1,
    categories: [],
    condition_modifier_catalog: rows,
  }
}

function makeRow(overrides: Partial<ConditionModifierCatalogRow>): ConditionModifierCatalogRow {
  return {
    id: 'ROW',
    label: '',
    scope: 'trim',
    modifier_type: 'binary',
    factor_field: null,
    levels: {},
    notes: null,
    active: 'Y',
    ...overrides,
  }
}

const TRIM_OIL: EstimateV2ConditionModifier = {
  id: 'TRIM_OIL_BASED',
  displayName: 'Old oil-based paint',
  scope: 'trim',
  modifierType: 'binary',
  factorField: 'difficult_finish_factor',
  levels: { active: 1.35 },
}

const TRIM_CAULKING: EstimateV2ConditionModifier = {
  id: 'TRIM_CAULKING',
  displayName: 'Caulking needed',
  scope: 'trim',
  modifierType: 'severity',
  factorField: 'caulk_fill_factor',
  levels: { minor: 1.10, moderate: 1.25, major: 1.50 },
}

const ROOM_FURNISHED: EstimateV2ConditionModifier = {
  id: 'ROOM_FURNISHED',
  displayName: 'Room is furnished',
  scope: 'room',
  modifierType: 'binary',
  factorField: '',
  levels: { active: 1.15 },
}

describe('parseConditionModifiers', () => {
  it('returns empty array when no condition_modifier_catalog', () => {
    const payload: RatesFlagsPayload = { source: 'db', seeded: true, template_version: 1, categories: [] }
    expect(parseConditionModifiers(payload)).toEqual([])
  })

  it('returns empty array when condition_modifier_catalog is empty', () => {
    const payload = makePayload([])
    expect(parseConditionModifiers(payload)).toEqual([])
  })

  it('parses binary condition from catalog row', () => {
    const payload = makePayload([
      makeRow({
        id: 'TRIM_OIL_BASED',
        label: 'Old oil-based paint',
        active: 'Y',
        scope: 'trim',
        modifier_type: 'binary',
        factor_field: 'difficult_finish_factor',
        levels: { active: 1.35 },
      }),
    ])
    const result = parseConditionModifiers(payload)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'TRIM_OIL_BASED',
      displayName: 'Old oil-based paint',
      scope: 'trim',
      modifierType: 'binary',
      factorField: 'difficult_finish_factor',
      levels: { active: 1.35 },
    })
  })

  it('skips inactive rows', () => {
    const payload = makePayload([
      makeRow({ id: 'X', active: 'N', scope: 'trim', modifier_type: 'binary', levels: {} }),
    ])
    expect(parseConditionModifiers(payload)).toHaveLength(0)
  })

  it('uses empty string for null factor_field', () => {
    const payload = makePayload([
      makeRow({ id: 'X', active: 'Y', scope: 'room', modifier_type: 'binary', factor_field: null, levels: { active: 1.1 } }),
    ])
    const result = parseConditionModifiers(payload)
    expect(result[0].factorField).toBe('')
  })

  it('sorts results by id', () => {
    const payload = makePayload([
      makeRow({ id: 'ZZZ', active: 'Y', scope: 'trim', modifier_type: 'binary', levels: {} }),
      makeRow({ id: 'AAA', active: 'Y', scope: 'room', modifier_type: 'binary', levels: {} }),
    ])
    const result = parseConditionModifiers(payload)
    expect(result[0].id).toBe('AAA')
    expect(result[1].id).toBe('ZZZ')
  })
})

describe('resolveConditionFactor', () => {
  it('returns 1 when no conditions active', () => {
    expect(resolveConditionFactor([TRIM_OIL, TRIM_CAULKING], 'trim', {})).toBe(1)
  })

  it('applies binary condition factor', () => {
    expect(resolveConditionFactor([TRIM_OIL], 'trim', { TRIM_OIL_BASED: 'active' })).toBe(1.35)
  })

  it('applies severity level factor', () => {
    expect(resolveConditionFactor([TRIM_CAULKING], 'trim', { TRIM_CAULKING: 'major' })).toBe(1.50)
    expect(resolveConditionFactor([TRIM_CAULKING], 'trim', { TRIM_CAULKING: 'minor' })).toBe(1.10)
  })

  it('multiplies multiple active conditions', () => {
    const result = resolveConditionFactor(
      [TRIM_OIL, TRIM_CAULKING],
      'trim',
      { TRIM_OIL_BASED: 'active', TRIM_CAULKING: 'major' }
    )
    expect(result).toBeCloseTo(1.35 * 1.50)
  })

  it('ignores conditions for other scopes', () => {
    expect(resolveConditionFactor([ROOM_FURNISHED], 'trim', { ROOM_FURNISHED: 'active' })).toBe(1)
  })

  it('ignores unknown condition ids in selections', () => {
    expect(resolveConditionFactor([TRIM_OIL], 'trim', { UNKNOWN: 'active' })).toBe(1)
  })
})

describe('resolveAllConditionFactors', () => {
  it('returns 1 for all scopes when selections empty', () => {
    const factors = resolveAllConditionFactors([TRIM_OIL, ROOM_FURNISHED], emptyConditionSelections())
    expect(factors).toEqual({ room: 1, wall: 1, ceiling: 1, trim: 1 })
  })

  it('applies room factor separately from trim factor', () => {
    const selections: EstimateV2ConditionSelections = {
      room: { ROOM_FURNISHED: 'active' },
      wall: {},
      ceiling: {},
      trim: { TRIM_OIL_BASED: 'active' },
    }
    const factors = resolveAllConditionFactors([TRIM_OIL, ROOM_FURNISHED], selections)
    expect(factors.room).toBe(1.15)
    expect(factors.trim).toBe(1.35)
    expect(factors.wall).toBe(1)
    expect(factors.ceiling).toBe(1)
  })
})

describe('setConditionSelection', () => {
  it('adds a condition to a scope', () => {
    const result = setConditionSelection(emptyConditionSelections(), 'trim', 'TRIM_OIL_BASED', 'active')
    expect(result.trim).toEqual({ TRIM_OIL_BASED: 'active' })
  })

  it('removes a condition when level is null', () => {
    const start: EstimateV2ConditionSelections = {
      ...emptyConditionSelections(),
      trim: { TRIM_OIL_BASED: 'active' },
    }
    const result = setConditionSelection(start, 'trim', 'TRIM_OIL_BASED', null)
    expect(result.trim).toEqual({})
  })

  it('does not mutate other scopes', () => {
    const start: EstimateV2ConditionSelections = {
      ...emptyConditionSelections(),
      room: { ROOM_FURNISHED: 'active' },
    }
    const result = setConditionSelection(start, 'trim', 'TRIM_CAULKING', 'moderate')
    expect(result.room).toEqual({ ROOM_FURNISHED: 'active' })
  })
})

describe('hydrateConditionSelections', () => {
  it('returns empty selections for null', () => {
    expect(hydrateConditionSelections(null)).toEqual(emptyConditionSelections())
  })

  it('returns empty selections for non-object', () => {
    expect(hydrateConditionSelections('bad')).toEqual(emptyConditionSelections())
  })

  it('hydrates valid structure', () => {
    const raw = { room: { ROOM_FURNISHED: 'active' }, wall: {}, ceiling: {}, trim: { TRIM_OIL_BASED: 'active' } }
    expect(hydrateConditionSelections(raw)).toEqual(raw)
  })

  it('fills missing scopes with empty objects', () => {
    const result = hydrateConditionSelections({ trim: { TRIM_OIL_BASED: 'active' } })
    expect(result.room).toEqual({})
    expect(result.wall).toEqual({})
    expect(result.ceiling).toEqual({})
    expect(result.trim).toEqual({ TRIM_OIL_BASED: 'active' })
  })
})

describe('countActiveConditions', () => {
  it('returns 0 for empty selections', () => {
    expect(countActiveConditions({})).toBe(0)
  })

  it('counts all keys regardless of level', () => {
    expect(countActiveConditions({ A: 'active', B: 'major' })).toBe(2)
  })
})
