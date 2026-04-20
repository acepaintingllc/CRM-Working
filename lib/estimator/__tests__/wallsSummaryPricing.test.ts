import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateWalls, type WallCalculationInput } from '../walls.ts'
import { buildWallsSummarySnapshot, validateWallsPricingReadiness } from '../wallsSummaryPricing.ts'

function buildInput(): WallCalculationInput {
  return {
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
        id: 'scope-1',
        room_id: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Main',
        color_id: 'A',
        paint_product_id: 'P-WALL',
        primer_product_id: 'P-PRIMER',
        prime_mode: 'FULL',
        height_in: 96,
        perimeter_in: 400,
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
        room_id: 'R002',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scope_name: 'Accent',
        color_id: 'B',
        paint_product_id: 'P-WALL',
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

test('pricing readiness passes on valid wall calculations', () => {
  const calculations = calculateWalls(buildInput())
  const issues = validateWallsPricingReadiness(calculations)
  assert.equal(issues.length, 0)
})

test('pricing readiness flags missing metrics, trace gaps, and room total mismatch', () => {
  const calculations = calculateWalls(buildInput())
  const broken = {
    ...calculations,
    scopes: calculations.scopes.map((scope, idx) =>
      idx === 0 ? { ...scope, effective_total: null } : scope
    ),
    scope_traces: calculations.scope_traces.slice(0, 1),
    room_totals: calculations.room_totals.map((room) =>
      room.room_id === 'R001' ? { ...room, effective_total: room.effective_total + 10 } : room
    ),
  }
  const issues = validateWallsPricingReadiness(broken)
  assert.ok(issues.some((issue) => issue.code === 'SCOPE_METRIC_MISSING'))
  assert.ok(issues.some((issue) => issue.code === 'SCOPE_TRACE_MISSING'))
  assert.ok(issues.some((issue) => issue.code === 'ROOM_TOTAL_MISMATCH'))
})

test('summary snapshot is deterministic and room-sorted', () => {
  const calculations = calculateWalls(buildInput())
  const snapshot = buildWallsSummarySnapshot(calculations)
  assert.equal(snapshot.scope_count, 2)
  assert.equal(snapshot.included_scope_count, 2)
  assert.equal(snapshot.rooms.length, 2)
  assert.equal(snapshot.rooms[0].room_id, 'R001')
  assert.equal(snapshot.rooms[1].room_id, 'R002')
  assert.ok(snapshot.totals.effective_area_sf > 0)
  assert.ok(snapshot.totals.effective_total > 0)
})

test('summary snapshot grand totals equal sum of per-room totals', () => {
  const calculations = calculateWalls(buildInput())
  const snapshot = buildWallsSummarySnapshot(calculations)
  const sumArea = snapshot.rooms.reduce((acc, room) => acc + (room.effective_area_sf ?? 0), 0)
  const sumTotal = snapshot.rooms.reduce((acc, room) => acc + (room.effective_total ?? 0), 0)
  assert.ok(Math.abs(sumArea - (snapshot.totals.effective_area_sf ?? 0)) < 0.01)
  assert.ok(Math.abs(sumTotal - (snapshot.totals.effective_total ?? 0)) < 0.01)
})

test('excluded scopes do not contribute to snapshot totals', () => {
  const input = buildInput()
  const inputWithExcluded: WallCalculationInput = {
    ...input,
    scopes: [
      ...input.scopes,
      {
        ...input.scopes[0],
        id: 'scope-excluded',
        room_id: 'R003',
        include: 'N',
        height_in: 96,
        perimeter_in: 600,
        standard_door_count: 0,
        standard_window_count: 0,
      },
    ],
  }
  const baseline = buildWallsSummarySnapshot(calculateWalls(input))
  const withExcluded = buildWallsSummarySnapshot(calculateWalls(inputWithExcluded))
  assert.equal(withExcluded.scope_count, 3)
  assert.equal(withExcluded.included_scope_count, 2)
  assert.ok(Math.abs((withExcluded.totals.effective_total ?? 0) - (baseline.totals.effective_total ?? 0)) < 0.01)
})
