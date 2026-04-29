import assert from 'node:assert/strict'
import test from 'node:test'
import { applySelectedWallProductionRates } from '../estimate-v2/wallProductionRates.ts'
import type { V2RoomRosterRow, V2WallScopeSaveRow } from '../estimateV2RoutePayload.ts'

function makeRoom(overrides: Partial<V2RoomRosterRow> = {}): V2RoomRosterRow {
  return {
    id: 'room-1',
    room_id: 'R001',
    room_name: 'Living',
    room_type_id: null,
    length_in: 120,
    width_in: 144,
    wallheight_in: 96,
    wall_complexity_id: 'WALL_REPAINT_LIGHT',
    condition_selections: null,
    notes: null,
    position: 0,
    ...overrides,
  }
}

function makeScope(overrides: Partial<V2WallScopeSaveRow> = {}): V2WallScopeSaveRow {
  return {
    id: 'wall-1',
    room_id: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scope_name: 'Main walls',
    color_id: null,
    paint_product_id: null,
    primer_product_id: null,
    prime_mode: 'FULL',
    height_in: 96,
    perimeter_in: 528,
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

test('applySelectedWallProductionRates uses selected wall production row as base paint and primer rates', () => {
  const [scope] = applySelectedWallProductionRates({
    rooms: [makeRoom()],
    scopes: [makeScope()],
    productionRates: [
      {
        id: 'WALL_REPAINT_LIGHT',
        scope_id: 'WALLS',
        sqft_per_hr: 160,
        primer_sqft_per_hr: 180,
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 160)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 180)
})

test('applySelectedWallProductionRates keeps explicit wall scope production overrides', () => {
  const [scope] = applySelectedWallProductionRates({
    rooms: [makeRoom()],
    scopes: [
      makeScope({
        paint_prod_rate_sqft_per_hour: 140,
        primer_prod_rate_sqft_per_hour: 155,
      }),
    ],
    productionRates: [
      {
        id: 'WALL_REPAINT_LIGHT',
        scope_id: 'WALLS',
        sqft_per_hr: 160,
        primer_sqft_per_hr: 180,
      },
    ],
  })

  assert.equal(scope.paint_prod_rate_sqft_per_hour, 140)
  assert.equal(scope.primer_prod_rate_sqft_per_hour, 155)
})
