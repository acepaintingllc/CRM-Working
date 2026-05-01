import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyLaborDayPolicy,
  applyJobMinimum,
  allocateMinimumAdjustment,
  buildEstimatePricingSummary,
  buildEstimatePricingSummaryFromEngines,
  buildPerJobSupplyCost,
  reconcileWholeDollarRows,
  type LaborDayPolicySettings,
  type JobMinimumSettings,
} from '../pricingPolicies.ts'
import type { WallCalculationOutput } from '../wallsTypes.ts'

const POLICY_8H_HALF_DAY: LaborDayPolicySettings = {
  enabled: true,
  dayhours: 8,
  roundingIncrementHours: 4, // 0.5-day steps
}

const POLICY_DISABLED: LaborDayPolicySettings = {
  enabled: false,
  dayhours: 8,
  roundingIncrementHours: 4,
}

const MIN_DISABLED: JobMinimumSettings = { enabled: false, amount: 500 }
const MIN_500: JobMinimumSettings = { enabled: true, amount: 500 }

// ─── applyLaborDayPolicy ──────────────────────────────────────────────────────

test('applyLaborDayPolicy: under 1 day → bumps to exactly 1 day', () => {
  // 0.5 days (4h) → 1 day (8h)
  const result = applyLaborDayPolicy(4, POLICY_8H_HALF_DAY)
  assert.equal(result.effectiveHours, 8)
  assert.equal(result.effectiveDays, 1)
  assert.equal(result.adjustmentHours, 4)
})

test('applyLaborDayPolicy: 0.9 days (7.2h) → 1 day', () => {
  const result = applyLaborDayPolicy(7.2, POLICY_8H_HALF_DAY)
  assert.equal(result.effectiveHours, 8)
  assert.equal(result.effectiveDays, 1)
})

test('applyLaborDayPolicy: exactly 1 day stays at 1 day (no overshoot)', () => {
  const result = applyLaborDayPolicy(8, POLICY_8H_HALF_DAY)
  assert.equal(result.effectiveHours, 8)
  assert.equal(result.effectiveDays, 1)
  assert.equal(result.adjustmentHours, 0)
})

test('applyLaborDayPolicy: 2.2 days (17.6h) → 2.5 days (20h)', () => {
  const result = applyLaborDayPolicy(17.6, POLICY_8H_HALF_DAY)
  assert.equal(result.effectiveHours, 20)
  assert.equal(result.effectiveDays, 2.5)
})

test('applyLaborDayPolicy: 2.7 days (21.6h) → 3 days (24h)', () => {
  const result = applyLaborDayPolicy(21.6, POLICY_8H_HALF_DAY)
  assert.equal(result.effectiveHours, 24)
  assert.equal(result.effectiveDays, 3)
})

test('applyLaborDayPolicy: exactly 3.0 days (24h) → stays 3.0 (no overshoot)', () => {
  const result = applyLaborDayPolicy(24, POLICY_8H_HALF_DAY)
  assert.equal(result.effectiveHours, 24)
  assert.equal(result.effectiveDays, 3)
  assert.equal(result.adjustmentHours, 0)
})

test('applyLaborDayPolicy: policy disabled → raw hours pass through unchanged', () => {
  const result = applyLaborDayPolicy(7.2, POLICY_DISABLED)
  assert.equal(result.effectiveHours, 7.2)
  assert.equal(result.effectiveDays, 0.9)
  assert.equal(result.adjustmentHours, 0)
})

test('applyLaborDayPolicy: 12h already on 4h boundary → no adjustment', () => {
  const result = applyLaborDayPolicy(12, POLICY_8H_HALF_DAY)
  assert.equal(result.rawHours, 12)
  assert.equal(result.rawDays, 1.5)
  assert.equal(result.effectiveHours, 12)
  assert.equal(result.adjustmentHours, 0)
})

// ─── applyJobMinimum ──────────────────────────────────────────────────────────

