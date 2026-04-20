import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateWalls } from '../walls.ts'
import { WALL_GOLDEN_FIXTURES } from './wallsFixtures.ts'

function approx(actual: number | null | undefined, expected: number, epsilon = 0.0001) {
  assert.notEqual(actual, null)
  assert.notEqual(actual, undefined)
  assert.ok(Math.abs((actual as number) - expected) <= epsilon, `expected ${expected}, got ${actual}`)
}

test('wall_calculations contract links scope rows, traces, and room totals', () => {
  const result = calculateWalls(WALL_GOLDEN_FIXTURES[0].input)
  assert.ok(Array.isArray(result.scopes))
  assert.ok(Array.isArray(result.segments))
  assert.ok(Array.isArray(result.room_totals))
  assert.ok(Array.isArray(result.scope_traces))
  assert.ok(Array.isArray(result.per_color_supply_groups))
  assert.ok(Array.isArray(result.missing_inputs))
  assert.ok(result.required_inputs.scope_rect_required.includes('perimeter_in'))
  assert.ok(result.required_inputs.scope_rect_required.includes('height_in'))
  assert.ok(result.required_inputs.scope_seg_required.includes('wall_segments[] (included)'))
  assert.ok(result.required_inputs.segment_required_by_shape.RECTANGLE.includes('width_in'))
  assert.ok(result.required_inputs.segment_required_by_shape.TRIANGLE.includes('base_in'))
  assert.ok(result.required_inputs.segment_required_by_shape.MANUAL.includes('manual_area_sf'))

  const scopeByKey = new Map(result.scopes.map((scope) => [scope.id ?? `${scope.room_id}::${scope.position}`, scope]))
  for (const trace of result.scope_traces) {
    const key = trace.scope_id ?? trace.scope_key
    const scope = scopeByKey.get(key)
    assert.ok(scope, `missing scope for trace key ${key}`)
    assert.equal(trace.room_id, scope.room_id)
    assert.equal(trace.mode, scope.mode)
    assert.equal(trace.include, scope.include)
    approx(trace.area.raw_area_sf, scope.raw_area_sf ?? 0)
    approx(trace.area.effective_area_sf, scope.effective_area_sf ?? 0)
    approx(trace.totals.raw_total, scope.raw_total ?? 0)
    approx(trace.totals.effective_total, scope.effective_total ?? 0)

    const missingByScope = result.missing_inputs.filter(
      (item) => item.scope_id === trace.scope_key || item.scope_id === trace.scope_id
    )
    assert.equal(trace.missing_inputs.length, missingByScope.length)
  }

  const expectedRoomOrder = [...result.room_totals].sort((a, b) => a.room_id.localeCompare(b.room_id))
  assert.deepEqual(result.room_totals.map((room) => room.room_id), expectedRoomOrder.map((room) => room.room_id))

  const totalsByRoom = new Map<string, { area: number; total: number }>()
  for (const scope of result.scopes) {
    const current = totalsByRoom.get(scope.room_id) ?? { area: 0, total: 0 }
    current.area += scope.effective_area_sf ?? 0
    current.total += scope.effective_total ?? 0
    totalsByRoom.set(scope.room_id, current)
  }

  for (const room of result.room_totals) {
    const sums = totalsByRoom.get(room.room_id)
    assert.ok(sums, `missing expected sums for room ${room.room_id}`)
    approx(room.effective_area_sf, sums.area)
    approx(room.effective_total, sums.total)
  }
})
