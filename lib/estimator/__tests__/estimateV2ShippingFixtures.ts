import assert from 'node:assert/strict'
import { calculateWalls, type WallCalculationInput } from '../walls.ts'
import { calculateCeilings, type CeilingCalculationInput } from '../ceilings.ts'
import { calculateTrim, type TrimCalculationInput } from '../trim.ts'
import { buildEstimatePricingSummaryFromEngines } from '../pricingPolicies.ts'

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function assertMoneyEqual(actual: number, expected: number, label: string) {
  assert.equal(round2(actual), round2(expected), `${label}: expected ${expected}, got ${actual}`)
}

export function assertNoNegativeMoney(summary: Record<string, unknown>) {
  for (const [key, value] of Object.entries(summary)) {
    if (typeof value === 'number') {
      assert.equal(Number.isFinite(value), true, `${key} should be finite`)
      assert.ok(value >= 0, `${key} should not be negative`)
    }
  }
}

export function buildSimpleWallsInput(): WallCalculationInput {
  return {
    settings: {
      labor_rate_per_hour: 50,
      paint_prod_rate_sqft_per_hour: 150,
      primer_prod_rate_sqft_per_hour: 200,
      paint_coverage_sqft_per_gal_per_coat: 350,
      primer_coverage_sqft_per_gal_per_coat: 300,
      paint_coats: 2,
      primer_coats: 1,
      area_supply_cost_per_sf: 0.08,
      per_color_supply_cost: 0,
      paint_price_per_gal: 42,
      primer_price_per_gal: 28,
    },
    scopes: [
      {
        id: 'wall-simple',
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Walls',
        color_id: 'COLOR1',
        paint_product_id: 'P-WALL',
        primer_product_id: 'P-PRIMER',
        prime_mode: 'FULL',
        height_in: 96,
        perimeter_in: 600,
        standard_door_count: 1,
        standard_window_count: 2,
        height_factor: 1,
        complexity_factor: 1,
        wall_flag_factor: 1,
        cut_in_top_factor: 1,
        cut_in_bottom_factor: 1,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        raw_paint_hours: null,
        override_paint_hours: null,
        effective_paint_hours: null,
        raw_primer_hours: null,
        override_primer_hours: null,
        effective_primer_hours: null,
        raw_paint_gallons: null,
        override_paint_gallons: null,
        effective_paint_gallons: null,
        raw_primer_gallons: null,
        override_primer_gallons: null,
        effective_primer_gallons: null,
        raw_supply_cost: null,
        override_supply_cost: null,
        effective_supply_cost: null,
        raw_total: null,
        override_total: null,
        effective_total: null,
        notes: null,
      },
    ],
    segments: [],
  }
}

export function buildMixedFullPricingScenario() {
  const walls = calculateWalls(buildSimpleWallsInput())
  const ceilings = calculateCeilings({
    settings: {
      labor_rate_per_hour: 50,
      paint_prod_rate_sqft_per_hour: 100,
      primer_prod_rate_sqft_per_hour: 200,
      paint_coverage_sqft_per_gal_per_coat: 300,
      primer_coverage_sqft_per_gal_per_coat: 300,
      paint_coats: 2,
      primer_coats: 1,
      area_supply_cost_per_sf: 0.05,
      per_color_supply_cost: 0,
      paint_price_per_gal: 35,
      primer_price_per_gal: 28,
    },
    scopes: [
      {
        id: 'ceiling-simple',
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Ceiling',
        color_id: 'COLOR1',
        paint_product_id: 'P-CEIL',
        primer_product_id: null,
        prime_mode: 'NONE',
        spot_prime_percent: null,
        ceiling_type_id: null,
        ceiling_geometry_mode: 'FLAT',
        vaulted_area_factor: null,
        tray_perimeter_in: null,
        tray_step_height_in: null,
        tray_band_width_in: null,
        coffer_section_length_in: null,
        coffer_section_width_in: null,
        coffer_section_count: null,
        coffer_face_height_in: null,
        coffer_bottom_width_in: null,
        helper_extra_area_sf: null,
        height_factor: 1,
        complexity_factor: 1,
        ceiling_flag_factor: 1,
        area_sf: 120,
        length_in: null,
        width_in: null,
        override_area_sf: null,
        override_paint_hours: null,
        override_primer_hours: null,
        override_paint_gallons: null,
        override_primer_gallons: null,
        override_supply_cost: null,
        override_total: null,
        raw_area_sf: null,
        effective_area_sf: null,
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
    segments: [],
  } satisfies CeilingCalculationInput)
  const trim = calculateTrim({
    rooms: [{ room_id: 'R001', length_in: 120, width_in: 144, mode: 'RECT' }],
    scopes: [
      {
        id: 'trim-base',
        room_id: 'R001',
        position: 0,
        include: 'Y',
        scope_name: 'Baseboard',
        trim_type_id: 'BASE',
        trim_family: 'BASE',
        unit_type: 'LF',
        measurement_mode: 'MANUAL',
        helper_source: null,
        measurement_value: 44,
        helper_value: null,
        baseboard_opening_count: null,
        color_id: 'COLOR1',
        paint_product_id: 'P-TRIM',
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
  } satisfies TrimCalculationInput)
  const pricing = buildEstimatePricingSummaryFromEngines(
    [
      { kind: 'walls', output: walls },
      { kind: 'ceilings', output: ceilings },
      { kind: 'trim', output: trim },
    ],
    { enabled: true, dayhours: 8, roundingIncrementHours: 4 },
    { enabled: true, amount: 500 }
  )
  return { walls, ceilings, trim, pricing }
}