test('applyJobMinimum: disabled → no adjustment regardless of subtotal', () => {
  const result = applyJobMinimum(200, MIN_DISABLED)
  assert.equal(result.adjustmentAmount, 0)
  assert.equal(result.finalTotal, 200)
})

test('applyJobMinimum: subtotal below minimum → fills the gap', () => {
  const result = applyJobMinimum(350, MIN_500)
  assert.equal(result.adjustmentAmount, 150)
  assert.equal(result.finalTotal, 500)
})

test('applyJobMinimum: subtotal exactly at minimum → no adjustment', () => {
  const result = applyJobMinimum(500, MIN_500)
  assert.equal(result.adjustmentAmount, 0)
  assert.equal(result.finalTotal, 500)
})

test('applyJobMinimum: subtotal above minimum → no adjustment', () => {
  const result = applyJobMinimum(750, MIN_500)
  assert.equal(result.adjustmentAmount, 0)
  assert.equal(result.finalTotal, 750)
})

test('applyJobMinimum: zero subtotal with minimum → full minimum as adjustment', () => {
  const result = applyJobMinimum(0, MIN_500)
  assert.equal(result.adjustmentAmount, 500)
  assert.equal(result.finalTotal, 500)
})

// ─── allocateMinimumAdjustment ────────────────────────────────────────────────

test('allocateMinimumAdjustment: zero adjustment → all rooms get zero allocation', () => {
  const rooms = [
    { room_id: 'R001', baseTotal: 300 },
    { room_id: 'R002', baseTotal: 200 },
  ]
  const result = allocateMinimumAdjustment(rooms, 0)
  assert.equal(result[0].allocatedMinimumAdjustment, 0)
  assert.equal(result[1].allocatedMinimumAdjustment, 0)
  assert.equal(result[0].finalTotal, 300)
  assert.equal(result[1].finalTotal, 200)
})

test('allocateMinimumAdjustment: proportional allocation by room share', () => {
  const rooms = [
    { room_id: 'R001', baseTotal: 300 }, // 60% of total
    { room_id: 'R002', baseTotal: 200 }, // 40% of total
  ]
  const result = allocateMinimumAdjustment(rooms, 100)
  assert.equal(result[0].allocatedMinimumAdjustment, 60)
  assert.equal(result[1].allocatedMinimumAdjustment, 40)
  assert.equal(result[0].finalTotal, 360)
  assert.equal(result[1].finalTotal, 240)
})

test('allocateMinimumAdjustment: allocations sum to total adjustment (odd number)', () => {
  const rooms = [
    { room_id: 'R001', baseTotal: 150 },
    { room_id: 'R002', baseTotal: 100 },
    { room_id: 'R003', baseTotal: 250 },
  ]
  const adjustment = 73.33
  const result = allocateMinimumAdjustment(rooms, adjustment)
  const totalAllocated = result.reduce((sum, r) => sum + r.allocatedMinimumAdjustment, 0)
  assert.ok(Math.abs(totalAllocated - adjustment) < 0.02, `allocation sum ${totalAllocated} should be within 0.02 of ${adjustment}`)
})

test('allocateMinimumAdjustment: single room gets full adjustment', () => {
  const rooms = [{ room_id: 'R001', baseTotal: 400 }]
  const result = allocateMinimumAdjustment(rooms, 100)
  assert.equal(result[0].allocatedMinimumAdjustment, 100)
  assert.equal(result[0].finalTotal, 500)
})

test('reconcileWholeDollarRows: rounds visible rows to whole dollars and preserves total', () => {
  const rows = [
    { id: 'A', price: 929.8 },
    { id: 'B', price: 168.1 },
    { id: 'C', price: 60.35 },
  ]
  const reconciled = reconcileWholeDollarRows(rows, 1158.25)
  assert.deepEqual(
    reconciled.map((row) => row.price),
    [930, 168, 60]
  )
  assert.equal(reconciled.reduce((sum, row) => sum + row.price, 0), 1158)
})

