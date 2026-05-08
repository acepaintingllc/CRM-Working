import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateDrywallRepairs } from '../drywall.ts'

const rates = [
  {
    id: 'flat_wall_crack',
    label: 'Flat wall crack',
    unit_rate_type: 'flat_wall_crack',
    unit: 'LF',
    amount: 12,
    ceiling_multiplier: 1.5,
  },
  {
    id: 'ceiling_crack',
    label: 'Ceiling crack',
    unit_rate_type: 'ceiling_crack',
    unit: 'LF',
    amount: 14,
    ceiling_multiplier: 1.5,
  },
  {
    id: 'patch_opening_repair',
    label: 'Patch/opening repair',
    unit_rate_type: 'patch_opening_repair',
    unit: 'SQFT',
    amount: 45,
    ceiling_multiplier: 1.25,
  },
]

test('calculateDrywallRepairs rounds decimal quantities up before pricing', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'repair-1',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 3.1,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  assert.equal(result.scopes[0].raw_quantity, 3.1)
  assert.equal(result.scopes[0].effective_quantity, 4)
  assert.equal(result.scopes[0].base_unit_rate, 12)
  assert.equal(result.scopes[0].effective_total, 48)
  assert.equal(result.room_totals[0].effective_total, 48)
})

test('calculateDrywallRepairs applies ceiling multiplier to ceiling repairs', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'repair-1',
        room_id: 'R001',
        surface: 'ceiling',
        repair_type: 'ceiling_crack',
        unit: 'LF',
        quantity: 2.25,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  assert.equal(result.scopes[0].effective_quantity, 3)
  assert.equal(result.scopes[0].ceiling_multiplier, 1.5)
  assert.equal(result.scopes[0].calculated_total, 63)
})

test('calculateDrywallRepairs lets override total replace calculated total', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'repair-1',
        room_id: 'R001',
        surface: 'ceiling',
        repair_type: 'patch_opening_repair',
        unit: 'SQFT',
        quantity: 1.2,
        override_total: 200,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  assert.equal(result.scopes[0].calculated_total, 112.5)
  assert.equal(result.scopes[0].override_total, 200)
  assert.equal(result.scopes[0].effective_total, 200)
})

test('calculateDrywallRepairs zeros inactive repairs and excludes them from room totals', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'active-repair',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 2.2,
      },
      {
        id: 'inactive-repair',
        room_id: 'R001',
        active: 'N',
        surface: 'wall',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 99,
        override_total: 500,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  assert.equal(result.scopes[0].include, 'Y')
  assert.equal(result.scopes[0].effective_total, 36)
  assert.equal(result.scopes[1].include, 'N')
  assert.equal(result.scopes[1].active, 'N')
  assert.equal(result.scopes[1].raw_quantity, 0)
  assert.equal(result.scopes[1].effective_quantity, 0)
  assert.equal(result.scopes[1].calculated_total, 0)
  assert.equal(result.scopes[1].override_total, null)
  assert.equal(result.scopes[1].raw_total, 0)
  assert.equal(result.scopes[1].effective_total, 0)
  assert.equal(result.room_totals.length, 1)
  assert.equal(result.room_totals[0].scope_count, 1)
  assert.equal(result.room_totals[0].effective_total, 36)
})

test('calculateDrywallRepairs accepts include N as inactive and emits no room total', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'excluded-repair',
        room_id: 'R001',
        include: 'N',
        surface: 'ceiling',
        repair_type: 'ceiling_crack',
        unit: 'LF',
        quantity: 5,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  assert.equal(result.scopes[0].include, 'N')
  assert.equal(result.scopes[0].raw_total, 0)
  assert.equal(result.scopes[0].effective_total, 0)
  assert.deepEqual(result.room_totals, [])
  assert.deepEqual(result.missing_inputs, [])
})

test('calculateDrywallRepairs reports invalid surface/type combinations and missing rates', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'repair-1',
        room_id: 'R001',
        surface: 'ceiling',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 1,
      },
      {
        id: 'repair-2',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'corner_tape_replacement',
        unit: 'LF',
        quantity: 1,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  assert.equal(result.scopes[0].effective_total, 0)
  assert.equal(result.missing_inputs.length, 2)
  assert.match(result.missing_inputs[0].message, /not valid for ceiling/i)
  assert.match(result.missing_inputs[1].message, /rate is required/i)
})
