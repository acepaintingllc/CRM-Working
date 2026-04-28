import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateTrim, type TrimCalculationInput } from '../trim.ts'

function approx(actual: number | null | undefined, expected: number, epsilon = 0.0001) {
  assert.notEqual(actual, null)
  assert.ok(Math.abs((actual as number) - expected) <= epsilon, `expected ${expected}, got ${actual}`)
}

function makeTrimScope(overrides: Partial<TrimCalculationInput['scopes'][0]> = {}): TrimCalculationInput['scopes'][0] {
  return {
    id: 'S1',
    room_id: 'R001',
    position: 0,
    include: 'Y',
    scope_name: 'Baseboard',
    trim_type_id: 'BASE_STD',
    trim_family: 'BASEBOARD',
    unit_type: 'LF',
    measurement_mode: 'MANUAL',
    helper_source: null,
    measurement_value: 60,
    helper_value: null,
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    paint_enabled: 'Y',
    prime_mode: 'NONE',
    spot_prime_percent: null,
    production_rate_id: null,
    prep_factor: 1,
    height_factor: 1,
    profile_factor: 1,
    room_flag_factor: 1,
    masking_factor: 1,
    stair_factor: 1,
    difficult_finish_factor: 1,
    caulk_fill_factor: 1,
    override_measurement: null,
    override_hours: null,
    override_gallons: null,
    override_supply_cost: null,
    override_total: null,
    override_description: null,
    raw_measurement: null,
    effective_measurement: null,
    raw_paint_hours: null,
    effective_paint_hours: null,
    raw_primer_hours: null,
    effective_primer_hours: null,
    raw_paint_gallons: null,
    effective_paint_gallons: null,
    raw_primer_gallons: null,
    effective_primer_gallons: null,
    raw_supply_cost: null,
    effective_supply_cost: null,
    raw_total: null,
    effective_total: null,
    notes: null,
    ...overrides,
  }
}

test('calculateTrim computes manual rows and room totals', () => {
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' }],
    scopes: [
      {
        id: 'S1',
        room_id: 'R001',
        position: 0,
        include: 'Y',
        scope_name: 'Baseboard',
        trim_type_id: 'BASE_STD',
        trim_family: 'BASEBOARD',
        unit_type: 'LF',
        measurement_mode: 'MANUAL',
        helper_source: null,
        measurement_value: 60,
        helper_value: null,
        color_id: 'A',
        paint_product_id: null,
        primer_product_id: null,
        paint_enabled: 'Y',
        prime_mode: 'NONE',
        spot_prime_percent: null,
        production_rate_id: null,
        prep_factor: 1,
        height_factor: 1,
        profile_factor: 1,
        room_flag_factor: 1,
        masking_factor: 1,
        stair_factor: 1,
        difficult_finish_factor: 1,
        caulk_fill_factor: 1,
        override_measurement: null,
        override_hours: null,
        override_gallons: null,
        override_supply_cost: null,
        override_total: null,
        override_description: null,
        raw_measurement: null,
        effective_measurement: null,
        raw_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        effective_total: null,
        notes: null,
      },
    ],
  })

  assert.equal(result.scopes.length, 1)
  assert.equal(result.scopes[0].effective_measurement, 60)
  assert.equal(result.room_totals.length, 1)
  assert.equal(result.room_totals[0].room_id, 'R001')
  assert.equal(result.room_totals[0].effective_area_sf, 60)
  assert.equal(result.missing_inputs.length, 0)
})

