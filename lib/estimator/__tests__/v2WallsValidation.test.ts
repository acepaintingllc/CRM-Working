import assert from 'node:assert/strict'
import test from 'node:test'
import { validateV2WallsBeforeSave } from '../v2WallsValidation.ts'

function makeBaseRoom() {
  return {
    roomId: 'R001',
    roomName: 'Room 1',
    position: 0,
  }
}

function makeRectScope() {
  return {
    id: 'scope-1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT' as const,
    include: 'Y' as const,
    perimeterIn: '400',
    heightIn: '96',
  }
}

test('validation passes for minimal valid RECT setup', () => {
  const issues = validateV2WallsBeforeSave({
    rooms: [makeBaseRoom()],
    scopes: [makeRectScope()],
    segments: [],
  })
  assert.deepEqual(issues, [])
})

test('validation catches mixed room scope mode and multiple RECT scopes', () => {
  const issues = validateV2WallsBeforeSave({
    rooms: [makeBaseRoom()],
    scopes: [
      makeRectScope(),
      {
        ...makeRectScope(),
        id: 'scope-2',
        mode: 'SEG',
      },
    ],
    segments: [],
  })
  assert.ok(issues.some((issue) => issue.includes('all wall scopes must use the same mode')))
  assert.ok(issues.some((issue) => issue.includes('RECT mode allows only one wall scope')))
})

test('validation catches orphan/duplicate IDs and SEG missing included segment', () => {
  const issues = validateV2WallsBeforeSave({
    rooms: [makeBaseRoom()],
    scopes: [
      {
        ...makeRectScope(),
        id: 'scope-dup',
        mode: 'SEG',
        perimeterIn: '',
      },
      {
        ...makeRectScope(),
        id: 'scope-dup',
        mode: 'SEG',
        include: 'N',
      },
    ],
    segments: [
      {
        id: 'seg-1',
        wallScopeId: 'missing-scope',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'MANUAL',
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '22',
      },
      {
        id: 'seg-1',
        wallScopeId: 'scope-dup',
        roomId: 'R001',
        include: 'N',
        shapeType: 'MANUAL',
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '',
      },
    ],
  })

  assert.ok(issues.some((issue) => issue.includes('duplicate wall scope id')))
  assert.ok(issues.some((issue) => issue.includes('duplicate segment id')))
  assert.ok(issues.some((issue) => issue.includes('references missing scope')))
  assert.ok(issues.some((issue) => issue.includes('SEG scope requires at least one included segment')))
  assert.ok(issues.some((issue) => issue.includes('manual segments require area')))
})

test('validation enforces SEG shape fields and quantity rules', () => {
  const issues = validateV2WallsBeforeSave({
    rooms: [makeBaseRoom()],
    scopes: [
      {
        ...makeRectScope(),
        id: 'scope-seg',
        mode: 'SEG',
      },
    ],
    segments: [
      {
        id: 'seg-r',
        wallScopeId: 'scope-seg',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'RECTANGLE',
        quantity: '0',
        widthIn: '',
        heightIn: '90',
        baseIn: '',
        manualAreaSqFt: '',
      },
      {
        id: 'seg-t',
        wallScopeId: 'scope-seg',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'TRIANGLE',
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '',
      },
    ],
  })

  assert.ok(issues.some((issue) => issue.includes('segment quantity must be greater than 0')))
  assert.ok(issues.some((issue) => issue.includes('rectangle segments require width and height')))
  assert.ok(issues.some((issue) => issue.includes('triangle segments require base and height')))
})

test('validation allows incomplete SEG geometry for autosave drafts', () => {
  const issues = validateV2WallsBeforeSave({
    rooms: [makeBaseRoom()],
    scopes: [
      {
        ...makeRectScope(),
        id: 'scope-seg',
        mode: 'SEG',
      },
    ],
    segments: [
      {
        id: 'seg-r',
        wallScopeId: 'scope-seg',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'RECTANGLE',
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '',
      },
    ],
    allowIncomplete: true,
  })

  assert.deepEqual(issues, [])
})
