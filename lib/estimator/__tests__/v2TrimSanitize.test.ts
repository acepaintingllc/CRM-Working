import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeV2TrimDrafts } from '../v2TrimSanitize.ts'

test('sanitizeV2TrimDrafts reorders rows and strips helper mode in SEG rooms', () => {
  const result = sanitizeV2TrimDrafts({
    rooms: [
      { roomId: 'R001', mode: 'SEG', position: 0 },
      { roomId: 'R002', mode: 'RECT', position: 1 },
    ],
    trimScopes: [
      {
        id: 'T1',
        roomId: 'R001',
        position: 3,
        measurementMode: 'ROOM_HELPER',
        helperSource: 'ROOM_PERIMETER',
        helperValue: '100',
      },
      {
        id: 'T2',
        roomId: 'R002',
        position: 5,
        measurementMode: 'ROOM_HELPER',
        helperSource: null,
        helperValue: '',
      },
    ],
  })

  assert.equal(result.changed, true)
  assert.equal(result.trimScopes[0].id, 'T1')
  assert.equal(result.trimScopes[0].position, 0)
  assert.equal(result.trimScopes[0].measurementMode, 'MANUAL')
  assert.equal(result.trimScopes[0].helperSource, null)
  assert.equal(result.trimScopes[0].helperValue, '')

  assert.equal(result.trimScopes[1].id, 'T2')
  assert.equal(result.trimScopes[1].position, 0)
  assert.equal(result.trimScopes[1].measurementMode, 'ROOM_HELPER')
  assert.equal(result.trimScopes[1].helperSource, 'ROOM_PERIMETER')
})
