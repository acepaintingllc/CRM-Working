import assert from 'node:assert/strict'
import test from 'node:test'
import type { RatesFlagsCategory, RatesFlagsRow } from '../../../types/estimator/ratesFlags'
import { buildRatesFlagsSearchableText } from '../ratesFlagsForm.ts'

test('buildRatesFlagsSearchableText includes explicit searchable values for production rate rows', () => {
  const category: RatesFlagsCategory = {
    key: 'production_rates_walls',
    tab: 'rates',
    group: 'production_rates',
    label: 'Wall Production',
    table_title: 'Wall Production',
    description: 'Wall rates',
    columns: [],
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true },
      { key: 'surface_type', label: 'Surface Type', type: 'text' },
      { key: 'condition', label: 'Condition', type: 'text' },
      { key: 'sqft_per_hr', label: 'Sq Ft / Hr', type: 'number' },
    ],
    rows: [],
  }

  const row: RatesFlagsRow = {
    id: 'wall-rate-1',
    display_name: 'Standard walls',
    notes: 'Main interior rate',
    active: true,
    production_scope: 'walls',
    scope_id: 'walls',
    surface_type: 'smooth',
    condition: 'occupied',
    prep_sqft_per_hr: '100',
    sqft_per_hr: '150',
    primer_sqft_per_hr: '120',
  }

  const text = buildRatesFlagsSearchableText(category, row)

  assert.match(text, /wall-rate-1/)
  assert.match(text, /standard walls/)
  assert.match(text, /main interior rate/)
  assert.match(text, /smooth/)
  assert.match(text, /occupied/)
  assert.match(text, /150/)
  assert.match(text, /active/)
  assert.doesNotMatch(text, /sqft_per_hr/)
})

test('buildRatesFlagsSearchableText includes explicit flag values and archived status terms', () => {
  const category: RatesFlagsCategory = {
    key: 'condition_modifiers',
    tab: 'flags',
    group: 'condition_modifiers',
    label: 'Condition Modifiers',
    table_title: 'Condition Modifiers',
    description: 'Flag rows',
    columns: [],
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true },
      { key: 'wall_factor', label: 'Wall Factor', type: 'number' },
      { key: 'ceil_factor', label: 'Ceiling Factor', type: 'number' },
      { key: 'trim_factor', label: 'Trim Factor', type: 'number' },
    ],
    rows: [],
  }

  const row: RatesFlagsRow = {
    id: 'flag-high-traffic',
    display_name: 'High traffic',
    notes: 'Use for heavy wear',
    active: false,
    wall_factor: '1.2',
    ceil_factor: '1.1',
    trim_factor: '1.05',
  }

  const text = buildRatesFlagsSearchableText(category, row)

  assert.match(text, /high traffic/)
  assert.match(text, /1.2/)
  assert.match(text, /1.1/)
  assert.match(text, /1.05/)
  assert.match(text, /archived/)
  assert.match(text, /disabled/)
})

test('buildRatesFlagsSearchableText includes room default and template identifiers from explicit fields', () => {
  const category: RatesFlagsCategory = {
    key: 'room_templates',
    tab: 'room_defaults',
    group: 'room_templates',
    label: 'Room Templates',
    table_title: 'Room Templates',
    description: 'Template rows',
    columns: [],
    fields: [
      { key: 'id', label: 'ID', type: 'text', required: true },
      { key: 'display_name', label: 'Display Name', type: 'text', required: true },
      { key: 'room_type_id', label: 'Room Type', type: 'text' },
      { key: 'default_wall_rate_id', label: 'Wall Rate', type: 'text' },
      { key: 'include_trim', label: 'Include Trim', type: 'select' },
    ],
    rows: [],
  }

  const row: RatesFlagsRow = {
    id: 'template-bedroom',
    display_name: 'Bedroom reset',
    notes: 'Base template',
    active: true,
    room_type_id: 'room-bedroom',
    default_wall_rate_id: 'wall-rate-standard',
    default_ceil_rate_id: 'ceil-rate-standard',
    default_complexity_id: 'complexity-standard',
    default_wall_mode: 'two_coat',
    include_walls: 'Y',
    include_ceilings: 'Y',
    include_trim: 'N',
    include_doors: 'Y',
    include_drywall: 'N',
  }

  const text = buildRatesFlagsSearchableText(category, row)

  assert.match(text, /template-bedroom/)
  assert.match(text, /bedroom reset/)
  assert.match(text, /room-bedroom/)
  assert.match(text, /wall-rate-standard/)
  assert.match(text, /(^| )n( |$)/)
})