test('reconcileWholeDollarRows: never drops a row below its raw whole-dollar floor', () => {
  const rows = [
    { id: 'walls', price: 1205.42 },
    { id: 'ceilings', price: 202.36 },
  ]
  const reconciled = reconcileWholeDollarRows(rows, 1407.78)
  assert.equal(reconciled.reduce((sum, row) => sum + row.price, 0), 1408)
  assert.ok((reconciled.find((row) => row.id === 'ceilings')?.price ?? 0) >= 202)
  assert.ok((reconciled.find((row) => row.id === 'walls')?.price ?? 0) >= 1205)
})

test('reconcileWholeDollarRows: preserves rounded totals across fractional boundaries', () => {
  const cases = [
    {
      rows: [
        { id: 'A', price: 10.49 },
        { id: 'B', price: 10.49 },
      ],
      target: 20.98,
    },
    {
      rows: [
        { id: 'A', price: 10.5 },
        { id: 'B', price: 10.5 },
        { id: 'C', price: 10.5 },
      ],
      target: 31.5,
    },
    {
      rows: [
        { id: 'A', price: 0.01 },
        { id: 'B', price: 999.99 },
      ],
      target: 1000,
    },
  ]

  for (const c of cases) {
    const reconciled = reconcileWholeDollarRows(c.rows, c.target)
    assert.equal(
      reconciled.reduce((sum, row) => sum + row.price, 0),
      Math.round(c.target)
    )
    for (const row of reconciled) {
      assert.equal(Number.isInteger(row.price), true)
    }
  }
})

// ─── buildEstimatePricingSummary ─────────────────────────────────────────────

function makeScope(
  room_id: string,
  paintHours: number,
  primerHours: number,
  paintGals: number,
  primerGals: number,
  supplyCost: number
) {
  return {
    room_id,
    position: 0,
    mode: 'RECT' as const,
    include: 'Y' as const,
    scope_name: null,
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    prime_mode: 'NONE' as const,
    height_in: null,
    perimeter_in: null,
    standard_door_count: null,
    standard_window_count: null,
    height_factor: null,
    complexity_factor: null,
    wall_flag_factor: null,
    cut_in_top_factor: null,
    cut_in_bottom_factor: null,
    raw_area_sf: null,
    override_area_sf: null,
    effective_area_sf: 100,
    raw_paint_hours: paintHours,
    override_paint_hours: null,
    effective_paint_hours: paintHours,
    raw_primer_hours: primerHours,
    override_primer_hours: null,
    effective_primer_hours: primerHours,
    raw_paint_gallons: paintGals,
    override_paint_gallons: null,
    effective_paint_gallons: paintGals,
    allocated_paint_gallons: paintGals,
    allocated_paint_material_cost: paintGals * 50,
    raw_paint_material_cost: paintGals * 50,
    raw_primer_gallons: primerGals,
    override_primer_gallons: null,
    effective_primer_gallons: primerGals,
    raw_supply_cost: supplyCost,
    override_supply_cost: null,
    effective_supply_cost: supplyCost,
    raw_total: null,
    override_total: null,
    effective_total: null,
    notes: null,
    paint_price_per_gal: 50,
    primer_price_per_gal: 30,
  }
}

const mockAssumptions: WallCalculationOutput['assumptions'] = {
  labor_rate_per_hour: 40,
  paint_prod_rate_sqft_per_hour: 150,
  primer_prod_rate_sqft_per_hour: 180,
  paint_coverage_sqft_per_gal_per_coat: 350,
  primer_coverage_sqft_per_gal_per_coat: 300,
  paint_coats: 2,
  primer_coats: 1,
  spot_prime_percent: 30,
  area_supply_cost_per_sf: 0.08,
  per_color_supply_cost: 20,
  paint_price_per_gal: 50,
  primer_price_per_gal: 30,
  standard_door_deduction_sf: 21,
  standard_window_deduction_sf: 15,
  baseboard_opening_deduction_lf: 3,
  crew_size: 1,
}

