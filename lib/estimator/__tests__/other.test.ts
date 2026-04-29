import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateOtherItems } from '../other.ts'

test('calculateOtherItems prices fixed, quantity, labor, and material rows', () => {
  const result = calculateOtherItems({
    rows: [
      {
        id: 'fixed-1',
        room_id: 'R001',
        position: 0,
        active: 'Y',
        description: 'Move built-in shelves',
        customer_label: 'Built-in shelf prep',
        pricing_mode: 'fixed',
        fixed_amount: 150,
        rollup_target: 'other',
        customer_visibility: 'standalone',
      },
      {
        id: 'qty-1',
        room_id: 'R001',
        position: 1,
        active: 'Y',
        description: 'Patch odd holes',
        pricing_mode: 'quantity_rate',
        quantity: 3,
        unit_rate: 45,
        rollup_target: 'drywall',
        customer_visibility: 'rollup',
      },
      {
        id: 'labor-1',
        room_id: 'R002',
        position: 2,
        active: 'Y',
        description: 'Hand scrape rail',
        pricing_mode: 'labor',
        labor_hours: 2.5,
        labor_rate: 80,
        rollup_target: 'trim',
        customer_visibility: 'rollup',
      },
      {
        id: 'supply-1',
        room_id: null,
        position: 3,
        active: 'Y',
        description: 'Special masking plastic',
        pricing_mode: 'material_supply',
        material_cost: 60,
        supply_cost: 15,
        rollup_target: 'job_total',
        customer_visibility: 'standalone',
      },
    ],
    settings: { labor_rate_per_hour: 75 },
  })

  assert.equal(result.scopes[0].effective_total, 150)
  assert.equal(result.scopes[1].effective_total, 135)
  assert.equal(result.scopes[2].effective_paint_hours, 2.5)
  assert.equal(result.scopes[2].effective_total, 200)
  assert.equal(result.scopes[3].effective_total, 75)
  assert.deepEqual(result.room_totals, [
    { room_id: 'R001', effective_total: 285 },
    { room_id: 'R002', effective_total: 200 },
  ])
})

test('calculateOtherItems ignores inactive rows and uses estimate labor rate fallback', () => {
  const result = calculateOtherItems({
    rows: [
      {
        id: 'inactive-1',
        room_id: 'R001',
        position: 0,
        active: 'N',
        description: 'Inactive custom work',
        pricing_mode: 'fixed',
        fixed_amount: 999,
        rollup_target: 'other',
        customer_visibility: 'standalone',
      },
      {
        id: 'labor-1',
        room_id: 'R001',
        position: 1,
        active: 'Y',
        description: 'Default labor rate work',
        pricing_mode: 'labor',
        labor_hours: 1.25,
        labor_rate: null,
        rollup_target: 'other',
        customer_visibility: 'standalone',
      },
    ],
    settings: { labor_rate_per_hour: 92 },
  })

  assert.equal(result.scopes[0].include, 'N')
  assert.equal(result.scopes[0].effective_total, 0)
  assert.equal(result.scopes[1].labor_rate_per_hour, 92)
  assert.equal(result.scopes[1].effective_total, 115)
  assert.deepEqual(result.room_totals, [{ room_id: 'R001', effective_total: 115 }])
})
