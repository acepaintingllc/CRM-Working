import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCeilings, type CeilingCalculationInput } from '../ceilings.ts'

function approx(actual: number | null, expected: number, epsilon = 0.0001) {
  assert.notEqual(actual, null)
  assert.ok(Math.abs((actual as number) - expected) <= epsilon, `expected ${expected}, got ${actual}`)
}

const BASE_SETTINGS = {
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
}

function makeScope(overrides: Partial<CeilingCalculationInput['scopes'][0]> = {}): CeilingCalculationInput['scopes'][0] {
  return {
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: 'Main Ceiling',
    color_id: null,
    paint_product_id: null,
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
    height_factor: null,
    complexity_factor: null,
    ceiling_flag_factor: null,
    area_sf: null,
    length_in: 144,  // 12 ft
    width_in: 144,   // 12 ft  → 144 sf
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
    ...overrides,
  }
}

test('RECT scope: area from L×W, prime_mode NONE, no modifier', () => {
  // 12ft × 12ft = 144in × 144in → (144 * 144) / 144 = 144 sf
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  const scope = result.scopes[0]

  approx(scope.raw_area_sf, 144)
  approx(scope.effective_area_sf, 144)
  // paint: (144 * 2 / 100) * 1 = 2.88 hrs
  approx(scope.raw_paint_hours, 2.88)
  // primer: NONE → 0
  approx(scope.raw_primer_hours, 0)
  approx(scope.effective_primer_hours, 0)
  // gallons: 144 * 2 / 200 = 1.44
  approx(scope.raw_paint_gallons, 1.44)
  approx(scope.raw_primer_gallons, 0)
  // supply: 144 * 0.1 = 14.4
  approx(scope.raw_supply_cost, 14.4)
  // total: labor + material + supply
  // labor = (2.88 + 0) * 50 = 144
  // material = 1.44 * 10 + 0 * 8 = 14.4
  // supply = 14.4
  approx(scope.raw_total, 172.8)
  approx(scope.effective_total, 178.4)
  assert.equal(result.missing_inputs.length, 0)
  assert.equal(result.room_totals.length, 1)
  approx(result.room_totals[0].effective_total, 178.4)
})

test('missing ceiling pricing assumptions are reported instead of using hardcoded fallback rates', () => {
  const result = calculateCeilings({
    settings: { area_supply_cost_per_sf: 0, per_color_supply_cost: 0 },
    scopes: [makeScope()],
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

test('ceiling primer supply cost applies only for SPOT and FULL prime modes', () => {
  const catalogs = {
    supplies_rates: [{ key: 'PRIMER_CEIL', scope: 'Ceilings', unit: 'primer per scope', value: 6 }],
  }
  const none = calculateCeilings({ catalogs, settings: BASE_SETTINGS, scopes: [makeScope()], segments: [] })
  const spot = calculateCeilings({
    catalogs,
    settings: BASE_SETTINGS,
    scopes: [makeScope({ prime_mode: 'SPOT' })],
    segments: [],
  })
  const full = calculateCeilings({
    catalogs,
    settings: BASE_SETTINGS,
    scopes: [makeScope({ prime_mode: 'FULL' })],
    segments: [],
  })

  approx(none.scopes[0].raw_supply_cost, 14.4)
  approx(spot.scopes[0].raw_supply_cost, 20.4)
  approx(full.scopes[0].raw_supply_cost, 20.4)
})

test('ceiling scope preserves the raw paint label when catalog lookup misses', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ paint_product_id: 'UNKNOWN-PAINT-ID', paint_product_label: 'SW Ceiling Paint', prime_mode: 'NONE' })],
    segments: [],
    catalogs: { paint_products: [] },
  }
  const result = calculateCeilings(input)
  assert.equal(result.scopes[0]?.paint_product_label, 'SW Ceiling Paint')
})

test('RECT scope: direct area_sf overrides L×W', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ area_sf: 200, length_in: null, width_in: null, prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  approx(result.scopes[0].raw_area_sf, 200)
  approx(result.scopes[0].effective_area_sf, 200)
})

test('RECT scope: override_area_sf replaces computed area', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ override_area_sf: 100, prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  approx(result.scopes[0].effective_area_sf, 100)
  // raw area still from L×W
  approx(result.scopes[0].raw_area_sf, 144)
})

