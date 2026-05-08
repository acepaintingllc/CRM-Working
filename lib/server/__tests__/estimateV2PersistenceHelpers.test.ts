import assert from 'node:assert/strict'
import test from 'node:test'

import { buildV2RoomPersistenceRow } from '../estimate-v2/roomPersistence.ts'
import { isMissingFullEstimateSaveRpc } from '../estimate-v2/scopeRowPersistence.ts'

test('buildV2RoomPersistenceRow keeps only V2 roster-owned room fields', () => {
  const row = buildV2RoomPersistenceRow({
    id: 'room-row-1',
    org_id: 'org-1',
    estimate_id: 'estimate-1',
    job_id: 'job-1',
    position: 1,
    room_id: 'R001',
    room_name: 'Living',
    room_type_id: 'BEDROOM',
    wall_complexity_id: 'WALL_STD',
    notes: 'Room note',
    length_in: 120,
    width_in: 144,
    wallheight_in: 96,
    condition_selections: { ROOM_FURNISHED: 'active' },
  })

  assert.deepEqual(row, {
    id: 'room-row-1',
    org_id: 'org-1',
    estimate_id: 'estimate-1',
    job_id: 'job-1',
    position: 1,
    room_id: 'R001',
    room_name: 'Living',
    room_type_id: 'BEDROOM',
    wall_complexity_id: 'WALL_STD',
    notes: 'Room note',
    length_in: 120,
    width_in: 144,
    wallheight_in: 96,
    condition_selections: { ROOM_FURNISHED: 'active' },
  })
  assert.equal('trim_include' in row, false)
  assert.equal('paint_crown' in row, false)
})

test('full save rpc helper identifies a missing full-save function', () => {
  assert.equal(
    isMissingFullEstimateSaveRpc(
      'function public.save_estimate_v2_full_persistence does not exist'
    ),
    true
  )
  assert.equal(
    isMissingFullEstimateSaveRpc(
      'Could not find the function public.save_estimate_v2_full_persistence(uuid,uuid,uuid,jsonb)'
    ),
    true
  )
  assert.equal(
    isMissingFullEstimateSaveRpc('function public.save_estimate_v2_inputs does not exist'),
    false
  )
  assert.equal(isMissingFullEstimateSaveRpc('duplicate key value violates unique constraint'), false)
})
