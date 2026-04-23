import assert from 'node:assert/strict'
import test from 'node:test'
import { getRatesFlagsDraftAdapter } from '../ratesFlagsDraftAdapters.ts'
import {
  createEmptyTypedDraft,
  rowToTypedDraft,
  updateTypedDraftField,
  validateTypedDraft,
} from '../ratesFlagsDraftAdapters/shared.ts'
import type {
  RatesFlagsCategory,
  RatesFlagsEditableCategory,
  RoomTemplateDraft,
  ScopeDefaultDraft,
  SupplyRateDraft,
} from '../../../types/estimator/ratesFlags'

const scopeDefaultsCategory: RatesFlagsEditableCategory<'scope_defaults'> = {
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

test('shared draft helpers preserve empty defaults and typed row hydration', () => {
  const areaCategory: RatesFlagsCategory = {
    key: 'supply_rates_area_based',
    tab: 'rates',
    group: 'supply_rates',
    label: 'Area Supply',
    table_title: 'Area Supply',
    description: 'Area supply',
    columns: [],
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'unit', label: 'Unit', type: 'select', options: ['$/sqft'] },
      { key: 'cost_per', label: 'Cost Per', type: 'number' },
      { key: 'include_walls', label: 'Include Walls', type: 'select', options: ['Y', 'N'] },
    ],
    rows: [],
  }

  const empty = createEmptyTypedDraft<SupplyRateDraft & { include_walls: boolean }>(areaCategory)
  assert.equal(empty.id, '')
  assert.equal(empty.unit, '$/sqft')
  assert.equal(empty.cost_per, null)
  assert.equal(empty.include_walls, true)

  const hydrated = rowToTypedDraft<ScopeDefaultDraft>(scopeDefaultsCategory, {
    id: 'ROOM_A',
    display_name: 'Room A',
    notes: 'Keep notes',
    active: true,
    default_wall_mode: 'SEG',
    top_cut_in_factor: '1',
    bot_cut_in_factor: '1',
    typical_height_ft: '9.5',
    include_walls: 'N',
    include_ceilings: 'Y',
    include_trim: 'N',
    include_doors: 'N',
    include_drywall: 'N',
    system_group: 'template',
  } as never)
  assert.equal(hydrated.typical_height_ft, 9.5)
  assert.equal(hydrated.include_walls, false)
  assert.equal(hydrated.notes, 'Keep notes')
})

test('shared draft helpers preserve read-only values, select fallback, and validation behavior', () => {
  const start = createEmptyTypedDraft<ScopeDefaultDraft & { system_group?: string }>(scopeDefaultsCategory)
  const withReadOnly = updateTypedDraftField(scopeDefaultsCategory, start, 'system_group', 'other')
  assert.equal(withReadOnly.system_group, 'template')

  const withNumber = updateTypedDraftField(scopeDefaultsCategory, withReadOnly, 'typical_height_ft', '$1,250.50')
  assert.equal(withNumber.typical_height_ft, 1250.5)

  const invalidSelect = updateTypedDraftField(scopeDefaultsCategory, withNumber, 'default_wall_mode', 'INVALID')
  assert.equal(invalidSelect.default_wall_mode, 'RECT')

  const invalidValidation = validateTypedDraft(scopeDefaultsCategory, {
    ...invalidSelect,
    id: '',
    display_name: '',
  })
  assert.deepEqual(invalidValidation, {
    ok: false,
    error: 'ID is required.',
    fieldKey: 'id',
  })
})

test('registry preserves production rate serializer behavior', () => {
  const adapter = getRatesFlagsDraftAdapter('production_rates_walls')
  assert.deepEqual(
    adapter.toMutationRequest({
      action: 'create',
      draft: {
        id: 'WALL_STANDARD',
        display_name: 'Walls',
        scope_id: 'walls',
        surface_type: 'smooth',
        condition: 'occupied',
        prep_sqft_per_hr: 100,
        sqft_per_hr: 150,
        primer_sqft_per_hr: 120,
        notes: '',
      },
      draftActive: true,
    }),
    {
      category: 'production_rates_walls',
      action: 'create',
      values: {
        production_scope: 'walls',
        id: 'WALL_STANDARD',
        scope_id: 'walls',
        display_name: 'Walls',
        surface_type: 'smooth',
        condition: 'occupied',
        prep_sqft_per_hr: '100',
        sqft_per_hr: '150',
        primer_sqft_per_hr: '120',
        notes: '',
        active: 'Y',
      },
    }
  )
})

