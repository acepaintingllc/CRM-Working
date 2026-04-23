import assert from 'node:assert/strict'
import test from 'node:test'

import { buildLegacyEstimateRoomRows } from '../estimate-v2/roomPersistence.ts'
import {
  isMissingStructuredEstimateSaveRpc,
  isRecoverableStructuredEstimateSaveRpcPkCollision,
} from '../estimate-v2/scopeRowPersistence.ts'

test('buildLegacyEstimateRoomRows generates unique ids and preserves trim automation flags', () => {
  const rows = buildLegacyEstimateRoomRows({
    orgId: 'org-1',
    estimateId: 'estimate-1',
    jobId: 'job-1',
    rooms: [
      { room_name: 'Living', room_id: 'R001', trim_include: 'Y', mode: 'RECT', baseboard_type_id: 'BASE', baseboard_auto: 'Y' },
      { room_name: 'Kitchen', room_id: 'R001', trim_include: 'Y', mode: 'RECT', crown_type_id: 'CROWN', crown_auto: 'Y' },
    ],
  })

  assert.equal(rows.length, 2)
  assert.equal(rows[0].room_id, 'R001')
  assert.equal(rows[0].baseboard_auto, 'Y')
  assert.equal(rows[0].auto_calc_trim_perimeter, 'Y')
  assert.equal(rows[1].room_id, 'R002')
  assert.equal(rows[1].paint_crown, 'Y')
  assert.equal(rows[1].auto_calc_trim_perimeter, 'Y')
})

test('structured save rpc helpers only recover the known fallback cases', () => {
  assert.equal(
    isMissingStructuredEstimateSaveRpc('function public.save_estimate_v2_inputs does not exist'),
    true
  )
  assert.equal(
    isRecoverableStructuredEstimateSaveRpcPkCollision(
      'duplicate key value violates unique constraint "estimate_room_flags_pkey"'
    ),
    true
  )
  assert.equal(
    isRecoverableStructuredEstimateSaveRpcPkCollision(
      'duplicate key value violates unique constraint "unrelated_constraint"'
    ),
    false
  )
})
