import assert from 'node:assert/strict'
import test from 'node:test'
import { validateV2CeilingsBeforeSave } from '../v2CeilingsValidation.ts'

function makeBaseRoom() {
  return { roomId: 'R001', roomName: 'Room 1', position: 0 }
}

function makeRectScope() {
  return {
    id: 'scope-1',
    roomId: 'R001',
    position: 0,
    mode: 'RECT' as const,
    include: 'Y' as const,
    lengthIn: '144',
    widthIn: '120',
    areaSf: '',
  }
}

test('validation passes for minimal valid RECT setup (length + width)', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [makeBaseRoom()],
    ceilingScopes: [makeRectScope()],
    ceilingSegments: [],
  })
  assert.deepEqual(issues, [])
})

test('validation passes when RECT uses direct areaSf instead of L×W', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [makeBaseRoom()],
    ceilingScopes: [{ ...makeRectScope(), lengthIn: '', widthIn: '', areaSf: '200' }],
    ceilingSegments: [],
  })
  assert.deepEqual(issues, [])
})

test('validation catches mixed mode, duplicate IDs, orphan segment, and missing SEG segment', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [makeBaseRoom()],
    ceilingScopes: [
      // Two scopes with same id → duplicate; RECT + SEG → mixed mode + RECT count error
      { ...makeRectScope(), id: 'scope-dup', mode: 'RECT' },
      { ...makeRectScope(), id: 'scope-dup', mode: 'SEG', include: 'Y' },
    ],
    ceilingSegments: [
      // Orphan: references a scope id that doesn't exist
      {
        id: 'seg-orphan',
        ceilingScopeId: 'missing-scope',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'MANUAL' as const,
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '10',
      },
      // Belongs to scope-dup (SEG, include=N) — scope has no included segments
      {
        id: 'seg-excluded',
        ceilingScopeId: 'scope-dup',
        roomId: 'R001',
        include: 'N',
        shapeType: 'MANUAL' as const,
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '20',
      },
    ],
  })

  assert.ok(issues.some((i) => i.includes('all ceiling scopes must use the same mode')))
  assert.ok(issues.some((i) => i.includes('RECT mode allows only one ceiling scope')))
  assert.ok(issues.some((i) => i.includes('duplicate ceiling scope id')))
  assert.ok(issues.some((i) => i.includes('references missing scope')))
  assert.ok(issues.some((i) => i.includes('SEG ceiling scope requires at least one included segment')))
})

test('validation enforces SEG shape fields and quantity > 0', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [makeBaseRoom()],
    ceilingScopes: [{ ...makeRectScope(), id: 'scope-seg', mode: 'SEG' }],
    ceilingSegments: [
      {
        id: 'seg-rect',
        ceilingScopeId: 'scope-seg',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'RECTANGLE' as const,
        quantity: '0',    // invalid: must be > 0
        widthIn: '',      // missing: RECTANGLE requires width
        heightIn: '90',
        baseIn: '',
        manualAreaSqFt: '',
      },
      {
        id: 'seg-tri',
        ceilingScopeId: 'scope-seg',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'TRIANGLE' as const,
        quantity: '1',
        widthIn: '',
        heightIn: '96',
        baseIn: '',       // missing: TRIANGLE requires base
        manualAreaSqFt: '',
      },
    ],
  })

  assert.ok(issues.some((i) => i.includes('segment quantity must be greater than 0')))
  assert.ok(issues.some((i) => i.includes('rectangle ceiling segments require width and height')))
  assert.ok(issues.some((i) => i.includes('triangle ceiling segments require base and height')))
})