const mockOutput: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
  scopes: [
    makeScope('R001', 4, 1, 2, 0.5, 20), // 5h labor
    makeScope('R002', 2, 0.5, 1, 0.25, 10), // 2.5h labor
  ],
  per_color_supply_groups: [],
  assumptions: mockAssumptions,
  room_totals: [
    {
      room_id: 'R001',
      scope_count: 1,
      included_scope_count: 1,
      raw_area_sf: 100,
      effective_area_sf: 100,
      raw_paint_hours: 4,
      effective_paint_hours: 4,
      raw_primer_hours: 1,
      effective_primer_hours: 1,
      raw_paint_gallons: 2,
      effective_paint_gallons: 2,
      raw_paint_material_cost: 100,
      effective_paint_material_cost: 100,
      raw_primer_gallons: 0.5,
      effective_primer_gallons: 0.5,
      raw_supply_cost: 20,
      effective_supply_cost: 20,
      raw_total: 335,
      effective_total: 335,
    },
    {
      room_id: 'R002',
      scope_count: 1,
      included_scope_count: 1,
      raw_area_sf: 100,
      effective_area_sf: 100,
      raw_paint_hours: 2,
      effective_paint_hours: 2,
      raw_primer_hours: 0.5,
      effective_primer_hours: 0.5,
      raw_paint_gallons: 1,
      effective_paint_gallons: 1,
      raw_paint_material_cost: 50,
      effective_paint_material_cost: 50,
      raw_primer_gallons: 0.25,
      effective_primer_gallons: 0.25,
      raw_supply_cost: 10,
      effective_supply_cost: 10,
      raw_total: 167.5,
      effective_total: 167.5,
    },
  ],
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function assertFiniteMoney(value: number, label: string) {
  assert.equal(Number.isFinite(value), true, `${label} should be finite`)
  assert.ok(value >= 0, `${label} should not be negative`)
}

test('buildEstimatePricingSummary: aggregates raw labor hours across included scopes', () => {
  const result = buildEstimatePricingSummary([mockOutput], POLICY_DISABLED, MIN_DISABLED)
  assert.equal(result.rawLaborHours, 7.5) // 5h + 2.5h
})

test('buildEstimatePricingSummary: applies labor day policy correctly (7.5h → 8h)', () => {
  // 7.5h / 8h/day = 0.9375 days → bumps to 1 day (8h)
  const result = buildEstimatePricingSummary([mockOutput], POLICY_8H_HALF_DAY, MIN_DISABLED)
  assert.equal(result.effectiveLaborHours, 8)
  assert.equal(result.effectiveLaborDays, 1)
})

test('buildEstimatePricingSummary: labor cost uses effective hours × rate', () => {
  const result = buildEstimatePricingSummary([mockOutput], POLICY_8H_HALF_DAY, MIN_DISABLED)
  assert.equal(result.laborCost, 320) // 8h × $40
})

test('buildEstimatePricingSummary: material costs from gallons × price', () => {
  const result = buildEstimatePricingSummary([mockOutput], POLICY_DISABLED, MIN_DISABLED)
  assert.equal(result.wallPaintMaterialCost, 150)
  assert.equal(result.ceilingPaintMaterialCost, 0)
  assert.equal(result.trimPaintMaterialCost, 0)
  assert.equal(result.paintMaterialCost, 150)   // (2 + 1) gal × $50
  assert.equal(result.primerMaterialCost, 22.5) // (0.5 + 0.25) gal × $30
  assert.equal(result.supplyCost, 30)           // $20 + $10
})

