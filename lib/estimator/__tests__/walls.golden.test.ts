import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateWalls } from '../walls.ts'
import { WALL_GOLDEN_FIXTURES } from './wallsFixtures.ts'

function approx(actual: number | null | undefined, expected: number, epsilon = 0.0001) {
  assert.notEqual(actual, null)
  assert.notEqual(actual, undefined)
  assert.ok(Math.abs((actual as number) - expected) <= epsilon, `expected ${expected}, got ${actual}`)
}

for (const fixture of WALL_GOLDEN_FIXTURES) {
  test(`golden fixture: ${fixture.name}`, () => {
    const result = calculateWalls(fixture.input)
    assert.equal(result.missing_inputs.length, fixture.expected.missing_input_count)

    for (const expectedScope of fixture.expected.scopes) {
      const scope = result.scopes.find((row) => row.id === expectedScope.id)
      assert.ok(scope, `missing scope ${expectedScope.id}`)
      approx(scope.raw_area_sf, expectedScope.raw_area_sf)
      approx(scope.effective_area_sf, expectedScope.effective_area_sf)
      approx(scope.raw_total, expectedScope.raw_total)
      approx(scope.effective_total, expectedScope.effective_total)
      if (expectedScope.raw_supply_cost != null) approx(scope.raw_supply_cost, expectedScope.raw_supply_cost)
      if (expectedScope.raw_paint_hours != null) approx(scope.raw_paint_hours, expectedScope.raw_paint_hours)
      if (expectedScope.raw_primer_hours != null) approx(scope.raw_primer_hours, expectedScope.raw_primer_hours)
      if (expectedScope.modifier_factor != null) {
        const trace = result.scope_traces.find((item) => item.scope_id === expectedScope.id)
        assert.ok(trace, `missing scope trace ${expectedScope.id}`)
        approx(trace.labor.modifier_factor, expectedScope.modifier_factor)
      }
    }

    for (const expectedRoom of fixture.expected.rooms) {
      const room = result.room_totals.find((row) => row.room_id === expectedRoom.room_id)
      assert.ok(room, `missing room total ${expectedRoom.room_id}`)
      approx(room.effective_area_sf, expectedRoom.effective_area_sf)
      approx(room.effective_total, expectedRoom.effective_total)
    }

    if (fixture.expected.color_group) {
      const group = result.per_color_supply_groups.find(
        (row) => row.group_key === fixture.expected.color_group?.group_key
      )
      assert.ok(group, `missing color group ${fixture.expected.color_group.group_key}`)
      approx(group.total_shared_supply_cost, fixture.expected.color_group.total_shared_supply_cost)
      for (const [scopeId, allocation] of Object.entries(fixture.expected.color_group.allocations)) {
        const match = group.allocations.find((row) => row.scope_id === scopeId)
        assert.ok(match, `missing allocation for scope ${scopeId}`)
        approx(match.allocated_supply_cost, allocation)
      }
    }
  })
}
