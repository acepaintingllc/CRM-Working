import assert from 'node:assert/strict'
import test from 'node:test'
import { CANONICAL_FIXTURES } from '../__fixtures__/canonical/index.ts'

test('canonical Estimator V2 fixtures expose exactly eight typed editor-state scenarios', () => {
  assert.equal(CANONICAL_FIXTURES.length, 8)

  const names = CANONICAL_FIXTURES.map((fixture) => fixture.scenarioName)
  assert.deepEqual(names, [
    'Simple / no overrides',
    'All scope types',
    'All major policy flags',
    'Manual overrides + disabled scopes',
    'Multi-room with geometry variation',
    'Simple hallway repaint',
    'Full master bedroom',
    'Exterior trim',
  ])

  for (const fixture of CANONICAL_FIXTURES) {
    assert.ok(fixture.scenarioDescription.length > 0)
    assert.ok(fixture.editorState.collections.rooms.length > 0)
    assert.equal(fixture.expectedTotals.rooms.length, fixture.editorState.collections.rooms.length)
  }
})

test('canonical Estimator V2 fixtures include per-scope totals for every present scope', () => {
  for (const fixture of CANONICAL_FIXTURES) {
    assert.equal(fixture.expectedTotals.scopeTotals.walls.length, fixture.editorState.collections.scopes.length)
    assert.equal(fixture.expectedTotals.scopeTotals.ceilings.length, fixture.editorState.collections.ceilingScopes.length)
    assert.equal(fixture.expectedTotals.scopeTotals.trim.length, fixture.editorState.collections.trimScopes.length)
    assert.equal(fixture.expectedTotals.scopeTotals.doors.length, fixture.editorState.collections.doorScopes?.length ?? 0)
    assert.equal(fixture.expectedTotals.scopeTotals.drywall.length, fixture.editorState.collections.drywallRepairs?.length ?? 0)
    assert.equal(fixture.expectedTotals.scopeTotals.accessFees.length, fixture.editorState.collections.accessFees?.length ?? 0)
  }
})