test('buildEstimatePricingSummary: material buckets reconcile to included scope costs', () => {
  const outputWithSharedSupplies: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    ...mockOutput,
    per_color_supply_groups: [
      {
        group_key: 'WHITE',
        color_id: 'WHITE',
        paint_product_id: 'WALL-PAINT',
        total_shared_supply_cost: 10,
        total_effective_area_sf: 200,
        scope_count: 2,
        allocations: [
          {
            scope_key: 'R001:0',
            scope_id: null,
            room_id: 'R001',
            effective_area_sf: 100,
            weight: 100,
            allocated_supply_cost: 7.25,
          },
          {
            scope_key: 'R002:0',
            scope_id: null,
            room_id: 'R002',
            effective_area_sf: 100,
            weight: 100,
            allocated_supply_cost: 2.75,
          },
        ],
      },
    ],
  }
  const result = buildEstimatePricingSummary(
    [outputWithSharedSupplies],
    POLICY_DISABLED,
    MIN_DISABLED,
    {
      paint_product_id: 'TRIM-WHITE',
      paint_product_label: 'Trim White',
      gallons: 1,
      quarts: 0,
      normalized_gallons: 1,
      paint_cost: 31.5,
    },
    6.5
  )

  const includedScopes = outputWithSharedSupplies.scopes.filter((scope) => scope.include === 'Y')
  const expectedPaint = includedScopes.reduce(
    (sum, scope) => sum + (scope.allocated_paint_material_cost ?? scope.raw_paint_material_cost ?? 0),
    0
  )
  const expectedPrimer = includedScopes.reduce(
    (sum, scope) => sum + (scope.effective_primer_gallons ?? 0) * (scope.primer_price_per_gal ?? 0),
    0
  )
  const expectedSupply =
    includedScopes.reduce((sum, scope) => sum + (scope.effective_supply_cost ?? 0), 0) +
    10 +
    6.5

  assert.equal(result.wallPaintMaterialCost, expectedPaint)
  assert.equal(result.paintMaterialCost, expectedPaint + result.trimPaintMaterialCost)
  assert.equal(result.primerMaterialCost, expectedPrimer)
  assert.equal(result.supplyCost, expectedSupply)
})

test('buildEstimatePricingSummaryFromEngines: buckets paint material by explicit engine kind, not array order', () => {
  const wallOutput: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    ...mockOutput,
    scopes: [makeScope('R001', 1, 0, 2, 0, 0)],
    room_totals: [{ ...mockOutput.room_totals[0], effective_total: 100 }],
  }
  const ceilingOutput: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    ...mockOutput,
    scopes: [makeScope('R002', 1, 0, 3, 0, 0)],
    room_totals: [{ ...mockOutput.room_totals[1], room_id: 'R002', effective_total: 150 }],
  }
  const drywallOutput: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    ...mockOutput,
    scopes: [makeScope('R003', 1, 0, 5, 0, 12)],
    room_totals: [{ ...mockOutput.room_totals[1], room_id: 'R003', effective_total: 240 }],
  }

  const result = buildEstimatePricingSummaryFromEngines(
    [
      { kind: 'drywall', output: drywallOutput },
      { kind: 'ceilings', output: ceilingOutput },
      { kind: 'walls', output: wallOutput },
    ],
    POLICY_DISABLED,
    MIN_DISABLED
  )

  assert.equal(result.wallPaintMaterialCost, 100)
  assert.equal(result.ceilingPaintMaterialCost, 150)
  assert.equal(result.paintMaterialCost, 250)
  assert.equal(result.supplyCost, 12)
  assert.equal(result.prePolicyTotal, 490)
})

