import assert from 'node:assert/strict'
import test from 'node:test'
import { validateV2DrywallBeforeSave } from '../v2DrywallValidation.ts'

function makeBaseRoom() {
  return {
    roomId: 'R001',
    roomName: 'Office',
    position: 0,
  }
}

function makeDrywallRepair() {
  return {
    id: 'drywall-1',
    roomId: 'R001',
    position: 0,
    surface: 'wall' as const,
    repairType: 'flat_wall_crack',
    quantity: '2.5',
  }
}

test('validateV2DrywallBeforeSave accepts valid wall and ceiling repairs', () => {
  const issues = validateV2DrywallBeforeSave({
    rooms: [makeBaseRoom()],
    drywallRepairs: [
      makeDrywallRepair(),
      {
        ...makeDrywallRepair(),
        id: 'drywall-2',
        position: 1,
        surface: 'ceiling',
        repairType: 'ceiling_crack',
        quantity: '1',
      },
    ],
  })

  assert.deepEqual(issues, [])
})

test('validateV2DrywallBeforeSave rejects malformed override totals and accepts zero', () => {
  const zeroIssues = validateV2DrywallBeforeSave({
    rooms: [makeBaseRoom()],
    drywallRepairs: [{ ...makeDrywallRepair(), overrideTotal: '0' }],
  })
  assert.deepEqual(zeroIssues, [])

  const issues = validateV2DrywallBeforeSave({
    rooms: [makeBaseRoom()],
    drywallRepairs: [{ ...makeDrywallRepair(), overrideTotal: '12abc' }],
  })

  assert.ok(issues.some((issue) => issue.includes('total override')))
})

test('validateV2DrywallBeforeSave validates room and repair identity', () => {
  const issues = validateV2DrywallBeforeSave({
    rooms: [makeBaseRoom(), { roomId: 'R002', roomName: 'Closet', position: 1 }],
    drywallRepairs: [
      makeDrywallRepair(),
      { ...makeDrywallRepair(), roomId: 'R002' },
      { ...makeDrywallRepair(), id: 'orphan', roomId: 'missing-room' },
    ],
  })

  assert.ok(issues.some((issue) => issue.includes('duplicate drywall repair id')))
  assert.ok(issues.some((issue) => issue.includes('references missing room')))
})

test('validateV2DrywallBeforeSave enforces repair type, compatible surface, and quantity', () => {
  const issues = validateV2DrywallBeforeSave({
    rooms: [makeBaseRoom()],
    drywallRepairs: [
      {
        ...makeDrywallRepair(),
        repairType: '',
        quantity: '',
      },
      {
        ...makeDrywallRepair(),
        id: 'drywall-2',
        position: 1,
        surface: 'ceiling',
        repairType: 'flat_wall_crack',
        quantity: '-1',
      },
    ],
  })

  assert.ok(issues.some((issue) => issue.includes('drywall repair type is required')))
  assert.ok(issues.some((issue) => issue.includes('drywall quantity is required')))
  assert.ok(issues.some((issue) => issue.includes('drywall repair type is not valid for ceiling')))
  assert.ok(issues.some((issue) => issue.includes('drywall quantity must be nonnegative')))
})

test('validateV2DrywallBeforeSave allows incomplete repairs for autosave drafts', () => {
  const issues = validateV2DrywallBeforeSave({
    rooms: [makeBaseRoom()],
    drywallRepairs: [
      {
        ...makeDrywallRepair(),
        repairType: '',
        quantity: '',
      },
    ],
    allowIncomplete: true,
  })

  assert.deepEqual(issues, [])
})
