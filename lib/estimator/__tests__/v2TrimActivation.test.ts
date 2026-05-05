import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildV2TrimActivationDefaults,
  isV2TrimRoomHelperEligible,
} from '../v2TrimActivation.ts'

const helperTrimType = {
  id: 'BASE',
  label: 'Baseboard',
  helper_allowed: true,
}

test('isV2TrimRoomHelperEligible requires RECT rooms and helper-enabled trim types', () => {
  assert.equal(
    isV2TrimRoomHelperEligible({ roomMode: 'RECT', trimTypeHelperAllowed: true }),
    true
  )
  assert.equal(
    isV2TrimRoomHelperEligible({ roomMode: 'RECT', trimTypeHelperAllowed: false }),
    false
  )
  assert.equal(
    isV2TrimRoomHelperEligible({ roomMode: 'SEG', trimTypeHelperAllowed: true }),
    false
  )
})

test('buildV2TrimActivationDefaults uses ROOM_PERIMETER helper for eligible RECT starter rows', () => {
  const result = buildV2TrimActivationDefaults({
    scope: {
      trimTypeId: '',
      scopeName: '',
      measurementMode: 'MANUAL',
      helperSource: '',
      helperValue: '',
      measurementValue: '',
    },
    room: { roomId: 'R001', lengthIn: '156', widthIn: '120' },
    roomMode: 'RECT',
    fallbackTrimType: helperTrimType,
  })

  assert.equal(result.trimTypeId, 'BASE')
  assert.equal(result.scopeName, 'Baseboard')
  assert.equal(result.measurementMode, 'ROOM_HELPER')
  assert.equal(result.helperSource, 'ROOM_PERIMETER')
  assert.equal(result.helperValue, '46')
  assert.equal(result.measurementValue, '')
})

test('buildV2TrimActivationDefaults refreshes ROOM_PERIMETER from current room dimensions', () => {
  const result = buildV2TrimActivationDefaults({
    scope: {
      trimTypeId: 'BASE',
      scopeName: 'Baseboard',
      measurementMode: 'ROOM_HELPER',
      helperSource: 'ROOM_PERIMETER',
      helperValue: '44',
      measurementValue: '',
    },
    room: { roomId: 'R001', lengthIn: '182', widthIn: '146' },
    roomMode: 'RECT',
    trimType: helperTrimType,
  })

  assert.equal(result.measurementMode, 'ROOM_HELPER')
  assert.equal(result.helperSource, 'ROOM_PERIMETER')
  assert.equal(result.helperValue, '54.6667')
})

test('buildV2TrimActivationDefaults falls back to manual measurement outside helper eligibility', () => {
  const result = buildV2TrimActivationDefaults({
    scope: {
      trimTypeId: 'BASE',
      scopeName: 'Baseboard',
      measurementMode: 'MANUAL',
      helperSource: '',
      helperValue: '44',
      measurementValue: '',
    },
    room: { roomId: 'R001', lengthIn: '156', widthIn: '120' },
    roomMode: 'SEG',
    trimType: helperTrimType,
  })

  assert.equal(result.measurementMode, 'MANUAL')
  assert.equal(result.helperSource, '')
  assert.equal(result.helperValue, '44')
  assert.equal(result.measurementValue, '44')
})