test('baseboard LF scopes deduct standard opening counts before overrides and clamp to zero', () => {
  const rooms = [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' as const }]
  const half = calculateTrim({ rooms, scopes: [makeTrimScope({ measurement_value: 12, baseboard_opening_count: 0.5 })] })
  const one = calculateTrim({ rooms, scopes: [makeTrimScope({ measurement_value: 12, baseboard_opening_count: 1 })] })
  const multiple = calculateTrim({ rooms, scopes: [makeTrimScope({ measurement_value: 12, baseboard_opening_count: 2 })] })
  const clamped = calculateTrim({ rooms, scopes: [makeTrimScope({ measurement_value: 4, baseboard_opening_count: 2 })] })
  const baseCode = calculateTrim({
    rooms,
    scopes: [
      makeTrimScope({
        scope_name: 'Base',
        trim_type_id: 'BASE_STD_LF',
        trim_family: 'BASE',
        measurement_value: 12,
        baseboard_opening_count: 1,
      }),
    ],
  })
  const overridden = calculateTrim({
    rooms,
    scopes: [makeTrimScope({ measurement_value: 12, baseboard_opening_count: 2, override_measurement: 11 })],
  })

  assert.equal(half.scopes[0].raw_measurement, 10.5)
  assert.equal(one.scopes[0].raw_measurement, 9)
  assert.equal(multiple.scopes[0].raw_measurement, 6)
  assert.equal(clamped.scopes[0].raw_measurement, 0)
  assert.equal(baseCode.scopes[0].raw_measurement, 9)
  assert.equal(overridden.scopes[0].effective_measurement, 11)
})

test('trim primer supply cost applies only for SPOT and FULL prime modes', () => {
  const rooms = [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' as const }]
  const catalogs = {
    supplies_rates: [{ key: 'PRIMER_TRIM', scope: 'Trim', unit: 'primer per scope', value: 5 }],
  }
  const none = calculateTrim({ rooms, catalogs, scopes: [makeTrimScope()] })
  const spot = calculateTrim({ rooms, catalogs, scopes: [makeTrimScope({ prime_mode: 'SPOT' })] })
  const full = calculateTrim({ rooms, catalogs, scopes: [makeTrimScope({ prime_mode: 'FULL' })] })

  assert.equal(none.scopes[0].raw_supply_cost, 4.8)
  assert.equal(spot.scopes[0].raw_supply_cost, 9.8)
  assert.equal(full.scopes[0].raw_supply_cost, 9.8)
})

test('condition_factor stacks with existing trim labor modifiers', () => {
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' }],
    scopes: [makeTrimScope({ prep_factor: 1.1, condition_factor: 1.25 })],
  })

  approx(result.scopes[0].raw_paint_hours, 1.1)
})

test('calculateTrim blocks helper mode for SEG rooms', () => {
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'SEG' }],
    scopes: [
      {
        id: 'S1',
        room_id: 'R001',
        position: 0,
        include: 'Y',
        scope_name: 'Baseboard',
        trim_type_id: 'BASE_STD',
        trim_family: 'BASEBOARD',
        unit_type: 'LF',
        measurement_mode: 'ROOM_HELPER',
        helper_source: 'ROOM_PERIMETER',
        measurement_value: null,
        helper_value: null,
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        paint_enabled: 'Y',
        prime_mode: 'NONE',
        spot_prime_percent: null,
        production_rate_id: null,
        prep_factor: null,
        height_factor: null,
        profile_factor: null,
        room_flag_factor: null,
        masking_factor: null,
        stair_factor: null,
        difficult_finish_factor: null,
        caulk_fill_factor: null,
        override_measurement: null,
        override_hours: null,
        override_gallons: null,
        override_supply_cost: null,
        override_total: null,
        override_description: null,
        raw_measurement: null,
        effective_measurement: null,
        raw_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        effective_total: null,
        notes: null,
      },
    ],
    catalogs: {
      trim_items: [
        {
          id: 'BASE_STD',
          family: 'BASEBOARD',
          default_unit_type: 'LF',
          helper_allowed: true,
          default_production_rate_id: null,
        },
      ],
    },
  })

  assert.ok(result.missing_inputs.length > 0)
  assert.match(result.missing_inputs[0].message, /room helper requires RECT mode/i)
})

test('calculateTrim ignores excluded trim scopes', () => {
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' }],
    scopes: [
      {
        id: 'S1',
        room_id: 'R001',
        position: 0,
        include: 'N',
        scope_name: 'Excluded Baseboard',
        trim_type_id: 'BASE_STD',
        trim_family: 'BASEBOARD',
        unit_type: 'LF',
        measurement_mode: 'MANUAL',
        helper_source: null,
        measurement_value: 60,
        helper_value: null,
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        paint_enabled: 'Y',
        prime_mode: 'NONE',
        spot_prime_percent: null,
        production_rate_id: null,
        prep_factor: null,
        height_factor: null,
        profile_factor: null,
        room_flag_factor: null,
        masking_factor: null,
        stair_factor: null,
        difficult_finish_factor: null,
        caulk_fill_factor: null,
        override_measurement: null,
        override_hours: null,
        override_gallons: null,
        override_supply_cost: null,
        override_total: null,
        override_description: null,
        raw_measurement: null,
        effective_measurement: null,
        raw_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        effective_total: null,
        notes: null,
      },
    ],
  })

  assert.equal(result.scopes.length, 1)
  assert.equal(result.scopes[0].include, 'N')
  assert.equal(result.room_totals[0].effective_area_sf, 0)
  assert.equal(result.room_totals[0].effective_total, 0)
  assert.equal(result.missing_inputs.length, 0)
})
