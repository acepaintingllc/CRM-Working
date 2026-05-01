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
        paint_enabled: 'N',
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

test('calculateTrim prices trim scope paint gallons from the selected paint product', () => {
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' }],
    scopes: [
      makeTrimScope({
        measurement_value: 50,
        paint_product_id: 'P-TRIM',
        paint_coats: 2,
        paint_coverage_units_per_gal_per_coat: 100,
      }),
    ],
    catalogs: {
      paint_products: [
        {
          id: 'P-TRIM',
          type: 'paint',
          label: 'SW Emerald Urethane',
          price_per_gal: 42,
          coverage_sqft_per_gal_per_coat: 100,
        },
      ],
    },
  })

  assert.equal(result.scopes[0]?.effective_paint_gallons, 1)
  assert.equal(result.scopes[0]?.raw_paint_material_cost, 42)
  assert.equal(result.scopes[0]?.allocated_paint_material_cost, 42)
  assert.equal(result.room_totals[0]?.effective_paint_material_cost, 42)
  assert.equal(result.paint_material_groups?.[0]?.total_paint_cost, 42)
})

test('missing trim pricing assumptions are reported and do not use hidden business fallback values', () => {
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' }],
    scopes: [makeTrimScope({ prime_mode: 'FULL' })],
    settings: { area_supply_cost_per_sf: 0, per_color_supply_cost: 0 },
  })

  const missingFields = result.missing_inputs.map((input) => input.field)
  assert.ok(missingFields.includes('labor_rate_per_hour'))
  assert.ok(missingFields.includes('paint_prod_rate_units_per_hour'))
  assert.ok(missingFields.includes('primer_prod_rate_units_per_hour'))
  assert.ok(missingFields.includes('paint_coverage_units_per_gal_per_coat'))
  assert.ok(missingFields.includes('primer_coverage_units_per_gal_per_coat'))
  assert.ok(missingFields.includes('paint_price_per_gal'))
  assert.ok(missingFields.includes('primer_price_per_gal'))
  assert.equal(result.scopes[0].raw_paint_hours, 0)
  assert.equal(result.scopes[0].raw_paint_gallons, 0)
  assert.equal(result.scopes[0].raw_total, 0)
})

test('trim primer assumptions are required only when primer is used', () => {
  const rooms = [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' as const }]
  const baseSettings = {
    labor_rate_per_hour: 50,
    paint_prod_rate_sqft_per_hour: 100,
    paint_coverage_sqft_per_gal_per_coat: 350,
    paint_coats: 2,
    paint_price_per_gal: 45,
    area_supply_cost_per_sf: 0,
    per_color_supply_cost: 0,
  }
  const none = calculateTrim({
    rooms,
    settings: baseSettings,
    scopes: [makeTrimScope({ prime_mode: 'NONE', primer_coats: null })],
  })
  assert.equal(none.missing_inputs.some((input) => input.field.includes('primer')), false)
  assert.equal(none.missing_inputs.some((input) => input.field === 'spot_prime_percent'), false)

  const spot = calculateTrim({
    rooms,
    settings: baseSettings,
    scopes: [makeTrimScope({ prime_mode: 'SPOT', primer_coats: null, spot_prime_percent: null })],
  })
  assert.equal(spot.missing_inputs.some((input) => input.field === 'primer_coats'), true)
  assert.equal(spot.missing_inputs.some((input) => input.field === 'spot_prime_percent'), true)
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

test('baseboard opening deduction uses configurable settings', () => {
  const rooms = [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' as const }]
  const result = calculateTrim({
    rooms,
    settings: { baseboard_opening_deduction_lf: 4 },
    scopes: [makeTrimScope({ measurement_value: 12, baseboard_opening_count: 2 })],
  })

  assert.equal(result.scopes[0].raw_measurement, 4)
})

test('trim primer supply cost applies only for SPOT and FULL prime modes', () => {
  const rooms = [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' as const }]
  const catalogs = {
    supplies_rates: [{ key: 'PRIMER_TRIM', scope: 'Trim', unit: 'primer per scope', value: 5 }],
  }
  const settings = { area_supply_cost_per_sf: 0.08, per_color_supply_cost: 0 }
  const none = calculateTrim({ rooms, catalogs, settings, scopes: [makeTrimScope()] })
  const spot = calculateTrim({ rooms, catalogs, settings, scopes: [makeTrimScope({ prime_mode: 'SPOT' })] })
  const full = calculateTrim({ rooms, catalogs, settings, scopes: [makeTrimScope({ prime_mode: 'FULL' })] })

  assert.equal(none.scopes[0].raw_supply_cost, 4.8)
  assert.equal(spot.scopes[0].raw_supply_cost, 9.8)
  assert.equal(full.scopes[0].raw_supply_cost, 9.8)
})

test('condition_factor stacks with existing trim labor modifiers', () => {
  const result = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 120, mode: 'RECT' }],
    scopes: [makeTrimScope({ prep_factor: 1.1, condition_factor: 1.25 })],
    settings: {
      paint_prod_rate_sqft_per_hour: 150,
      paint_coats: 2,
      paint_coverage_sqft_per_gal_per_coat: 350,
      labor_rate_per_hour: 60,
      paint_price_per_gal: 45,
    },
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
