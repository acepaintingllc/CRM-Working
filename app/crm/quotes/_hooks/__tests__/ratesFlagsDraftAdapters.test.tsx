import { describe, expect, it } from 'vitest'
import {
  createEmptyDraft,
  draftToMutationValues,
  formatDraftValue,
  rowToDraft,
  updateDraftField,
  validateDraft,
} from '@/lib/quotes/ratesFlagsDraftAdapters'
import type { RatesFlagsCategory } from '@/types/estimator/ratesFlags'

const baseCategory: RatesFlagsCategory = {
  key: 'scope_defaults',
  tab: 'room_defaults',
  group: 'scope_defaults',
  label: 'Scope Defaults',
  table_title: 'Scope Defaults',
  description: 'Defaults',
  columns: [],
  fields: [
    { key: 'id', label: 'ID', type: 'text', required: true },
    { key: 'display_name', label: 'Display Name', type: 'text', required: true },
    { key: 'typical_height_ft', label: 'Typical Height', type: 'number' },
    { key: 'default_wall_mode', label: 'Wall Mode', type: 'select', options: ['RECT', 'SEG'] },
    { key: 'include_walls', label: 'Include Walls', type: 'select', options: ['Y', 'N'] },
    { key: 'system_group', label: 'System Group', type: 'select', readOnly: true, options: ['template'] },
  ],
  rows: [],
}

describe('ratesFlagsDraftAdapters', () => {
  it('converts rows into typed drafts and formats values for the UI', () => {
    const draft = rowToDraft(baseCategory, {
      id: 'ROOM_A',
      display_name: 'Room A',
      notes: '',
      active: true,
      default_wall_mode: 'SEG',
      top_cut_in_factor: '1',
      bot_cut_in_factor: '1',
      typical_height_ft: '9.5',
      include_walls: 'Y',
      include_ceilings: 'N',
      include_trim: 'N',
      include_doors: 'N',
      include_drywall: 'N',
      system_group: 'template',
    } as never)

    expect(draft.id).toBe('ROOM_A')
    expect(draft.typical_height_ft).toBe(9.5)
    expect(draft.default_wall_mode).toBe('SEG')
    expect(draft.include_walls).toBe(true)
    expect(formatDraftValue(baseCategory, draft, 'include_walls')).toBe('Y')
    expect(formatDraftValue(baseCategory, draft, 'typical_height_ft')).toBe('9.5')
  })

  it('builds empty drafts with category defaults and typed blanks', () => {
    const draft = createEmptyDraft({
      ...baseCategory,
      key: 'supply_rates_area_based',
      tab: 'rates',
      group: 'supply_rates',
      fields: [
        { key: 'id', label: 'ID', type: 'text', required: true },
        { key: 'unit', label: 'Unit', type: 'select', options: ['$/sqft'] },
        { key: 'cost_per', label: 'Cost Per', type: 'number' },
      ],
    })

    expect(draft.id).toBe('')
    expect(draft.unit).toBe('$/sqft')
    expect(draft.cost_per).toBeNull()
  })

  it('updates typed fields, rejects read-only edits, and validates required/select rules', () => {
    const empty = createEmptyDraft(baseCategory)
    const next = updateDraftField(baseCategory, empty, 'typical_height_ft', '10.25')
    const withSelect = updateDraftField(baseCategory, next, 'default_wall_mode', 'SEG')
    const withBoolean = updateDraftField(baseCategory, withSelect, 'include_walls', 'N')
    const readOnlyAttempt = updateDraftField(baseCategory, withBoolean, 'system_group', 'other')

    expect(withBoolean.typical_height_ft).toBe(10.25)
    expect(withBoolean.default_wall_mode).toBe('SEG')
    expect(withBoolean.include_walls).toBe(false)
    expect(readOnlyAttempt.system_group).toBe('template')

    const invalidSelect = validateDraft(baseCategory, {
      ...withBoolean,
      id: 'ROOM_A',
      display_name: 'Room A',
      default_wall_mode: 'INVALID',
    })
    expect(invalidSelect).toEqual({
      ok: false,
      error: 'Wall Mode must be one of: RECT, SEG.',
      fieldKey: 'default_wall_mode',
    })

    const missingRequired = validateDraft(baseCategory, {
      ...withBoolean,
      id: '',
      display_name: '',
    })
    expect(missingRequired).toEqual({
      ok: false,
      error: 'ID is required.',
      fieldKey: 'id',
    })
  })

  it('serializes typed drafts back to mutation values', () => {
    const values = draftToMutationValues(
      baseCategory,
      {
        id: 'ROOM_A',
        display_name: 'Room A',
        typical_height_ft: 8.5,
        default_wall_mode: 'RECT',
        include_walls: true,
        system_group: 'template',
      },
      false
    )

    expect(values).toEqual({
      id: 'ROOM_A',
      display_name: 'Room A',
      typical_height_ft: '8.5',
      default_wall_mode: 'RECT',
      include_walls: 'Y',
      system_group: 'template',
      active: 'N',
    })
  })

  it('normalizes number parsing edge cases', () => {
    const empty = createEmptyDraft(baseCategory)
    const blank = updateDraftField(baseCategory, empty, 'typical_height_ft', ' ')
    const currency = updateDraftField(baseCategory, blank, 'typical_height_ft', '$1,250.50')
    const invalid = updateDraftField(baseCategory, currency, 'typical_height_ft', 'abc')

    expect(blank.typical_height_ft).toBeNull()
    expect(currency.typical_height_ft).toBe(1250.5)
    expect(invalid.typical_height_ft).toBeNull()
  })
})
