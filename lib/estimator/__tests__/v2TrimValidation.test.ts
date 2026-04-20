import assert from 'node:assert/strict'
import test from 'node:test'
import { validateV2TrimBeforeSave } from '../v2TrimValidation.ts'

test('validateV2TrimBeforeSave accepts valid manual and helper rows', () => {
  const issues = validateV2TrimBeforeSave({
    rooms: [
      { roomId: 'R001', roomName: 'Office', mode: 'RECT', position: 0 },
    ],
    trimScopes: [
      {
        id: 'T1',
        roomId: 'R001',
        position: 0,
        include: 'Y',
        trimTypeId: 'BASE_STD',
        measurementMode: 'MANUAL',
        helperSource: null,
        measurementValue: '45',
      },
      {
        id: 'T2',
        roomId: 'R001',
        position: 1,
        include: 'Y',
        trimTypeId: 'CROWN_STD',
        measurementMode: 'ROOM_HELPER',
        helperSource: 'ROOM_PERIMETER',
        measurementValue: '',
      },
    ],
  })

  assert.deepEqual(issues, [])
})

test('validateV2TrimBeforeSave flags missing measurement and invalid helper mode', () => {
  const issues = validateV2TrimBeforeSave({
    rooms: [
      { roomId: 'R001', roomName: 'Hall', mode: 'SEG', position: 0 },
    ],
    trimScopes: [
      {
        id: 'T1',
        roomId: 'R001',
        position: 0,
        include: 'Y',
        trimTypeId: '',
        measurementMode: 'MANUAL',
        helperSource: null,
        measurementValue: '',
      },
      {
        id: 'T2',
        roomId: 'R001',
        position: 1,
        include: 'Y',
        trimTypeId: 'BASE_STD',
        measurementMode: 'ROOM_HELPER',
        helperSource: 'ROOM_PERIMETER',
        measurementValue: '',
      },
    ],
  })

  assert.ok(issues.some((issue) => issue.includes('trim type is required')))
  assert.ok(issues.some((issue) => issue.includes('trim measurement must be greater than 0')))
  assert.ok(issues.some((issue) => issue.includes('ROOM_HELPER is only allowed in RECT rooms')))
})
