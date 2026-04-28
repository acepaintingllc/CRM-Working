import assert from 'node:assert/strict'
import test from 'node:test'
import { buildV2RoomPersistenceRow } from '../roomPersistence.ts'
import { buildEstimateV2SavePayload } from '../../../estimator/v2DraftPayload.ts'
import { buildV2RoomRosterRows } from '../../estimateV2RoutePayload.ts'

test('estimate v2 room payload preserves room type and wall complexity fields for persistence', () => {
  const row = buildV2RoomPersistenceRow({
    id: 'room-1',
    org_id: 'org-1',
    estimate_id: 'estimate-1',
    job_id: 'job-1',
    room_id: 'R001',
    room_name: 'Living Room',
    room_type_id: 'BEDROOM',
    wall_complexity_id: 'WALL_STD',
    notes: null,
    position: 0,
    length_in: 120,
    width_in: 144,
    wallheight_in: 96,
    condition_selections: null,
  })

  assert.equal(row.room_type_id, 'BEDROOM')
  assert.equal(row.wall_complexity_id, 'WALL_STD')
})

test('estimate v2 editor save payload carries room metadata through route and persistence rows', () => {
  const payload = buildEstimateV2SavePayload(
    {
      laborDayEnabled: true,
      dayhours: 8,
      roundingIncrementHours: 4,
      laborRate: 65,
      jobMinEnabled: false,
      jobMinAmount: 0,
      crewSize: 1,
      wallPaintProductId: '',
      wallPrimerProductId: '',
      ceilingPaintProductId: '',
      ceilingPrimerProductId: '',
      trimPaintProductId: '',
      trimPrimerProductId: '',
    },
    [
      {
        id: 'room-1',
        roomId: 'r001',
        roomName: 'Living Room',
        roomTypeId: ' bedroom ',
        lengthIn: '120',
        widthIn: '144',
        heightIn: '96',
        wallComplexityId: ' wall_std ',
        notes: '',
        position: 0,
      },
    ],
    [],
    [],
    [],
    [],
    [],
    [],
    []
  )
  const rows = buildV2RoomRosterRows(payload.rooms)
  const persisted = buildV2RoomPersistenceRow({
    ...rows[0],
    org_id: 'org-1',
    estimate_id: 'estimate-1',
    job_id: 'job-1',
  })

  assert.equal(persisted.room_type_id, 'BEDROOM')
  assert.equal(persisted.wall_complexity_id, 'WALL_STD')
})