test('buildEstimatePricingSummary: totals reconcile from engine room bases through policies', () => {
  const trimPaint = {
    paint_product_id: 'TRIM-WHITE',
    paint_product_label: 'Trim White',
    gallons: 1,
    quarts: 2,
    normalized_gallons: 1.5,
    paint_cost: 45,
  }
  const result = buildEstimatePricingSummary([mockOutput], POLICY_8H_HALF_DAY, MIN_500, trimPaint)
  const engineRoomBase = mockOutput.room_totals.reduce((sum, room) => sum + room.effective_total, 0)
  const laborAdjustmentCost = result.laborAdjustmentHours * mockOutput.assumptions.labor_rate_per_hour
  const roomFinalTotal = result.rooms.reduce((sum, room) => sum + room.finalTotal, 0)
  const roomMinimumAdjustment = result.rooms.reduce((sum, room) => sum + room.allocatedMinimumAdjustment, 0)

  assert.equal(result.prePolicyTotal, engineRoomBase + trimPaint.paint_cost)
  assert.equal(result.postLaborPolicyTotal, result.prePolicyTotal + laborAdjustmentCost)
  assert.equal(result.minimumAdjustmentAmount, 0)
  assert.equal(result.finalTotal, result.postLaborPolicyTotal)
  assert.equal(roomMinimumAdjustment, result.minimumAdjustmentAmount)
  assert.equal(roomFinalTotal, result.prePolicyTotal)
})

test('buildEstimatePricingSummary: includes job-level access fees and scope allocation', () => {
  const wallOutput: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    ...mockOutput,
    room_totals: [{ ...mockOutput.room_totals[0], effective_total: 300 }],
  }
  const ceilingOutput: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    ...mockOutput,
    room_totals: [{ ...mockOutput.room_totals[0], room_id: 'R001', effective_total: 100 }],
  }
  const trimOutput: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    ...mockOutput,
    room_totals: [{ ...mockOutput.room_totals[0], room_id: 'R001', effective_total: 100 }],
  }

  const result = buildEstimatePricingSummaryFromEngines(
    [
      { kind: 'walls', output: wallOutput },
      { kind: 'ceilings', output: ceilingOutput },
      { kind: 'trim', output: trimOutput },
    ],
    POLICY_DISABLED,
    MIN_DISABLED,
    null,
    0,
    {
      total: 500,
      scopes: [
        { key: 'walls', eligible: true, preAccessSubtotal: 300 },
        { key: 'ceilings', eligible: true, preAccessSubtotal: 100 },
        { key: 'trim', eligible: true, preAccessSubtotal: 100 },
      ],
    }
  )

  assert.equal(result.sharedAccessCost, 500)
  assert.deepEqual(result.accessFeeAllocation, {
    walls: 300,
    ceilings: 100,
    trim: 100,
    unallocated: 0,
    warning: null,
  })
  assert.equal(result.prePolicyTotal, 1000)
  assert.equal(result.finalTotal, 1000)
})

test('buildPerJobSupplyCost multiplies only crew-flagged supply rows', () => {
  const catalogs = {
    supplies_rates: [
      {
        key: 'BRUSH_TRIM',
        supply_group: 'per_job',
        scope: 'Trim',
        unit: 'each',
        value: 5,
        crew_multiplier: 'Y',
      },
      {
        key: 'TAPE_MASK',
        supply_group: 'per_job',
        scope: 'All',
        unit: 'each',
        value: 2,
        crew_multiplier: 'N',
      },
    ],
  }

  assert.equal(buildPerJobSupplyCost({ catalogs, crewSize: 3, activeScopes: ['trim'] }), 17)
  assert.equal(buildPerJobSupplyCost({ catalogs, crewSize: 3, activeScopes: ['walls', 'trim'] }), 17)
  assert.equal(buildPerJobSupplyCost({ catalogs, crewSize: 1, activeScopes: ['trim'] }), 7)
})