test('validation catches room metadata and ceiling ID issues', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [
      { roomId: 'R001', roomName: '', position: 0 },
      { roomId: 'R001', roomName: 'Duplicate', position: 1 },
    ],
    ceilingScopes: [
      { ...makeRectScope(), id: '', mode: 'SEG', include: 'N', lengthIn: '', widthIn: '', areaSf: '' },
      { ...makeRectScope(), id: 'scope-ok', mode: 'SEG', include: 'N', lengthIn: '', widthIn: '', areaSf: '' },
    ],
    ceilingSegments: [
      {
        id: '',
        ceilingScopeId: 'scope-ok',
        roomId: 'R001',
        include: 'N',
        shapeType: 'MANUAL' as const,
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '10',
      },
      {
        id: 'seg-dup',
        ceilingScopeId: 'scope-ok',
        roomId: 'R001',
        include: 'N',
        shapeType: 'MANUAL' as const,
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '10',
      },
      {
        id: 'seg-dup',
        ceilingScopeId: 'scope-ok',
        roomId: 'R001',
        include: 'N',
        shapeType: 'MANUAL' as const,
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '10',
      },
    ],
  })

  assert.ok(issues.some((i) => i.includes('room name is required')))
  assert.ok(issues.some((i) => i.includes('duplicate room id')))
  assert.ok(issues.some((i) => i.includes('ceiling scope id is required')))
  assert.ok(issues.some((i) => i.includes('ceiling segment id is required')))
  assert.ok(issues.some((i) => i.includes('duplicate ceiling segment id')))
})

test('validation requires area for MANUAL ceiling segments', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [makeBaseRoom()],
    ceilingScopes: [{ ...makeRectScope(), id: 'scope-manual', mode: 'SEG' }],
    ceilingSegments: [
      {
        id: 'seg-manual',
        ceilingScopeId: 'scope-manual',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'MANUAL' as const,
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '',
      },
    ],
  })

  assert.ok(issues.some((i) => i.includes('manual ceiling segments require area')))
})

test('validation allows incomplete SEG ceiling geometry for autosave drafts', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [makeBaseRoom()],
    ceilingScopes: [{ ...makeRectScope(), id: 'scope-seg', mode: 'SEG' }],
    ceilingSegments: [
      {
        id: 'seg-manual',
        ceilingScopeId: 'scope-seg',
        roomId: 'R001',
        include: 'Y',
        shapeType: 'MANUAL' as const,
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

test('validation skips RECT/SEG required geometry checks when scope include=N', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [
      { roomId: 'R001', roomName: 'Room 1', position: 0 },
      { roomId: 'R002', roomName: 'Room 2', position: 1 },
    ],
    ceilingScopes: [
      {
        ...makeRectScope(),
        id: 'scope-rect-excluded',
        roomId: 'R001',
        include: 'N',
        mode: 'RECT',
        lengthIn: '',
        widthIn: '',
        areaSf: '',
      },
      {
        ...makeRectScope(),
        id: 'scope-seg-excluded',
        roomId: 'R002',
        include: 'N',
        mode: 'SEG',
        lengthIn: '',
        widthIn: '',
        areaSf: '',
      },
    ],
    ceilingSegments: [
      {
        id: 'seg-excluded',
        ceilingScopeId: 'scope-seg-excluded',
        roomId: 'R002',
        include: 'Y',
        shapeType: 'MANUAL' as const,
        quantity: '',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '',
      },
    ],
  })

  assert.deepEqual(issues, [])
})

test('validation rejects malformed ceiling override values and accepts zero', () => {
  const issues = validateV2CeilingsBeforeSave({
    rooms: [makeBaseRoom()],
    ceilingScopes: [
      {
        ...makeRectScope(),
        overrideAreaSqFt: '0',
        overridePaintHours: '-1',
        overridePrimerHours: 'NaN',
        overrideSupplyCost: 'Infinity',
        overrideTotal: '12abc',
      },
    ],
    ceilingSegments: [
      {
        id: 'seg-override',
        ceilingScopeId: 'scope-1',
        roomId: 'R001',
        include: 'N',
        shapeType: 'MANUAL',
        quantity: '',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '',
        overrideAreaSqFt: '-0.5',
      },
    ],
  })

  assert.equal(issues.some((issue) => issue.includes('ceiling scope scope-1: area override')), false)
  assert.ok(issues.some((issue) => issue.includes('paint hours override')))
  assert.ok(issues.some((issue) => issue.includes('primer hours override')))
  assert.ok(issues.some((issue) => issue.includes('supply cost override')))
  assert.ok(issues.some((issue) => issue.includes('total override')))
  assert.ok(issues.some((issue) => issue.includes('ceiling segment seg-override: area override')))
})
