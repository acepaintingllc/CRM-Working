import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateWalls, type WallCalculationInput } from '../walls.ts'

function approx(actual: number | null | undefined, expected: number, epsilon = 0.0001) {
  assert.notEqual(actual, null)
  assert.ok(Math.abs((actual as number) - expected) <= epsilon, `expected ${expected}, got ${actual}`)
}

function makeWallScope(overrides: Partial<WallCalculationInput['scopes'][0]> = {}): WallCalculationInput['scopes'][0] {
  return {
    id: 'scope-decimal',
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: null,
    color_id: 'A',
    paint_product_id: null,
    primer_product_id: null,
    prime_mode: 'NONE',
    height_in: 96,
    perimeter_in: 600,
    standard_door_count: 0,
    standard_window_count: 0,
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
    ...overrides,
  }
}

test('wall deductions accept decimal door and window counts in RECT and SEG inputs', () => {
  const rect = calculateWalls({
    settings: { area_supply_cost_per_sf: 0, per_color_supply_cost: 0 },
    scopes: [makeWallScope({ standard_door_count: 0.5, standard_window_count: 1.5 })],
    segments: [],
  })
  approx(rect.scopes[0].raw_area_sf, 367)

  const seg = calculateWalls({
    settings: { area_supply_cost_per_sf: 0, per_color_supply_cost: 0 },
    scopes: [makeWallScope({ id: 'seg-scope', mode: 'SEG', standard_door_count: null, standard_window_count: null })],
    segments: [
      {
        id: 'seg-1',
        wall_scope_id: 'seg-scope',
        room_id: 'R001',
        position: 0,
        segment_name: null,
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 100,
        standard_door_count: 0.5,
        standard_window_count: 0.5,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  })
  approx(seg.scopes[0].raw_area_sf, 82)
})

test('missing wall pricing assumptions are reported instead of using hardcoded fallback rates', () => {
  const result = calculateWalls({
    settings: { area_supply_cost_per_sf: 0, per_color_supply_cost: 0 },
    scopes: [makeWallScope({ color_id: null })],
    segments: [],
  })

  const missingFields = result.missing_inputs.map((input) => input.field)
  assert.ok(missingFields.includes('labor_rate_per_hour'))
  assert.ok(missingFields.includes('paint_prod_rate_sqft_per_hour'))
  assert.ok(missingFields.includes('primer_prod_rate_sqft_per_hour'))
  assert.ok(missingFields.includes('paint_coverage_sqft_per_gal_per_coat'))
  assert.ok(missingFields.includes('primer_coverage_sqft_per_gal_per_coat'))
  assert.ok(missingFields.includes('paint_price_per_gal'))
  assert.ok(missingFields.includes('primer_price_per_gal'))
})

test('wall primer supply cost applies only for SPOT and FULL prime modes', () => {
  const catalogs = { supplies_rates: [{ key: 'PRIMER_WALL', scope: 'Walls', unit: 'primer per scope', value: 7 }] }
  const none = calculateWalls({ catalogs, scopes: [makeWallScope({ color_id: null })], segments: [] })
  const spot = calculateWalls({ catalogs, scopes: [makeWallScope({ color_id: null, prime_mode: 'SPOT' })], segments: [] })
  const full = calculateWalls({ catalogs, scopes: [makeWallScope({ color_id: null, prime_mode: 'FULL' })], segments: [] })

  approx(none.scopes[0].raw_supply_cost, 32)
  approx(spot.scopes[0].raw_supply_cost, 39)
  approx(full.scopes[0].raw_supply_cost, 39)
  approx(spot.scope_traces[0].supplies.primer_supply_cost, 7)
})

test('per-color catalog supply costs multiply only crew-flagged rows', () => {
  const result = calculateWalls({
    settings: { area_supply_cost_per_sf: 0, crew_size: 3 },
    catalogs: {
      supplies_rates: [
        {
          key: 'BRUSH_WALL',
          supply_group: 'per_color',
          scope: 'Walls',
          unit: 'each',
          value: 5,
          crew_multiplier: 'Y',
        },
        {
          key: 'TRAY_WALL',
          supply_group: 'per_color',
          scope: 'Walls',
          unit: 'each',
          value: 2,
          crew_multiplier: 'N',
        },
      ],
    },
    scopes: [makeWallScope()],
    segments: [],
  })

  assert.equal(result.per_color_supply_groups[0].total_shared_supply_cost, 17)
  assert.equal(result.per_color_supply_groups[0].allocations[0].allocated_supply_cost, 17)
})

test('per-color crew multiplier defaults to one crew member', () => {
  const result = calculateWalls({
    settings: { area_supply_cost_per_sf: 0 },
    catalogs: {
      supplies_rates: [
        {
          key: 'BRUSH_WALL',
          supply_group: 'per_color',
          scope: 'Walls',
          unit: 'each',
          value: 5,
          crew_multiplier: 'Y',
        },
      ],
    },
    scopes: [makeWallScope()],
    segments: [],
  })

  assert.equal(result.per_color_supply_groups[0].total_shared_supply_cost, 5)
})

test('condition_factor stacks with existing wall labor modifiers', () => {
  const result = calculateWalls({
    settings: {
      paint_prod_rate_sqft_per_hour: 100,
      paint_coats: 2,
      area_supply_cost_per_sf: 0,
      per_color_supply_cost: 0,
    },
    scopes: [makeWallScope({ height_factor: 1.2, condition_factor: 1.25 })],
    segments: [],
  })

  approx(result.scopes[0].raw_paint_hours, 12)
})

test('RECT scope calculates area, labor, gallons, supplies, and totals', () => {
  const input: WallCalculationInput = {
    settings: {
      labor_rate_per_hour: 50,
      paint_prod_rate_sqft_per_hour: 100,
      primer_prod_rate_sqft_per_hour: 200,
      paint_coverage_sqft_per_gal_per_coat: 200,
      primer_coverage_sqft_per_gal_per_coat: 100,
      paint_coats: 2,
      primer_coats: 1,
      area_supply_cost_per_sf: 0.1,
      per_color_supply_cost: 12,
      paint_price_per_gal: 10,
      primer_price_per_gal: 8,
      spot_prime_percent: 30,
    },
    scopes: [
      {
        id: 'scope-a',
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Main Walls',
        color_id: 'A',
        paint_product_id: 'P-WALL',
        primer_product_id: 'P-PRIMER',
        prime_mode: 'FULL',
        height_in: 96,
        perimeter_in: 600,
        standard_door_count: 1,
        standard_window_count: 1,
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
    raw_paint_material_cost: null,
    allocated_paint_gallons: null,
    allocated_paint_material_cost: null,
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

  const result = calculateWalls(input)
  const scope = result.scopes[0]
  approx(scope.raw_area_sf, 364)
  approx(scope.effective_area_sf, 364)
  approx(scope.raw_paint_hours, 7.28)
  approx(scope.raw_primer_hours, 1.82)
  approx(scope.raw_paint_gallons, 3.64)
  approx(scope.raw_primer_gallons, 3.64)
  approx(scope.allocated_paint_gallons, 4)
  approx(scope.allocated_paint_material_cost, 40)
  approx(scope.raw_supply_cost, 48.4)
  approx(scope.raw_total, 568.92)
  approx(scope.effective_total, 572.52)
  assert.equal(result.missing_inputs.length, 0)
  assert.equal(result.room_totals.length, 1)
  approx(result.room_totals[0].effective_total, 572.52)
})

test('wall scope preserves the raw paint label when catalog lookup misses', () => {
  const input: WallCalculationInput = {
    settings: {
      labor_rate_per_hour: 50,
      paint_prod_rate_sqft_per_hour: 100,
      primer_prod_rate_sqft_per_hour: 200,
      paint_coverage_sqft_per_gal_per_coat: 200,
      primer_coverage_sqft_per_gal_per_coat: 100,
      paint_coats: 2,
      primer_coats: 1,
      area_supply_cost_per_sf: 0.1,
      per_color_supply_cost: 12,
      paint_price_per_gal: 10,
      primer_price_per_gal: 8,
      spot_prime_percent: 30,
    },
    scopes: [
      {
        id: 'scope-a',
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Main Walls',
        color_id: null,
        paint_product_id: 'UNKNOWN-PAINT-ID',
        paint_product_label: 'SW SuperPaint Interior',
        primer_product_id: null,
        prime_mode: 'NONE',
        height_in: 96,
        perimeter_in: 480,
        standard_door_count: 0,
        standard_window_count: 0,
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
        raw_paint_material_cost: null,
        allocated_paint_gallons: null,
        allocated_paint_material_cost: null,
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
    catalogs: { paint_products: [] },
  }

  const result = calculateWalls(input)
  assert.equal(result.scopes[0]?.paint_product_label, 'SW SuperPaint Interior')
})

test('SEG scope applies segment and scope overrides and respects total override', () => {
  const input: WallCalculationInput = {
    settings: {
      labor_rate_per_hour: 60,
      paint_prod_rate_sqft_per_hour: 120,
      primer_prod_rate_sqft_per_hour: 180,
      paint_coverage_sqft_per_gal_per_coat: 300,
      primer_coverage_sqft_per_gal_per_coat: 250,
      paint_coats: 1,
      primer_coats: 1,
      spot_prime_percent: 25,
      area_supply_cost_per_sf: 0.05,
      per_color_supply_cost: 16,
      paint_price_per_gal: 45,
      primer_price_per_gal: 30,
    },
    scopes: [
      {
        id: 'scope-seg',
        room_id: 'R002',
        position: 0,
        mode: 'SEG',
        include: 'Y',
        scope_name: 'Accent',
        color_id: 'B',
        paint_product_id: 'P-WALL',
        primer_product_id: 'P-PRIMER',
        prime_mode: 'SPOT',
        height_in: null,
        perimeter_in: null,
        standard_door_count: null,
        standard_window_count: null,
        height_factor: 1,
        complexity_factor: 1.1,
        wall_flag_factor: 1,
        cut_in_top_factor: 1,
        cut_in_bottom_factor: 1,
        raw_area_sf: null,
        override_area_sf: 120,
        effective_area_sf: null,
        raw_paint_hours: null,
        override_paint_hours: 5,
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
        override_supply_cost: 30,
        effective_supply_cost: null,
        raw_total: null,
        override_total: 1000,
        effective_total: null,
        notes: null,
      },
    ],
    segments: [
      {
        id: 'seg-1',
        wall_scope_id: 'scope-seg',
        room_id: 'R002',
        position: 0,
        segment_name: 'North',
        include: 'Y',
        shape_type: 'RECTANGLE',
        quantity: 1,
        width_in: 120,
        height_in: 96,
        base_in: null,
        manual_area_sf: null,
        standard_door_count: 1,
        standard_window_count: 0,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
      {
        id: 'seg-2',
        wall_scope_id: 'scope-seg',
        room_id: 'R002',
        position: 1,
        segment_name: 'Manual',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 40,
        standard_door_count: 0,
        standard_window_count: 0,
        raw_area_sf: null,
        override_area_sf: 55,
        effective_area_sf: null,
        notes: null,
      },
    ],
  }

  const result = calculateWalls(input)
  const scope = result.scopes[0]
  approx(scope.raw_area_sf, 114)
  approx(scope.effective_area_sf, 120)
  approx(scope.effective_paint_hours, 5)
  approx(scope.effective_supply_cost, 30)
  approx(scope.effective_total, 1000)
  assert.equal(result.per_color_supply_groups.length, 1)
  assert.equal(result.missing_inputs.length, 0)
})

test('paint material groups round once per product and allocate cost proportionally', () => {
  const input: WallCalculationInput = {
    settings: {
      labor_rate_per_hour: 1,
      paint_prod_rate_sqft_per_hour: 100,
      primer_prod_rate_sqft_per_hour: 100,
      paint_coverage_sqft_per_gal_per_coat: 100,
      primer_coverage_sqft_per_gal_per_coat: 100,
      paint_coats: 1,
      primer_coats: 0,
      area_supply_cost_per_sf: 0,
      per_color_supply_cost: 0,
      paint_price_per_gal: 10,
      primer_price_per_gal: 0,
    },
    scopes: [
      {
        id: 'scope-a',
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'A',
        color_id: null,
        paint_product_id: 'PAINT-A',
        primer_product_id: null,
        prime_mode: 'NONE',
        height_in: 96,
        perimeter_in: 200,
        standard_door_count: 0,
        standard_window_count: 0,
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
        raw_paint_material_cost: null,
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
      {
        id: 'scope-b',
        room_id: 'R002',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'B',
        color_id: null,
        paint_product_id: 'PAINT-A',
        primer_product_id: null,
        prime_mode: 'NONE',
        height_in: 96,
        perimeter_in: 100,
        standard_door_count: 0,
        standard_window_count: 0,
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
        raw_paint_material_cost: null,
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

  const result = calculateWalls(input)
  assert.equal(result.paint_material_groups.length, 1)
  assert.equal(result.paint_material_groups[0].rounded_paint_gallons, 2)
  approx(result.paint_material_groups[0].total_paint_cost, 20)
  const allocated = result.scopes.reduce((sum, scope) => sum + (scope.allocated_paint_material_cost ?? 0), 0)
  approx(allocated, 20)
})

test('per-color supply references allocate shared cost by effective area', () => {
  const input: WallCalculationInput = {
    settings: {
      area_supply_cost_per_sf: 0,
      per_color_supply_cost: 20,
      paint_prod_rate_sqft_per_hour: 1000,
      primer_prod_rate_sqft_per_hour: 1000,
      paint_coverage_sqft_per_gal_per_coat: 500,
      primer_coverage_sqft_per_gal_per_coat: 500,
      labor_rate_per_hour: 1,
      paint_coats: 1,
      primer_coats: 1,
    },
    scopes: [
      {
        id: 'scope-1',
        room_id: 'R100',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: null,
        color_id: 'A',
        paint_product_id: 'W',
        primer_product_id: null,
        prime_mode: 'NONE',
        height_in: 120,
        perimeter_in: 360,
        standard_door_count: 0,
        standard_window_count: 0,
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
      {
        id: 'scope-2',
        room_id: 'R101',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: null,
        color_id: 'A',
        paint_product_id: 'W',
        primer_product_id: null,
        prime_mode: 'NONE',
        height_in: 120,
        perimeter_in: 120,
        standard_door_count: 0,
        standard_window_count: 0,
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

  const result = calculateWalls(input)
  assert.equal(result.per_color_supply_groups.length, 1)
  const group = result.per_color_supply_groups[0]
  approx(group.total_shared_supply_cost, 20)
  assert.equal(group.allocations.length, 2)
  const allocByScope = new Map(group.allocations.map((allocation) => [allocation.scope_id, allocation.allocated_supply_cost]))
  approx(allocByScope.get('scope-1') ?? null, 15)
  approx(allocByScope.get('scope-2') ?? null, 5)
})

test('missing inputs are reported for incomplete geometry', () => {
  const input: WallCalculationInput = {
    scopes: [
      {
        id: 'scope-missing',
        room_id: 'R900',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: null,
        color_id: null,
        paint_product_id: null,
        primer_product_id: null,
        prime_mode: 'NONE',
        height_in: null,
        perimeter_in: null,
        standard_door_count: 0,
        standard_window_count: 0,
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

  const result = calculateWalls(input)
  assert.ok(result.missing_inputs.length >= 2)
  assert.equal(result.required_inputs.scope_rect_required.includes('perimeter_in'), true)
  assert.equal(result.required_inputs.scope_rect_required.includes('height_in'), true)
})