test('registry preserves unit rate serializer behavior', () => {
  const adapter = getRatesFlagsDraftAdapter('unit_rates_trim')
  assert.deepEqual(
    adapter.toMutationRequest({
      action: 'create',
      draft: {
        id: 'TRIM_BASE',
        display_name: 'Trim Base',
        unit_rate_type: 'baseboard',
        unit: 'lf',
        default_qty: 1,
        labor_rate: 2,
        material_rate: 0.5,
        amount: 2.5,
        helper_allowed: true,
        default_production_rate_id: 'TRIM_STD',
        notes: '',
      },
      draftActive: false,
    }),
    {
      category: 'unit_rates_trim',
      action: 'create',
      values: {
        unit_rate_group: 'trim',
        id: 'TRIM_BASE',
        display_name: 'Trim Base',
        unit_rate_type: 'baseboard',
        unit: 'lf',
        default_qty: '1',
        labor_rate: '2',
        material_rate: '0.5',
        amount: '2.5',
        helper_allowed: 'Y',
        default_production_rate_id: 'TRIM_STD',
        notes: '',
        active: 'N',
      },
    }
  )
})

test('registry preserves access fee serializer behavior', () => {
  const adapter = getRatesFlagsDraftAdapter('access_fees_scaffolding')
  assert.deepEqual(
    adapter.toMutationRequest({
      action: 'create',
      draft: {
        id: 'ROLLING',
        display_name: 'Rolling Scaffold',
        fee_type: 'Labor',
        amount: 250,
        unit: 'each',
        notes: '',
      },
      draftActive: true,
    }),
    {
      category: 'access_fees_scaffolding',
      action: 'create',
      values: {
        access_group: 'scaffolding',
        id: 'ROLLING',
        display_name: 'Rolling Scaffold',
        fee_type: 'Labor',
        amount: '250',
        unit: 'each',
        notes: '',
        active: 'Y',
      },
    }
  )
})

test('registry preserves supply rate serializer behavior', () => {
  const adapter = getRatesFlagsDraftAdapter('supply_rates_roller_covers')
  assert.deepEqual(
    adapter.toMutationRequest({
      action: 'create',
      draft: {
        id: 'RC_9',
        display_name: '9 inch cover',
        scope: 'walls',
        size_in: 9,
        price_each: 3.25,
        notes: '',
      },
      draftActive: true,
    }),
    {
      category: 'supply_rates_roller_covers',
      action: 'create',
      values: {
        supply_group: 'roller_covers',
        id: 'RC_9',
        display_name: '9 inch cover',
        scope: 'walls',
        size_in: '9',
        price_each: '3.25',
        notes: '',
        active: 'Y',
      },
    }
  )
})

test('registry preserves multiplier serializer behavior', () => {
  const adapter = getRatesFlagsDraftAdapter('height_factors')
  assert.deepEqual(
    adapter.toMutationRequest({
      action: 'create',
      draft: {
        id: 'HEIGHT_TALL',
        display_name: 'Tall',
        min_height_ft: 9,
        max_height_ft: 12,
        primary_value: 1.15,
        notes: '',
      },
      draftActive: true,
    }),
    {
      category: 'height_factors',
      action: 'create',
      values: {
        id: 'HEIGHT_TALL',
        display_name: 'Tall',
        min_height_ft: '9',
        max_height_ft: '12',
        primary_value: '1.15',
        notes: '',
        active: 'Y',
      },
    }
  )
})

test('registry preserves room defaults serializer behavior', () => {
  const adapter = getRatesFlagsDraftAdapter('room_templates')
  assert.deepEqual(
    adapter.toMutationRequest({
      action: 'create',
      draft: {
        id: 'BEDROOM',
        display_name: 'Bedroom',
        room_type_id: 'ROOM_BED',
        default_wall_rate_id: 'WALL_STD',
        default_ceil_rate_id: 'CEIL_STD',
        default_complexity_id: 'COMP_STD',
        default_wall_mode: 'RECT',
        include_walls: true,
        include_ceilings: true,
        include_trim: false,
        include_doors: true,
        include_drywall: false,
        notes: '',
      } as RoomTemplateDraft,
      draftActive: true,
    }),
    {
      category: 'room_templates',
      action: 'create',
      values: {
        id: 'BEDROOM',
        display_name: 'Bedroom',
        room_type_id: 'ROOM_BED',
        default_wall_rate_id: 'WALL_STD',
        default_ceil_rate_id: 'CEIL_STD',
        default_complexity_id: 'COMP_STD',
        default_wall_mode: 'RECT',
        include_walls: 'Y',
        include_ceilings: 'Y',
        include_trim: 'N',
        include_doors: 'Y',
        include_drywall: 'N',
        notes: '',
        active: 'Y',
      },
    }
  )
})