test('buildEstimatePricingSummary: trim paint adds estimate-level paint cost and room allocation', () => {
  const output: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    scopes: [
      makeScope('R001', 0, 0, 0, 0, 0),
    ],
    per_color_supply_groups: [],
    assumptions: mockAssumptions,
    room_totals: [
      {
        room_id: 'R001',
        scope_count: 1,
        included_scope_count: 1,
        raw_area_sf: 0,
        effective_area_sf: 0,
        raw_paint_hours: 0,
        effective_paint_hours: 0,
        raw_primer_hours: 0,
        effective_primer_hours: 0,
        raw_paint_gallons: 0,
        effective_paint_gallons: 0,
        raw_paint_material_cost: 0,
        effective_paint_material_cost: 0,
        raw_primer_gallons: 0,
        effective_primer_gallons: 0,
        raw_supply_cost: 0,
        effective_supply_cost: 0,
        raw_total: 0,
        effective_total: 0,
      },
    ],
  }
  const trimPaint = {
    paint_product_id: 'TRIM-WHITE',
    paint_product_label: 'Trim White',
    gallons: 1,
    quarts: 2,
    normalized_gallons: 1.5,
    paint_cost: 45,
  }

  const result = buildEstimatePricingSummary([output], POLICY_DISABLED, MIN_DISABLED, trimPaint)

  assert.equal(result.trimPaintMaterialCost, 45)
  assert.equal(result.paintMaterialCost, 45)
  assert.equal(result.prePolicyTotal, 45)
  assert.equal(result.postLaborPolicyTotal, 45)
  assert.equal(result.finalTotal, 45)
  assert.equal(result.rooms.length, 1)
  assert.equal(result.rooms[0].room_id, 'R001')
  assert.equal(result.rooms[0].baseTotal, 45)
  assert.equal(result.rooms[0].finalTotal, 45)
  assert.deepEqual(result.trimPaint, trimPaint)
})

test('buildEstimatePricingSummary: calculated trim scope paint contributes to trim paint material cost', () => {
  const trimOutput = {
    scopes: [
      {
        include: 'Y' as const,
        effective_paint_hours: 1,
        effective_primer_hours: 0,
        effective_paint_gallons: 1,
        effective_primer_gallons: 0,
        effective_supply_cost: 0,
        raw_paint_material_cost: 42,
        paint_price_per_gal: 42,
      },
    ],
    room_totals: [{ room_id: 'R001', effective_total: 92 }],
    per_color_supply_groups: [],
    assumptions: { labor_rate_per_hour: 50 },
  }

  const result = buildEstimatePricingSummaryFromEngines(
    [{ kind: 'trim', output: trimOutput }],
    POLICY_DISABLED,
    MIN_DISABLED
  )

  assert.equal(result.trimPaintMaterialCost, 42)
  assert.equal(result.paintMaterialCost, 42)
  assert.equal(result.prePolicyTotal, 92)
  assert.equal(result.finalTotal, 92)
  assert.equal(result.rooms[0]?.baseTotal, 92)
})

test('buildEstimatePricingSummary: no minimum adjustment when disabled', () => {
  const result = buildEstimatePricingSummary([mockOutput], POLICY_DISABLED, MIN_DISABLED)
  assert.equal(result.minimumAdjustmentAmount, 0)
  assert.equal(result.finalTotal, result.postLaborPolicyTotal)
})

test('buildEstimatePricingSummary: minimum applied and allocated to rooms', () => {
  const min: JobMinimumSettings = { enabled: true, amount: 10000 }
  const result = buildEstimatePricingSummary([mockOutput], POLICY_DISABLED, min)
  assert.ok(result.minimumAdjustmentAmount > 0)
  assert.equal(result.finalTotal, 10000)
  const totalAllocated = result.rooms.reduce((s, r) => s + r.allocatedMinimumAdjustment, 0)
  assert.ok(Math.abs(totalAllocated - result.minimumAdjustmentAmount) < 0.02)
})

