import assert from 'node:assert/strict'
import test from 'node:test'
import { validateV2DoorsBeforeSave } from '../v2DoorsValidation.ts'

function makeBaseRoom() {
  return {
    roomId: 'R001',
    roomName: 'Office',
    position: 0,
  }
}

function makeDoorScope() {
  return {
    id: 'door-1',
    roomId: 'R001',
    position: 0,
    include: 'Y' as const,
    doorTypeId: 'DOOR_PANEL',
    quantity: '2',
    sides: '2',
  }
}

test('validateV2DoorsBeforeSave accepts valid included door scopes', () => {
  const issues = validateV2DoorsBeforeSave({
    rooms: [makeBaseRoom()],
    doorScopes: [makeDoorScope()],
  })

  assert.deepEqual(issues, [])
})

test('validateV2DoorsBeforeSave rejects malformed override values and accepts zero', () => {
  const issues = validateV2DoorsBeforeSave({
    rooms: [makeBaseRoom()],
    doorScopes: [
      {
        ...makeDoorScope(),
        overridePaintHours: '0',
        overridePrimerHours: '-1',
        overrideMaterialCost: 'NaN',
        overrideSupplyCost: 'Infinity',
        overrideTotal: '12abc',
      },
    ],
  })

  assert.equal(issues.some((issue) => issue.includes('paint hours override')), false)
  assert.ok(issues.some((issue) => issue.includes('primer hours override')))
  assert.ok(issues.some((issue) => issue.includes('material cost override')))
  assert.ok(issues.some((issue) => issue.includes('supply cost override')))
  assert.ok(issues.some((issue) => issue.includes('total override')))
})

test('validateV2DoorsBeforeSave enforces included door type, quantity, and sides', () => {
  const issues = validateV2DoorsBeforeSave({
    rooms: [makeBaseRoom()],
    doorScopes: [
      {
        ...makeDoorScope(),
        doorTypeId: '',
        quantity: '',
        sides: '',
      },
    ],
  })

  assert.ok(issues.some((issue) => issue.includes('door type is required')))
  assert.ok(issues.some((issue) => issue.includes('door quantity is required')))
  assert.ok(issues.some((issue) => issue.includes('door sides is required')))
})

test('validateV2DoorsBeforeSave enforces numeric nonnegative quantity and sides of 1 or 2', () => {
  const issues = validateV2DoorsBeforeSave({
    rooms: [makeBaseRoom()],
    doorScopes: [
      {
        ...makeDoorScope(),
        quantity: '-1',
        sides: '3',
      },
    ],
  })

  assert.ok(issues.some((issue) => issue.includes('door quantity must be nonnegative')))
  assert.ok(issues.some((issue) => issue.includes('door sides must be 1 or 2')))
})

test('validateV2DoorsBeforeSave skips estimating fields for excluded scopes', () => {
  const issues = validateV2DoorsBeforeSave({
    rooms: [makeBaseRoom()],
    doorScopes: [
      {
        ...makeDoorScope(),
        include: 'N',
        doorTypeId: '',
        quantity: '',
        sides: '',
      },
    ],
  })

  assert.deepEqual(issues, [])
})

test('validateV2DoorsBeforeSave allows incomplete included doors for autosave drafts', () => {
  const issues = validateV2DoorsBeforeSave({
    rooms: [makeBaseRoom()],
    doorScopes: [
      {
        ...makeDoorScope(),
        doorTypeId: '',
        quantity: '',
        sides: '',
      },
    ],
    allowIncomplete: true,
  })

  assert.deepEqual(issues, [])
})
