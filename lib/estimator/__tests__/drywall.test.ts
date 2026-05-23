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

test('scopeKey produces unique keys for two null-id null-position repairs in the same room', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      { id: null, room_id: 'R001', position: null, surface: 'wall', repair_type: 'UNKNOWN', unit: 'LF', quantity: 1 },
      { id: null, room_id: 'R001', position: null, surface: 'wall', repair_type: 'UNKNOWN', unit: 'LF', quantity: 1 },
    ],
    catalogs: { drywall_unit_rates: [] },
  })

  assert.equal(result.missing_inputs.length, 2)
  const [key0, key1] = result.missing_inputs.map((i) => i.scope_id)
  assert.notEqual(key0, key1, 'null-id null-position repairs in the same room must produce distinct scope keys')
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

test('calculateDrywallRepairs prices patch_opening_repair on a wall surface without a ceiling multiplier', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'wall-patch',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'patch_opening_repair',
        unit: 'SQFT',
        quantity: 2.5,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  const scope = result.scopes[0]
  assert.equal(scope.effective_quantity, 3)      // ceil(2.5)
  assert.equal(scope.ceiling_multiplier, 1)      // wall → no multiplier
  assert.equal(scope.calculated_total, 135)      // 3 × $45 × 1
  assert.equal(scope.effective_total, 135)
  assert.deepEqual(result.missing_inputs, [])
})

test('calculateDrywallRepairs prices patch_opening_repair on a ceiling surface with the ceiling multiplier', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'ceiling-patch',
        room_id: 'R001',
        surface: 'ceiling',
        repair_type: 'patch_opening_repair',
        unit: 'SQFT',
        quantity: 2,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  const scope = result.scopes[0]
  assert.equal(scope.effective_quantity, 2)
  assert.equal(scope.ceiling_multiplier, 1.25)   // ceiling → multiplier from catalog
  assert.equal(scope.calculated_total, 112.5)    // 2 × $45 × 1.25
  assert.equal(scope.effective_total, 112.5)
  assert.deepEqual(result.missing_inputs, [])
})

test('calculateDrywallRepairs flags ceiling_crack on a wall surface and zeroes out the total', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'bad-repair',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'ceiling_crack',
        unit: 'LF',
        quantity: 5,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  const scope = result.scopes[0]
  assert.equal(scope.calculated_total, 0)
  assert.equal(scope.effective_total, 0)
  assert.equal(result.missing_inputs.length, 1)
  assert.match(result.missing_inputs[0].message, /not valid for wall/i)
})

test('room totals carry only the narrower DrywallRoomTotal fields — no paint hours or gallons', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'repair-1',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 2,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  const total = result.room_totals[0]
  assert.equal(total.room_id, 'R001')
  assert.equal(typeof total.scope_count, 'number')
  assert.equal(typeof total.included_scope_count, 'number')
  assert.equal(typeof total.raw_total, 'number')
  assert.equal(typeof total.effective_total, 'number')
  assert.equal('raw_paint_hours' in total, false, 'room total must not expose raw_paint_hours')
  assert.equal('effective_paint_hours' in total, false, 'room total must not expose effective_paint_hours')
  assert.equal('raw_primer_hours' in total, false, 'room total must not expose raw_primer_hours')
  assert.equal('raw_paint_gallons' in total, false, 'room total must not expose raw_paint_gallons')
  assert.equal('raw_supply_cost' in total, false, 'room total must not expose raw_supply_cost')
  assert.equal('raw_area_sf' in total, false, 'room total must not expose raw_area_sf')
})

test('room totals accumulate raw_total and effective_total across multiple scopes in the same room', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'repair-a',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 2,
      },
      {
        id: 'repair-b',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 3,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  assert.equal(result.room_totals.length, 1)
  const total = result.room_totals[0]
  assert.equal(total.scope_count, 2)
  assert.equal(total.included_scope_count, 2)
  // qty 2 → effective 2, qty 3 → effective 3; both × $12/LF
  assert.equal(total.effective_total, 24 + 36)
})

test('room totals split correctly across multiple rooms', () => {
  const result = calculateDrywallRepairs({
    repairs: [
      {
        id: 'r1-repair',
        room_id: 'R001',
        surface: 'wall',
        repair_type: 'flat_wall_crack',
        unit: 'LF',
        quantity: 1,
      },
      {
        id: 'r2-repair',
        room_id: 'R002',
        surface: 'ceiling',
        repair_type: 'ceiling_crack',
        unit: 'LF',
        quantity: 2,
      },
    ],
    catalogs: { drywall_unit_rates: rates },
  })

  assert.equal(result.room_totals.length, 2)
  const r1 = result.room_totals.find((t) => t.room_id === 'R001')
  const r2 = result.room_totals.find((t) => t.room_id === 'R002')
  assert.ok(r1)
  assert.ok(r2)
  assert.equal(r1.scope_count, 1)
  assert.equal(r1.effective_total, 12)   // 1 LF × $12
  assert.equal(r2.scope_count, 1)
  assert.equal(r2.effective_total, 42)   // 2 LF × $14 × 1.5 ceiling multiplier
})
