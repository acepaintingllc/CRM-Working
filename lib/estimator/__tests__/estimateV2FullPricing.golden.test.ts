import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateCeilings, type CeilingCalculationInput } from '../ceilings.ts'
import { calculateDoors, type DoorCalculationInput } from '../doors.ts'
import { buildEstimatePricingSummary, buildEstimatePricingSummaryFromEngines } from '../pricingPolicies.ts'
import { calculateTrim, type TrimCalculationInput } from '../trim.ts'
import { calculateWalls, type WallCalculationInput } from '../walls.ts'
import {
  assertMoneyEqual,
  assertNoNegativeMoney,
  buildMixedFullPricingScenario,
} from './estimateV2ShippingFixtures.ts'

function approx(actual: number | null | undefined, expected: number, epsilon = 0.0001) {
  assert.notEqual(actual, null)
  assert.notEqual(actual, undefined)
  assert.ok(Math.abs((actual as number) - expected) <= epsilon, `expected ${expected}, got ${actual}`)
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

const SETTINGS = {
  labor_rate_per_hour: 10,
  paint_prod_rate_sqft_per_hour: 100,
  primer_prod_rate_sqft_per_hour: 50,
  paint_coverage_sqft_per_gal_per_coat: 100,
  primer_coverage_sqft_per_gal_per_coat: 50,
  paint_coats: 1,
  primer_coats: 1,
  spot_prime_percent: 50,
  area_supply_cost_per_sf: 0.1,
  per_color_supply_cost: 12,
  paint_price_per_gal: 20,
  primer_price_per_gal: 10,
  standard_door_deduction_sf: 20,
  standard_window_deduction_sf: 10,
}

const CATALOGS = {
  paint_products: [
    {
      id: 'WALL-PAINT',
      type: 'paint',
      label: 'Wall Paint',
      price_per_gal: 20,
      coverage_sqft_per_gal_per_coat: 100,
    },
    {
      id: 'CEILING-PAINT',
      type: 'paint',
      label: 'Ceiling Paint',
      price_per_gal: 18,
      coverage_sqft_per_gal_per_coat: 120,
    },
    {
      id: 'PRIMER',
      type: 'primer',
      label: 'Primer',
      price_per_gal: 10,
      coverage_sqft_per_gal_per_coat: 50,
    },
  ],
  supplies_rates: [
    { key: 'WALL_AREA', scope: 'Walls', unit: 'sqft', value: 0.1 },
    { key: 'WALL_COLOR', scope: 'Walls', unit: 'per color', value: 12 },
    { key: 'WALL_PRIMER', scope: 'Walls', unit: 'primer per scope', value: 3 },
    { key: 'CEILING_AREA', scope: 'Ceilings', unit: 'sqft', value: 0.08 },
    { key: 'CEILING_PRIMER', scope: 'Ceilings', unit: 'primer per scope', value: 4 },
    { key: 'TRIM_PRIMER', scope: 'Trim', unit: 'primer per scope', value: 2 },
  ],
}

function wallScope(overrides: Partial<WallCalculationInput['scopes'][0]> = {}): WallCalculationInput['scopes'][0] {
  return {
    id: 'wall-1',
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: null,
    color_id: 'WHITE',
    paint_product_id: 'WALL-PAINT',
    primer_product_id: 'PRIMER',
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

function ceilingScope(
  overrides: Partial<CeilingCalculationInput['scopes'][0]> = {}
): CeilingCalculationInput['scopes'][0] {
  return {
    id: 'ceiling-1',
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: null,
    area_sf: null,
    length_in: 120,
    width_in: 120,
    color_id: null,
    paint_product_id: 'CEILING-PAINT',
    primer_product_id: 'PRIMER',
    prime_mode: 'NONE',
    spot_prime_percent: null,
    ceiling_type_id: null,
    height_factor: 1,
    complexity_factor: 1,
    ceiling_flag_factor: 1,
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

function trimScope(overrides: Partial<TrimCalculationInput['scopes'][0]> = {}): TrimCalculationInput['scopes'][0] {
  return {
    id: 'trim-1',
    room_id: 'R001',
    position: 0,
    include: 'Y',
    scope_name: 'Baseboard',
    trim_type_id: 'BASEBOARD',
    trim_family: 'BASEBOARD',
    unit_type: 'LF',
    measurement_mode: 'MANUAL',
    helper_source: null,
    measurement_value: 40,
    helper_value: null,
    baseboard_opening_count: 0,
    color_id: null,
    paint_product_id: 'WALL-PAINT',
    primer_product_id: 'PRIMER',
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

function doorScope(overrides: Partial<DoorCalculationInput['scopes'][0]> = {}): DoorCalculationInput['scopes'][0] {
  return {
    id: 'door-1',
    room_id: 'R001',
    position: 0,
    include: 'Y',
    scope_name: 'Panel Door',
    door_type_id: 'PANEL',
    color_id: null,
    paint_product_id: 'WALL-PAINT',
    primer_product_id: 'PRIMER',
    prime_mode: 'NONE',
    quantity: 1,
    sides: 2,
    paint_coats: 1,
    primer_coats: 1,
    spot_prime_percent: null,
    condition_factor: 1,
    labor_rate: null,
    material_rate: null,
    raw_units: null,
    effective_units: null,
    raw_paint_hours: null,
    override_paint_hours: null,
    effective_paint_hours: null,
    raw_primer_hours: null,
    override_primer_hours: null,
    effective_primer_hours: null,
    raw_material_cost: null,
    override_material_cost: null,
    effective_material_cost: null,
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

test('full estimate golden path covers mixed rooms, grouped materials, policies, and room allocation', () => {
  const walls = calculateWalls({
    settings: SETTINGS,
    catalogs: CATALOGS,
    scopes: [
      wallScope({
        id: 'wall-living',
        room_id: 'R001',
        scope_name: 'Living walls',
        height_in: 120,
        perimeter_in: 480,
        standard_door_count: 1,
        standard_window_count: 2,
        prime_mode: 'SPOT',
        height_factor: 1.2,
        complexity_factor: 1.1,
        wall_flag_factor: 1.05,
      }),
      wallScope({
        id: 'wall-kitchen',
        room_id: 'R002',
        scope_name: 'Kitchen segmented walls',
        mode: 'SEG',
        color_id: 'BLUE',
        prime_mode: 'FULL',
        height_in: null,
        perimeter_in: null,
        standard_door_count: null,
        standard_window_count: null,
        override_area_sf: 175,
        override_supply_cost: 5,
      }),
      wallScope({
        id: 'wall-bedroom',
        room_id: 'R003',
        scope_name: 'Bedroom walls',
        height_in: 96,
        perimeter_in: 360,
      }),
    ],
    segments: [
      {
        id: 'kitchen-north-south',
        wall_scope_id: 'wall-kitchen',
        room_id: 'R002',
        position: 0,
        segment_name: 'North and south',
        include: 'Y',
        shape_type: 'RECTANGLE',
        quantity: 2,
        width_in: 100,
        height_in: 90,
        base_in: null,
        manual_area_sf: null,
        standard_door_count: 0.5,
        standard_window_count: 0,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
      {
        id: 'kitchen-gable',
        wall_scope_id: 'wall-kitchen',
        room_id: 'R002',
        position: 1,
        segment_name: 'Gable',
        include: 'Y',
        shape_type: 'TRIANGLE',
        quantity: 1,
        width_in: null,
        height_in: 72,
        base_in: 144,
        manual_area_sf: null,
        standard_door_count: 0,
        standard_window_count: 0,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
    ],
  })

  const ceilings = calculateCeilings({
    settings: SETTINGS,
    catalogs: {
      ...CATALOGS,
      ceiling_types: [{ id: 'VAULTED', labor_mult: 1.5 }],
    },
    scopes: [
      ceilingScope({
        id: 'ceiling-living',
        room_id: 'R001',
        scope_name: 'Living vaulted ceiling',
        area_sf: 200,
        length_in: null,
        width_in: null,
        ceiling_type_id: 'VAULTED',
        height_factor: 1.1,
      }),
      ceilingScope({
        id: 'ceiling-kitchen',
        room_id: 'R002',
        scope_name: 'Kitchen ceiling excluded',
        include: 'N',
        area_sf: 120,
        length_in: null,
        width_in: null,
      }),
      ceilingScope({
        id: 'ceiling-bedroom',
        room_id: 'R003',
        scope_name: 'Bedroom segmented ceiling',
        mode: 'SEG',
        length_in: null,
        width_in: null,
        prime_mode: 'FULL',
      }),
    ],
    segments: [
      {
        id: 'bedroom-main-ceiling',
        ceiling_scope_id: 'ceiling-bedroom',
        room_id: 'R003',
        position: 0,
        segment_name: 'Main',
        include: 'Y',
        shape_type: 'RECTANGLE',
        quantity: 1,
        width_in: 144,
        height_in: 120,
        base_in: null,
        manual_area_sf: null,
        raw_area_sf: null,
        override_area_sf: null,
        effective_area_sf: null,
        notes: null,
      },
      {
        id: 'bedroom-dormer-ceiling',
        ceiling_scope_id: 'ceiling-bedroom',
        room_id: 'R003',
        position: 1,
        segment_name: 'Dormer',
        include: 'Y',
        shape_type: 'MANUAL',
        quantity: 1,
        width_in: null,
        height_in: null,
        base_in: null,
        manual_area_sf: 30,
        raw_area_sf: null,
        override_area_sf: 40,
        effective_area_sf: null,
        notes: null,
      },
    ],
  })

  const trim = calculateTrim({
    rooms: [
      { room_id: 'R001', length_in: 180, width_in: 144, mode: 'RECT' },
      { room_id: 'R002', length_in: null, width_in: null, mode: 'SEG' },
      { room_id: 'R003', length_in: 144, width_in: 120, mode: 'RECT' },
    ],
    settings: { labor_rate_per_hour: SETTINGS.labor_rate_per_hour },
    catalogs: {
      ...CATALOGS,
      trim_items: [
        {
          id: 'BASEBOARD',
          family: 'BASEBOARD',
          default_unit_type: 'LF',
          helper_allowed: true,
          default_production_rate_id: 'BASE_RATE',
        },
        {
          id: 'DOOR',
          family: 'DOOR',
          default_unit_type: 'EA',
          helper_allowed: false,
          default_production_rate_id: 'DOOR_RATE',
        },
      ],
      production_rates: [
        { id: 'BASE_RATE', scope_id: 'BASEBOARD', units_per_hour: 40, prep_units_per_hour: null, primer_units_per_hour: 30 },
        { id: 'DOOR_RATE', scope_id: 'DOOR', units_per_hour: 3, prep_units_per_hour: null, primer_units_per_hour: 2 },
      ],
    },
    scopes: [
      trimScope({
        id: 'trim-living-base',
        room_id: 'R001',
        measurement_mode: 'ROOM_HELPER',
        helper_source: 'ROOM_PERIMETER',
        measurement_value: null,
        baseboard_opening_count: 2,
      }),
      trimScope({
        id: 'trim-kitchen-door',
        room_id: 'R002',
        scope_name: 'Kitchen doors',
        trim_type_id: 'DOOR',
        trim_family: 'DOOR',
        unit_type: 'EA',
        measurement_value: 3,
        prime_mode: 'FULL',
        prep_factor: 1.2,
        masking_factor: 1.1,
        override_hours: 2.5,
      }),
      trimScope({
        id: 'trim-bedroom-base',
        room_id: 'R003',
        measurement_mode: 'ROOM_HELPER',
        helper_source: 'ROOM_PERIMETER',
        measurement_value: null,
        baseboard_opening_count: 1.5,
        override_gallons: 0.75,
      }),
    ],
  })

  const doors = calculateDoors({
    settings: { labor_rate_per_hour: SETTINGS.labor_rate_per_hour },
    catalogs: {
      door_unit_rates: [
        {
          id: 'PANEL',
          label: 'Panel Door',
          unit_rate_type: 'interior',
          unit: 'door side',
          default_qty: 1,
          labor_rate: 0.5,
          material_rate: 5,
          amount: 0,
        },
      ],
    },
    scopes: [
      doorScope({
        id: 'door-kitchen-panel',
        room_id: 'R002',
        scope_name: 'Kitchen painted door',
        quantity: 2,
        sides: 2,
        prime_mode: 'FULL',
      }),
      doorScope({
        id: 'door-bedroom-excluded',
        room_id: 'R003',
        include: 'N',
        quantity: 3,
        sides: 2,
        override_total: 999,
      }),
    ],
  })

  assert.deepEqual(
    [walls.missing_inputs.length, ceilings.missing_inputs.length, trim.missing_inputs.length, doors.missing_inputs.length],
    [0, 0, 0, 0]
  )

  approx(walls.scopes.find((scope) => scope.id === 'wall-living')?.raw_area_sf, 360)
  approx(walls.scopes.find((scope) => scope.id === 'wall-kitchen')?.raw_area_sf, 151)
  approx(walls.scopes.find((scope) => scope.id === 'wall-kitchen')?.effective_area_sf, 175)
  approx(ceilings.scopes.find((scope) => scope.id === 'ceiling-kitchen')?.effective_total, 0)
  approx(trim.scopes.find((scope) => scope.id === 'trim-living-base')?.raw_measurement, 48)
  approx(trim.scopes.find((scope) => scope.id === 'trim-bedroom-base')?.raw_measurement, 39.5)
  approx(doors.scopes.find((scope) => scope.id === 'door-kitchen-panel')?.effective_units, 4)
  approx(doors.scopes.find((scope) => scope.id === 'door-kitchen-panel')?.effective_total, 60)
  approx(doors.scopes.find((scope) => scope.id === 'door-bedroom-excluded')?.effective_total, 0)

  const sharedWallPaint = walls.paint_material_groups.find((group) => group.group_key === 'WALL-PAINT')
  assert.ok(sharedWallPaint)
  assert.equal(sharedWallPaint.rounded_paint_gallons, 8)
  assert.deepEqual(
    sharedWallPaint.contributing_scopes.map((scope) => scope.scope_id),
    ['wall-living', 'wall-kitchen', 'wall-bedroom']
  )

  const pricing = buildEstimatePricingSummaryFromEngines(
    [
      { kind: 'walls', output: walls },
      { kind: 'ceilings', output: ceilings },
      { kind: 'trim', output: trim },
      { kind: 'doors', output: doors },
    ],
    { enabled: true, dayhours: 8, roundingIncrementHours: 4 },
    { enabled: true, amount: 1_500 },
    {
      paint_product_id: 'TRIM-WHITE',
      paint_product_label: 'Trim White',
      gallons: 1,
      quarts: 2,
      normalized_gallons: 1.5,
      paint_cost: 45,
    }
  )

  approx(pricing.rawLaborHours, 36.6042)
  assert.equal(pricing.effectiveLaborHours, 40)
  approx(pricing.laborAdjustmentHours, 3.3958)
  approx(pricing.wallPaintMaterialCost, 160)
  approx(pricing.ceilingPaintMaterialCost, 54)
  approx(pricing.trimPaintMaterialCost, 85)
  approx(pricing.paintMaterialCost, 299)
  approx(pricing.prePolicyTotal, 912.5)
  approx(pricing.postLaborPolicyTotal, 946.46)
  approx(pricing.minimumAdjustmentAmount, 553.54)
  approx(pricing.finalTotal, 1500)
  const allIncludedScopes = [...walls.scopes, ...ceilings.scopes, ...trim.scopes, ...doors.scopes].filter(
    (scope) => scope.include === 'Y'
  )
  const expectedPrimerMaterialCost = allIncludedScopes.reduce(
    (sum, scope) =>
      sum +
      (scope.effective_primer_gallons ?? 0) *
        ((scope as { primer_price_per_gal?: number | null }).primer_price_per_gal ?? 0),
    0
  )
  const expectedSupplyCost =
    allIncludedScopes.reduce((sum, scope) => sum + (scope.effective_supply_cost ?? 0), 0) +
    [...walls.per_color_supply_groups, ...ceilings.per_color_supply_groups, ...trim.per_color_supply_groups, ...doors.per_color_supply_groups].reduce(
      (sum, group) =>
        sum + group.allocations.reduce((groupSum, allocation) => groupSum + allocation.allocated_supply_cost, 0),
      0
    )

  approx(
    pricing.prePolicyTotal,
    pricing.rooms.reduce((sum, room) => sum + room.baseTotal, 0)
  )
  approx(pricing.paintMaterialCost, pricing.wallPaintMaterialCost + pricing.ceilingPaintMaterialCost + pricing.trimPaintMaterialCost)
  approx(pricing.primerMaterialCost, expectedPrimerMaterialCost)
  approx(pricing.supplyCost, expectedSupplyCost)
  approx(
    pricing.postLaborPolicyTotal,
    round2(pricing.prePolicyTotal + pricing.laborAdjustmentHours * SETTINGS.labor_rate_per_hour)
  )
  assert.deepEqual(
    pricing.rooms.map((room) => room.room_id),
    ['R001', 'R002', 'R003']
  )
  approx(
    pricing.rooms.reduce((sum, room) => sum + room.allocatedMinimumAdjustment, 0),
    pricing.minimumAdjustmentAmount
  )
  const roomFinalTotal = pricing.rooms.reduce((sum, room) => sum + room.finalTotal, 0)
  const laborAdjustmentCost = pricing.laborAdjustmentHours * SETTINGS.labor_rate_per_hour
  approx(roomFinalTotal + laborAdjustmentCost, pricing.finalTotal, 0.05)
})

test('zero-base minimum allocation distributes a policy floor without NaN room totals', () => {
  const walls = calculateWalls({
    settings: SETTINGS,
    scopes: [
      wallScope({ id: 'excluded-a', room_id: 'R001', include: 'N' }),
      wallScope({ id: 'excluded-b', room_id: 'R002', include: 'N' }),
      wallScope({ id: 'excluded-c', room_id: 'R003', include: 'N' }),
    ],
    segments: [],
  })
  const pricing = buildEstimatePricingSummary(
    [walls],
    { enabled: false, dayhours: 8, roundingIncrementHours: 4 },
    { enabled: true, amount: 300 }
  )

  assert.equal(pricing.prePolicyTotal, 0)
  assert.equal(pricing.minimumAdjustmentAmount, 300)
  assert.equal(pricing.finalTotal, 300)
  assert.deepEqual(
    pricing.rooms.map((room) => room.allocatedMinimumAdjustment),
    [100, 100, 100]
  )
  assert.ok(pricing.rooms.every((room) => Number.isFinite(room.finalTotal)))
})

test('shipping golden: mixed walls ceilings trim pricing buckets reconcile', () => {
  const { walls, ceilings, trim, pricing } = buildMixedFullPricingScenario()
  const engineRoomBase = round2(
    [...walls.room_totals, ...ceilings.room_totals, ...trim.room_totals].reduce(
      (sum, room) => sum + room.effective_total,
      0
    )
  )
  const laborAdjustmentCost = round2(pricing.laborAdjustmentHours * walls.assumptions.labor_rate_per_hour)

  assertNoNegativeMoney(pricing as unknown as Record<string, unknown>)
  assertMoneyEqual(pricing.prePolicyTotal, engineRoomBase, 'prePolicyTotal')
  assertMoneyEqual(pricing.postLaborPolicyTotal, pricing.prePolicyTotal + laborAdjustmentCost, 'postLaborPolicyTotal')
  assertMoneyEqual(pricing.finalTotal, pricing.postLaborPolicyTotal + pricing.minimumAdjustmentAmount, 'finalTotal')
  assertMoneyEqual(
    pricing.paintMaterialCost,
    pricing.wallPaintMaterialCost + pricing.ceilingPaintMaterialCost + pricing.trimPaintMaterialCost,
    'paintMaterialCost'
  )
})

test('shipping golden: future drywall and door engines contribute without paint bucket misclassification', () => {
  const { walls, ceilings, trim } = buildMixedFullPricingScenario()
  const drywall = {
    ...walls,
    scopes: [
      {
        ...walls.scopes[0],
        include: 'Y' as const,
        room_id: 'R001',
        effective_paint_hours: 2,
        effective_primer_hours: 0,
        effective_paint_gallons: 2,
        effective_primer_gallons: 0,
        effective_supply_cost: 18,
        allocated_paint_material_cost: 82,
        raw_paint_material_cost: 82,
      },
      {
        ...walls.scopes[0],
        include: 'N' as const,
        room_id: 'R002',
        effective_paint_hours: 99,
        effective_primer_hours: 99,
        effective_paint_gallons: 99,
        effective_primer_gallons: 99,
        effective_supply_cost: 99,
        allocated_paint_material_cost: 999,
        raw_paint_material_cost: 999,
      },
    ],
    room_totals: [{ ...walls.room_totals[0], room_id: 'R001', effective_total: 180 }],
    per_color_supply_groups: [],
  }
  const doors = {
    ...walls,
    scopes: [
      {
        ...walls.scopes[0],
        include: 'Y' as const,
        room_id: 'R002',
        effective_paint_hours: 1,
        effective_primer_hours: 0.5,
        effective_paint_gallons: 1,
        effective_primer_gallons: 0.25,
        effective_supply_cost: 9,
        allocated_paint_material_cost: 43,
        raw_paint_material_cost: 43,
      },
    ],
    room_totals: [{ ...walls.room_totals[0], room_id: 'R002', effective_total: 120 }],
    per_color_supply_groups: [],
  }
  const pricing = buildEstimatePricingSummaryFromEngines(
    [
      { kind: 'drywall', output: drywall },
      { kind: 'doors', output: doors },
      { kind: 'trim', output: trim },
      { kind: 'ceilings', output: ceilings },
      { kind: 'walls', output: walls },
    ],
    { enabled: false, dayhours: 8, roundingIncrementHours: 4 },
    { enabled: false, amount: 0 }
  )

  assertMoneyEqual(pricing.wallPaintMaterialCost, walls.scopes[0].allocated_paint_material_cost ?? 0, 'wall bucket')
  assertMoneyEqual(pricing.ceilingPaintMaterialCost, ceilings.scopes[0].allocated_paint_material_cost ?? 0, 'ceiling bucket')
  assertMoneyEqual(
    pricing.paintMaterialCost,
    pricing.wallPaintMaterialCost + pricing.ceilingPaintMaterialCost + pricing.trimPaintMaterialCost,
    'paint buckets exclude future engines until their customer-facing material policy is explicit'
  )
  assertMoneyEqual(
    pricing.prePolicyTotal,
    [...walls.room_totals, ...ceilings.room_totals, ...trim.room_totals, ...drywall.room_totals, ...doors.room_totals]
      .reduce((sum, room) => sum + room.effective_total, 0),
    'future scope room totals'
  )
})