test('prime_mode FULL: primer covers full area', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ prime_mode: 'FULL' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  // primer hours: (144 * 1 / 200) * 1 = 0.72
  approx(result.scopes[0].raw_primer_hours, 0.72)
  approx(result.scopes[0].raw_primer_gallons, 1.44)
})

test('prime_mode SPOT: primer covers spot_prime_percent of area', () => {
  const input: CeilingCalculationInput = {
    settings: { ...BASE_SETTINGS, spot_prime_percent: 50 },
    scopes: [makeScope({ prime_mode: 'SPOT' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  // primer area = 144 * 0.5 = 72 sf
  // primer hours: (72 * 1 / 200) * 1 = 0.36
  approx(result.scopes[0].raw_primer_hours, 0.36)
  approx(result.scopes[0].raw_primer_gallons, 0.72)
})

test('prime_mode SPOT: scope spot_prime_percent overrides settings and is clamped at 100', () => {
  const input: CeilingCalculationInput = {
    settings: { ...BASE_SETTINGS, spot_prime_percent: 25 },
    scopes: [makeScope({ prime_mode: 'SPOT', spot_prime_percent: 150 })],
    segments: [],
  }
  const result = calculateCeilings(input)
  // clamped to 100%, so primer should be same as FULL
  approx(result.scopes[0].raw_primer_hours, 0.72)
  approx(result.scopes[0].raw_primer_gallons, 1.44)
})

test('ceiling_type_id applies labor_mult from catalogs', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    catalogs: {
      ceiling_types: [{ id: 'vaulted', labor_mult: 1.5 }],
    },
    scopes: [makeScope({ ceiling_type_id: 'vaulted', prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  // paint hours: (144 * 2 / 100) * 1.5 = 4.32
  approx(result.scopes[0].raw_paint_hours, 4.32)
})

test('ceiling type area_factor increases area, gallons, materials, and area-based labor', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    catalogs: {
      ceiling_types: [{ id: 'vaulted', labor_mult: 1, area_factor: 1.25 }],
    },
    scopes: [makeScope({ ceiling_type_id: 'vaulted', prime_mode: 'NONE' })],
    segments: [],
  })

  approx(result.scopes[0].raw_area_sf, 180)
  approx(result.scopes[0].raw_paint_gallons, 1.8)
  approx(result.scopes[0].raw_paint_hours, 3.6)
})

test('vaulted helper area uses slope factor and labor multiplier remains labor-only', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    catalogs: {
      ceiling_types: [{ id: 'vaulted', labor_mult: 1.5, area_factor: 1 }],
    },
    scopes: [
      makeScope({
        ceiling_type_id: 'vaulted',
        ceiling_geometry_mode: 'VAULTED',
        vaulted_area_factor: 1.2,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  approx(result.scopes[0].helper_extra_area_sf ?? null, 28.8)
  approx(result.scopes[0].raw_area_sf, 172.8)
  approx(result.scopes[0].raw_paint_gallons, 1.728)
  approx(result.scopes[0].raw_paint_hours, 5.184)
})

test('vaulted direct area is treated as total ceiling sqft without applying slope factor again', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    scopes: [
      makeScope({
        ceiling_geometry_mode: 'VAULTED',
        area_sf: 220,
        vaulted_area_factor: 1.2,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  approx(result.scopes[0].helper_extra_area_sf ?? null, 0)
  approx(result.scopes[0].raw_area_sf, 220)
  approx(result.scopes[0].raw_paint_gallons, 2.2)
})

test('vaulted measured inputs calculate total ceiling sqft', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    scopes: [
      makeScope({
        ceiling_geometry_mode: 'VAULTED',
        vaulted_ridge_length_in: 180,
        vaulted_slope_length_in: 120,
        vaulted_plane_count: 2,
        vaulted_area_factor: 1.2,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  approx(result.scopes[0].helper_extra_area_sf ?? null, 0)
  approx(result.scopes[0].raw_area_sf, 300)
  approx(result.scopes[0].raw_paint_gallons, 3)
})

test('tray ceiling uses catalog area factor instead of geometry helper sqft', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    catalogs: {
      ceiling_types: [{ id: 'tray', labor_mult: 1, area_factor: 1.15 }],
    },
    scopes: [
      makeScope({
        ceiling_type_id: 'tray',
        ceiling_geometry_mode: 'TRAY',
        tray_perimeter_in: 480,
        tray_step_height_in: 12,
        tray_band_width_in: 18,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  approx(result.scopes[0].helper_extra_area_sf ?? null, 0)
  approx(result.scopes[0].raw_area_sf, 165.6)
})

test('tray geometry fields do not add ceiling helper sqft', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    scopes: [
      makeScope({
        ceiling_geometry_mode: 'TRAY',
        tray_perimeter_in: null,
        tray_step_height_in: 12,
        tray_band_width_in: 18,
        length_in: 120,
        width_in: 144,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  approx(result.scopes[0].helper_extra_area_sf ?? null, 0)
  approx(result.scopes[0].raw_area_sf, 120)
})

test('coffered helper calculates extra drywall sqft from section size and count', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    scopes: [
      makeScope({
        ceiling_geometry_mode: 'COFFERED',
        coffer_section_length_in: 48,
        coffer_section_width_in: 36,
        coffer_section_count: 6,
        coffer_face_height_in: 6,
        coffer_bottom_width_in: 4,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  approx(result.scopes[0].helper_extra_area_sf ?? null, 70)
  approx(result.scopes[0].raw_area_sf, 214)
})

test('override_area_sf wins over helper and area factor for effective area', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    catalogs: {
      ceiling_types: [{ id: 'vaulted', labor_mult: 1, area_factor: 1.25 }],
    },
    scopes: [
      makeScope({
        ceiling_type_id: 'vaulted',
        ceiling_geometry_mode: 'VAULTED',
        vaulted_area_factor: 1.2,
        override_area_sf: 100,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  })

  approx(result.scopes[0].raw_area_sf, 216)
  approx(result.scopes[0].effective_area_sf, 100)
  approx(result.scopes[0].raw_paint_gallons, 1)
})

test('height_factor multiplies labor', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ height_factor: 1.25, prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  // paint hours: (144 * 2 / 100) * 1.25 = 3.6
  approx(result.scopes[0].raw_paint_hours, 3.6)
})

test('ceiling_flag_factor multiplies labor', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ ceiling_flag_factor: 1.2, prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  // modifier = 1 * 1 * 1 * 1.2 = 1.2
  // paint hours: (144 * 2 / 100) * 1.2 = 3.456
  approx(result.scopes[0].raw_paint_hours, 3.456)
})

test('all modifiers combine multiplicatively', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    catalogs: { ceiling_types: [{ id: 'tray', labor_mult: 1.3 }] },
    scopes: [
      makeScope({
        ceiling_type_id: 'tray',
        height_factor: 1.1,
        complexity_factor: 1.2,
        ceiling_flag_factor: 1.0,
        condition_factor: 1.25,
        prime_mode: 'NONE',
      }),
    ],
    segments: [],
  }
  const result = calculateCeilings(input)
  // modifier = 1.3 * 1.1 * 1.2 * 1.0 * 1.25 = 2.145
  const modifier = 1.3 * 1.1 * 1.2 * 1.25
  approx(result.scopes[0].raw_paint_hours, (144 * 2 / 100) * modifier)
})

test('paint material groups round once per ceiling product and allocate cost proportionally', () => {
  const input: CeilingCalculationInput = {
    settings: {
      ...BASE_SETTINGS,
      paint_coats: 1,
      primer_coats: 0,
      paint_coverage_sqft_per_gal_per_coat: 50,
      paint_price_per_gal: 10,
    },
    scopes: [
      makeScope({ scope_name: 'C1', area_sf: 55, length_in: null, width_in: null, prime_mode: 'NONE', paint_product_id: 'PAINT-A' }),
      makeScope({ room_id: 'R002', scope_name: 'C2', area_sf: 55, length_in: null, width_in: null, prime_mode: 'NONE', paint_product_id: 'PAINT-A' }),
    ],
    segments: [],
  }
  const result = calculateCeilings(input)
  assert.equal(result.paint_material_groups.length, 1)
  assert.equal(result.paint_material_groups[0].rounded_paint_gallons, 3)
  approx(result.paint_material_groups[0].total_paint_cost, 30)
  const allocated = result.scopes.reduce((sum, scope) => sum + (scope.allocated_paint_material_cost ?? 0), 0)
  approx(allocated, 30)
})

test('include=N: all effective values are 0', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ include: 'N', prime_mode: 'FULL' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  const scope = result.scopes[0]
  assert.equal(scope.effective_area_sf, 0)
  assert.equal(scope.effective_paint_hours, 0)
  assert.equal(scope.effective_primer_hours, 0)
  assert.equal(scope.effective_paint_gallons, 0)
  assert.equal(scope.effective_primer_gallons, 0)
  assert.equal(scope.effective_supply_cost, 0)
  assert.equal(scope.effective_total, 0)
  assert.equal(result.room_totals[0].effective_total, 0)
})

test('override_paint_hours replaces calculated hours', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ override_paint_hours: 5.0, prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  approx(result.scopes[0].raw_paint_hours, 2.88)
  approx(result.scopes[0].effective_paint_hours, 5.0)
})

test('override_total replaces computed total', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ override_total: 999, prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  approx(result.scopes[0].effective_total, 999)
  // raw_total is still the calculated value
  approx(result.scopes[0].raw_total, 172.8)
})

test('override_supply_cost replaces calculated supply', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ override_supply_cost: 50, prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  approx(result.scopes[0].raw_supply_cost, 14.4)
  approx(result.scopes[0].effective_supply_cost, 50)
})

test('missing L×W in RECT mode produces missing_inputs', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [makeScope({ length_in: null, width_in: null, area_sf: null, prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  assert.ok(result.missing_inputs.length >= 2)
  assert.ok(result.missing_inputs.some((m) => m.field === 'length_in'))
  assert.ok(result.missing_inputs.some((m) => m.field === 'width_in'))
})

test('no scopes: empty output', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [],
    segments: [],
  }
  const result = calculateCeilings(input)
  assert.equal(result.scopes.length, 0)
  assert.equal(result.room_totals.length, 0)
  assert.equal(result.missing_inputs.length, 0)
})

test('SEG mode: sums included segment areas', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [
      {
        ...makeScope({ mode: 'SEG', prime_mode: 'NONE', length_in: null, width_in: null }),
        id: 'scope-seg-1',
      },
    ],
    segments: [
      {
        id: 'seg-1',
        ceiling_scope_id: 'scope-seg-1',
        room_id: 'R001',
        position: 0,
        segment_name: 'Main',
        include: 'Y',
        shape_type: 'RECTANGLE',
        quantity: 1,
        width_in: 120,   // 10 ft
        height_in: 144,  // 12 ft → 10*12 = 120 sf
        base_in: null,
        manual_area_sf: null,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
      {
        id: 'seg-2',
        ceiling_scope_id: 'scope-seg-1',
        room_id: 'R001',
        position: 1,
        segment_name: 'Alcove',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 24,  // 24 sf directly
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  }
  const result = calculateCeilings(input)
  // RECTANGLE: (120 * 144 * 1) / 144 = 120 sf
  // MANUAL: 24 sf
  // total: 144 sf
  approx(result.scopes[0].effective_area_sf, 144)
  assert.equal(result.missing_inputs.length, 0)
})

test('SEG mode: prices as flat even if older saved data has a non-flat ceiling type', () => {
  const result = calculateCeilings({
    settings: BASE_SETTINGS,
    catalogs: {
      ceiling_types: [{ id: 'coffered', labor_mult: 1.5, area_factor: 1.25 }],
    },
    scopes: [
      {
        ...makeScope({
          mode: 'SEG',
          prime_mode: 'NONE',
          length_in: null,
          width_in: null,
          ceiling_type_id: 'coffered',
          ceiling_geometry_mode: 'COFFERED',
          coffer_section_length_in: 48,
          coffer_section_width_in: 36,
          coffer_section_count: 6,
          coffer_face_height_in: 6,
          coffer_bottom_width_in: 4,
        }),
        id: 'scope-seg-flat-only',
      },
    ],
    segments: [
      {
        id: 'seg-flat-only',
        ceiling_scope_id: 'scope-seg-flat-only',
        room_id: 'R001',
        position: 0,
        segment_name: 'Manual segment',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 100,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  })

  approx(result.scopes[0].helper_extra_area_sf ?? null, 0)
  approx(result.scopes[0].raw_area_sf, 100)
  approx(result.scopes[0].raw_paint_hours, 2)
})

test('SEG mode: excluded segment not included in area', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [
      {
        ...makeScope({ mode: 'SEG', prime_mode: 'NONE', length_in: null, width_in: null }),
        id: 'scope-seg-2',
      },
    ],
    segments: [
      {
        id: 'seg-a',
        ceiling_scope_id: 'scope-seg-2',
        room_id: 'R001',
        position: 0,
        segment_name: 'Included',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 100,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
      {
        id: 'seg-b',
        ceiling_scope_id: 'scope-seg-2',
        room_id: 'R001',
        position: 1,
        segment_name: 'Excluded',
        include: 'N',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 50,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  }
  const result = calculateCeilings(input)
  approx(result.scopes[0].effective_area_sf, 100)
})

test('SEG mode: no included segments produces missing_input', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [
      {
        ...makeScope({ mode: 'SEG', prime_mode: 'NONE', length_in: null, width_in: null }),
        id: 'scope-seg-3',
      },
    ],
    segments: [
      {
        id: 'seg-x',
        ceiling_scope_id: 'scope-seg-3',
        room_id: 'R001',
        position: 0,
        segment_name: 'Excluded',
        include: 'N',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 100,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  }
  const result = calculateCeilings(input)
  assert.ok(result.missing_inputs.some((m) => m.field === 'ceiling_segments'))
})

test('SEG mode: TRIANGLE segment area calculated correctly', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [
      {
        ...makeScope({ mode: 'SEG', prime_mode: 'NONE', length_in: null, width_in: null }),
        id: 'scope-tri',
      },
    ],
    segments: [
      {
        id: 'seg-tri',
        ceiling_scope_id: 'scope-tri',
        room_id: 'R001',
        position: 0,
        segment_name: 'Triangle section',
        include: 'Y',
        shape_type: 'TRIANGLE',
        quantity: 1,
        width_in: null,
        height_in: 96,   // 8 ft
        base_in: 144,    // 12 ft → area = (144 * 96) / 2 / 144 = 48 sf
        manual_area_sf: null,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  }
  const result = calculateCeilings(input)
  approx(result.scopes[0].effective_area_sf, 48)
})

test('SEG mode: segment override_area_sf affects scope effective area', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [
      {
        ...makeScope({ mode: 'SEG', prime_mode: 'NONE', length_in: null, width_in: null }),
        id: 'scope-override-seg',
      },
    ],
    segments: [
      {
        id: 'seg-override',
        ceiling_scope_id: 'scope-override-seg',
        room_id: 'R001',
        position: 0,
        segment_name: 'Manual with override',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 10,
        raw_area_sf: null,
        override_area_sf: 30,
        effective_area_sf: null,
        notes: null,
      },
      {
        id: 'seg-normal',
        ceiling_scope_id: 'scope-override-seg',
        room_id: 'R001',
        position: 1,
        segment_name: 'Manual standard',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 20,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  }
  const result = calculateCeilings(input)
  approx(result.scopes[0].effective_area_sf, 50)
  approx(result.segments[0].raw_area_sf, 10)
  approx(result.segments[0].effective_area_sf, 30)
})

test('per-color supply grouped across two scopes sharing a color', () => {
  const scopeBase = {
    prime_mode: 'NONE' as const,
    color_id: 'BLUE',
    paint_product_id: 'PAINT-A',
    primer_product_id: null,
  }
  const input: CeilingCalculationInput = {
    settings: { ...BASE_SETTINGS, per_color_supply_cost: 20 },
    scopes: [
      { ...makeScope(scopeBase), id: 'scope-c1', room_id: 'R001', position: 0 },
      { ...makeScope(scopeBase), id: 'scope-c2', room_id: 'R002', position: 0 },
    ],
    segments: [],
  }
  const result = calculateCeilings(input)
  // Each scope has 144 sf → equal split → each gets $10 allocated color supply
  assert.equal(result.per_color_supply_groups.length, 1)
  const group = result.per_color_supply_groups[0]
  assert.equal(group.scope_count, 2)
  approx(group.total_shared_supply_cost, 20)
  const alloc0 = group.allocations[0].allocated_supply_cost
  const alloc1 = group.allocations[1].allocated_supply_cost
  approx(alloc0, 10)
  approx(alloc1, 10)
  approx(alloc0 + alloc1, 20)
})

test('room_totals aggregates multiple scopes in same room', () => {
  // Two SEG scopes sharing a room — use segments as the area source for SEG mode
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [
      makeScope({ room_id: 'R001', position: 0, mode: 'SEG', prime_mode: 'NONE', length_in: null, width_in: null, id: 'sc1' }),
      makeScope({ room_id: 'R001', position: 1, mode: 'SEG', prime_mode: 'NONE', length_in: null, width_in: null, id: 'sc2' }),
    ],
    segments: [
      {
        id: 'seg-r1', ceiling_scope_id: 'sc1', room_id: 'R001', position: 0,
        segment_name: 'A', include: 'Y', shape_type: 'MANUAL', quantity: 1,
        width_in: null, height_in: null, base_in: null, manual_area_sf: 100,
        raw_area_sf: null, override_area_sf: null, effective_area_sf: null, notes: null,
      },
      {
        id: 'seg-r2', ceiling_scope_id: 'sc2', room_id: 'R001', position: 0,
        segment_name: 'B', include: 'Y', shape_type: 'MANUAL', quantity: 1,
        width_in: null, height_in: null, base_in: null, manual_area_sf: 50,
        raw_area_sf: null, override_area_sf: null, effective_area_sf: null, notes: null,
      },
    ],
  }
  const result = calculateCeilings(input)
  assert.equal(result.room_totals.length, 1)
  approx(result.room_totals[0].effective_area_sf, 150)
})

test('room_totals splits correctly across two rooms', () => {
  const input: CeilingCalculationInput = {
    settings: BASE_SETTINGS,
    scopes: [
      makeScope({ room_id: 'R001', position: 0, prime_mode: 'NONE', area_sf: 100, length_in: null, width_in: null }),
      makeScope({ room_id: 'R002', position: 0, prime_mode: 'NONE', area_sf: 60, length_in: null, width_in: null }),
    ],
    segments: [],
  }
  const result = calculateCeilings(input)
  assert.equal(result.room_totals.length, 2)
  const r001 = result.room_totals.find((r) => r.room_id === 'R001')
  const r002 = result.room_totals.find((r) => r.room_id === 'R002')
  approx(r001!.effective_area_sf, 100)
  approx(r002!.effective_area_sf, 60)
})

test('ceiling-scoped supply rate from catalogs is used', () => {
  const input: CeilingCalculationInput = {
    settings: { ...BASE_SETTINGS, area_supply_cost_per_sf: undefined },
    catalogs: {
      supplies_rates: [
        { key: 'MISC_CEIL', scope: 'Ceilings', unit: 'sqft', value: 0.07 },
        { key: 'MISC_WALL', scope: 'Walls', unit: 'sqft', value: 0.08 },
      ],
    },
    scopes: [makeScope({ prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  // Should use 0.07 (ceiling rate) not 0.08 (wall rate)
  // 144 sf * 0.07 = 10.08
  approx(result.scopes[0].raw_supply_cost, 10.08)
})

test('falls back to wall area supply rate when no ceiling-scoped rate exists', () => {
  const input: CeilingCalculationInput = {
    settings: { ...BASE_SETTINGS, area_supply_cost_per_sf: undefined },
    catalogs: {
      supplies_rates: [{ key: 'MISC_WALL', scope: 'Walls', unit: 'sqft', value: 0.08 }],
    },
    scopes: [makeScope({ prime_mode: 'NONE' })],
    segments: [],
  }
  const result = calculateCeilings(input)
  // resolveSettings uses wall-scoped area rate fallback, then ceilings uses that base
  // 144 sf * 0.08 = 11.52
  approx(result.scopes[0].raw_supply_cost, 11.52)
})
