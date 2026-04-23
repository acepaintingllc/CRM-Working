import assert from 'node:assert/strict'
import test from 'node:test'

import {
  EstimateV2RouteServiceError,
  nextRoomId,
  toOtherRollupScope,
  toWallsCalcMethod,
} from '../estimate-v2/shared.ts'

test('nextRoomId skips used room ids and pads the sequence', () => {
  const used = new Set(['R001', 'R002', 'R004'])
  assert.equal(nextRoomId(used, 1), 'R003')
  used.add('R003')
  assert.equal(nextRoomId(used, 4), 'R005')
})

test('shared estimate v2 converters preserve existing route semantics', () => {
  assert.equal(toWallsCalcMethod('panel'), 'PANEL')
  assert.equal(toWallsCalcMethod('anything-else'), 'REGULAR')
  assert.equal(toOtherRollupScope('wall'), 'Walls')
  assert.equal(toOtherRollupScope('ceilings'), 'Ceilings')
  assert.equal(toOtherRollupScope('trim'), 'Trim')
  assert.equal(toOtherRollupScope('doors'), null)
})

test('EstimateV2RouteServiceError carries its status code', () => {
  const error = new EstimateV2RouteServiceError('bad request', 422)
  assert.equal(error.message, 'bad request')
  assert.equal(error.status, 422)
})
