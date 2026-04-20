import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateWalls, type WallCalculationInput, type WallCalculationScopeRow, type WallCalculationSegmentRow } from '../walls.ts'

const DOOR_DEDUCTION_SF = 21
const WINDOW_DEDUCTION_SF = 15

function approx(actual: number | null | undefined, expected: number, epsilon = 0.001) {
  assert.notEqual(actual, null)
  assert.notEqual(actual, undefined)
  assert.ok(Math.abs((actual as number) - expected) <= epsilon, `expected ${expected}, got ${actual}`)
}

function localSegmentEffectiveArea(segment: WallCalculationSegmentRow) {
  const quantity = typeof segment.quantity === 'number' ? segment.quantity : 1
  let rawArea: number | null = null
  if (segment.shape_type === 'RECTANGLE' && segment.width_in != null && segment.height_in != null) {
    rawArea = (segment.width_in * segment.height_in * quantity) / 144
  } else if (segment.shape_type === 'TRIANGLE' && segment.base_in != null && segment.height_in != null) {
    rawArea = ((segment.base_in * segment.height_in) / 2 / 144) * quantity
  } else if (segment.shape_type === 'MANUAL' && segment.manual_area_sf != null) {
    rawArea = segment.manual_area_sf * quantity
  }
  const deductions =
    (segment.standard_door_count ?? 0) * DOOR_DEDUCTION_SF + (segment.standard_window_count ?? 0) * WINDOW_DEDUCTION_SF
  const net = rawArea == null ? null : Math.max(rawArea - deductions, 0)
  return segment.override_area_sf ?? net
}

function localScopeAreas(scope: WallCalculationScopeRow, segments: WallCalculationSegmentRow[]) {
  if (scope.mode === 'RECT') {
    const perimeter = scope.perimeter_in
    const height = scope.height_in
    const deductions =
      (scope.standard_door_count ?? 0) * DOOR_DEDUCTION_SF + (scope.standard_window_count ?? 0) * WINDOW_DEDUCTION_SF
    const rawArea = perimeter != null && height != null ? Math.max((perimeter * height) / 144 - deductions, 0) : null
    return { rawArea, effectiveArea: scope.override_area_sf ?? rawArea }
  }

  const rawArea = segments
    .filter((segment) => segment.include === 'Y')
    .reduce((sum, segment) => sum + (localSegmentEffectiveArea(segment) ?? 0), 0)
  return { rawArea, effectiveArea: scope.override_area_sf ?? rawArea }
}

function makeRng(seed = 42) {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function randomInt(rand: () => number, min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min
}

function randomPick<T>(rand: () => number, values: T[]) {
  return values[randomInt(rand, 0, values.length - 1)]
}

function buildRandomAreaInput(seed: number): WallCalculationInput {
  const rand = makeRng(seed)
  const scopeCount = randomInt(rand, 2, 5)
  const scopes: WallCalculationScopeRow[] = []
  const segments: WallCalculationSegmentRow[] = []

  for (let idx = 0; idx < scopeCount; idx += 1) {
    const mode = randomPick(rand, ['RECT', 'SEG'] as const)
    const id = `scope-${seed}-${idx}`
    const roomId = `R${String(randomInt(rand, 1, 4)).padStart(3, '0')}`
    const hasOverride = rand() > 0.72
    scopes.push({
      id,
      room_id: roomId,
      position: idx,
      mode,
      include: 'Y',
      scope_name: null,
      color_id: null,
      paint_product_id: null,
      primer_product_id: null,
      prime_mode: 'NONE',
      height_in: mode === 'RECT' ? randomInt(rand, 84, 120) : null,
      perimeter_in: mode === 'RECT' ? randomInt(rand, 180, 720) : null,
      standard_door_count: mode === 'RECT' ? randomInt(rand, 0, 2) : null,
      standard_window_count: mode === 'RECT' ? randomInt(rand, 0, 3) : null,
      height_factor: 1,
      complexity_factor: 1,
      wall_flag_factor: 1,
      cut_in_top_factor: 1,
      cut_in_bottom_factor: 1,
      raw_area_sf: null,
      override_area_sf: hasOverride ? randomInt(rand, 35, 550) : null,
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
    })

    if (mode === 'SEG') {
      const segmentCount = randomInt(rand, 1, 4)
      for (let segIndex = 0; segIndex < segmentCount; segIndex += 1) {
        const shape = randomPick(rand, ['RECTANGLE', 'TRIANGLE', 'MANUAL'] as const)
        segments.push({
          id: `seg-${seed}-${idx}-${segIndex}`,
          wall_scope_id: id,
          room_id: roomId,
          position: segIndex,
          segment_name: null,
          include: 'Y',
          shape_type: shape,
          quantity: randomInt(rand, 1, 3),
          width_in: shape === 'RECTANGLE' ? randomInt(rand, 24, 180) : null,
          height_in: shape !== 'MANUAL' ? randomInt(rand, 24, 120) : null,
          base_in: shape === 'TRIANGLE' ? randomInt(rand, 24, 180) : null,
          manual_area_sf: shape === 'MANUAL' ? randomInt(rand, 10, 180) : null,
          standard_door_count: randomInt(rand, 0, 1),
          standard_window_count: randomInt(rand, 0, 2),
          raw_area_sf: null,
          override_area_sf: rand() > 0.9 ? randomInt(rand, 10, 220) : null,
          effective_area_sf: null,
          notes: null,
        })
      }
    }
  }

  return { scopes, segments }
}

test('local v2 area preview formulas reconcile with server area calculations', () => {
  for (let seed = 1; seed <= 250; seed += 1) {
    const input = buildRandomAreaInput(seed)
    const result = calculateWalls(input)
    const segmentsByScope = new Map<string, WallCalculationSegmentRow[]>()
    for (const segment of input.segments) {
      if (!segmentsByScope.has(segment.wall_scope_id)) segmentsByScope.set(segment.wall_scope_id, [])
      segmentsByScope.get(segment.wall_scope_id)?.push(segment)
    }

    const localRoomTotals = new Map<string, number>()
    for (const scope of input.scopes) {
      const local = localScopeAreas(scope, segmentsByScope.get(scope.id ?? '') ?? [])
      const serverScope = result.scopes.find((row) => row.id === scope.id)
      assert.ok(serverScope, `missing normalized scope ${scope.id}`)
      approx(serverScope.raw_area_sf, local.rawArea ?? 0)
      approx(serverScope.effective_area_sf, local.effectiveArea ?? 0)
      localRoomTotals.set(scope.room_id, (localRoomTotals.get(scope.room_id) ?? 0) + (local.effectiveArea ?? 0))
    }

    for (const room of result.room_totals) {
      approx(room.effective_area_sf, localRoomTotals.get(room.room_id) ?? 0)
    }
  }
})