test('buildEstimatePricingSummary: excluded scopes do not contribute to totals', () => {
  const outputWithExcluded: Pick<WallCalculationOutput, 'scopes' | 'room_totals' | 'per_color_supply_groups' | 'assumptions'> = {
    scopes: [
      makeScope('R001', 4, 1, 2, 0.5, 20),
      { ...makeScope('R002', 100, 100, 100, 100, 100), include: 'N' as const },
    ],
    per_color_supply_groups: [],
    assumptions: mockAssumptions,
    room_totals: mockOutput.room_totals.slice(0, 1),
  }
  const result = buildEstimatePricingSummary([outputWithExcluded], POLICY_DISABLED, MIN_DISABLED)
  assert.equal(result.rawLaborHours, 5) // only R001
})

test('buildEstimatePricingSummary: pricing invariants hold across mixed policy cases', () => {
  const cases = [
    {
      name: 'no policy',
      engines: [mockOutput],
      laborPolicy: POLICY_DISABLED,
      minimumPolicy: MIN_DISABLED,
      trimPaint: null,
      extraSupplyCost: 0,
    },
    {
      name: 'labor rounding',
      engines: [mockOutput],
      laborPolicy: POLICY_8H_HALF_DAY,
      minimumPolicy: MIN_DISABLED,
      trimPaint: null,
      extraSupplyCost: 0,
    },
    {
      name: 'minimum and trim paint',
      engines: [mockOutput],
      laborPolicy: POLICY_8H_HALF_DAY,
      minimumPolicy: { enabled: true, amount: 900 },
      trimPaint: {
        paint_product_id: 'TRIM-WHITE',
        paint_product_label: 'Trim White',
        gallons: 1,
        quarts: 1,
        normalized_gallons: 1.25,
        paint_cost: 37.5,
      },
      extraSupplyCost: 8.25,
    },
    {
      name: 'excluded high-dollar rows',
      engines: [
        {
          ...mockOutput,
          scopes: [
            ...mockOutput.scopes,
            {
              ...makeScope('R003', 999, 999, 999, 999, 999),
              include: 'N' as const,
              allocated_paint_material_cost: 999,
              raw_paint_material_cost: 999,
            },
          ],
          room_totals: mockOutput.room_totals,
        },
      ],
      laborPolicy: POLICY_DISABLED,
      minimumPolicy: MIN_DISABLED,
      trimPaint: null,
      extraSupplyCost: 0,
    },
  ]

  for (const c of cases) {
    const result = buildEstimatePricingSummary(
      c.engines,
      c.laborPolicy,
      c.minimumPolicy,
      c.trimPaint,
      c.extraSupplyCost
    )
    const laborRate = c.engines[0]?.assumptions.labor_rate_per_hour ?? 0
    const laborAdjustmentCost = round2(result.laborAdjustmentHours * laborRate)
    const roomBaseTotal = round2(result.rooms.reduce((sum, room) => sum + room.baseTotal, 0))
    const roomFinalTotal = round2(result.rooms.reduce((sum, room) => sum + room.finalTotal, 0))
    const roomMinimumAdjustment = round2(
      result.rooms.reduce((sum, room) => sum + room.allocatedMinimumAdjustment, 0)
    )

    for (const [label, value] of Object.entries(result)) {
      if (typeof value === 'number') assertFiniteMoney(value, `${c.name}.${label}`)
    }
    assert.equal(
      result.paintMaterialCost,
      round2(result.wallPaintMaterialCost + result.ceilingPaintMaterialCost + result.trimPaintMaterialCost)
    )
    assert.equal(result.laborCost, round2(result.effectiveLaborHours * laborRate))
    assert.equal(result.postLaborPolicyTotal, round2(result.prePolicyTotal + laborAdjustmentCost))
    assert.equal(result.finalTotal, round2(result.postLaborPolicyTotal + result.minimumAdjustmentAmount))
    assert.equal(roomBaseTotal, result.prePolicyTotal)
    assert.equal(roomMinimumAdjustment, result.minimumAdjustmentAmount)
    assert.equal(roomFinalTotal, round2(result.prePolicyTotal + result.minimumAdjustmentAmount))
  }
})
