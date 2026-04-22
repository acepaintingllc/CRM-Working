import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addRoomMutation,
  applyWallRoomModeMutation,
  deleteRoomCascadeMutation,
  moveTrimScopeMutation,
  stripInvalidTrimHelperModeMutation,
  toggleRoomFlagMutation,
} from '../../../app/crm/quotes/[id]/_lib/estimateV2EditorMutations.ts'

test('addRoomMutation appends a room and seeds one RECT wall scope', () => {
  const result = addRoomMutation({
    rooms: [],
    defaultHeightFactor: '1.15',
  })

  assert.equal(result.rooms.length, 1)
  assert.equal(result.room.roomId, 'R001')
  assert.equal(result.scopes.length, 1)
  assert.equal(result.scopes[0].roomId, result.room.roomId)
  assert.equal(result.scopes[0].mode, 'RECT')
  assert.equal(result.scopes[0].heightFactor, '1.15')
})

test('deleteRoomCascadeMutation removes room-owned rows and reindexes survivors', () => {
  const result = deleteRoomCascadeMutation({
    rooms: [
      {
        id: 'room-1',
        roomId: 'R001',
        roomName: 'Living',
        roomTypeId: '',
        lengthIn: '',
        widthIn: '',
        heightIn: '',
        wallComplexityId: '',
        notes: '',
        position: 0,
      },
      {
        id: 'room-2',
        roomId: 'R002',
        roomName: 'Office',
        roomTypeId: '',
        lengthIn: '',
        widthIn: '',
        heightIn: '',
        wallComplexityId: '',
        notes: '',
        position: 1,
      },
    ],
    scopes: [
      {
        id: 'scope-1',
        roomId: 'R001',
        position: 0,
        mode: 'RECT',
        include: 'Y',
        scopeName: '',
        colorId: 'COLOR1',
        paintProductId: '',
        primerProductId: '',
        primeMode: 'NONE',
        heightIn: '',
        perimeterIn: '',
        standardDoorCount: '',
        standardWindowCount: '',
        heightFactor: '1',
        complexityFactor: '1',
        wallFlagFactor: '1',
        cutInTopFactor: '1',
        cutInBottomFactor: '1',
        paintCoats: '2',
        primerCoats: '1',
        spotPrimePercent: '',
        overrideAreaSqFt: '',
        overridePaintHours: '',
        overridePrimerHours: '',
        overridePaintGallons: '',
        overridePrimerGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        notes: '',
      },
    ],
    segments: [
      {
        id: 'segment-1',
        wallScopeId: 'scope-1',
        roomId: 'R001',
        position: 0,
        segmentName: '',
        include: 'Y',
        shapeType: 'RECTANGLE',
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '',
        standardDoorCount: '',
        standardWindowCount: '',
        overrideAreaSqFt: '',
        notes: '',
      },
    ],
    roomFlags: [{ id: 'flag-1', roomId: 'R001', flagId: 'FLAG', position: 0 }],
    ceilingScopes: [],
    ceilingSegments: [],
    trimScopes: [
      {
        id: 'trim-1',
        roomId: 'R001',
        position: 0,
        include: 'Y',
        scopeName: '',
        trimTypeId: '',
        trimFamily: '',
        unitType: 'LF',
        measurementMode: 'MANUAL',
        helperSource: '',
        measurementValue: '',
        helperValue: '',
        colorId: '',
        paintProductId: '',
        primerProductId: '',
        paintEnabled: 'Y',
        primeMode: 'NONE',
        spotPrimePercent: '',
        productionRateId: '',
        prepFactor: '1',
        heightFactor: '1',
        profileFactor: '1',
        roomFlagFactor: '1',
        maskingFactor: '1',
        stairFactor: '1',
        difficultFinishFactor: '1',
        caulkFillFactor: '1',
        paintCoats: '2',
        primerCoats: '1',
        overrideMeasurement: '',
        overrideHours: '',
        overrideGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        overrideDescription: '',
        notes: '',
      },
    ],
    roomId: 'R001',
    selectedRoomId: 'R001',
  })

  assert.deepEqual(result.rooms.map((room) => [room.roomId, room.position]), [['R002', 0]])
  assert.equal(result.scopes.length, 0)
  assert.equal(result.segments.length, 0)
  assert.equal(result.roomFlags.length, 0)
  assert.equal(result.trimScopes.length, 0)
  assert.equal(result.selectedRoomId, 'R002')
})

test('applyWallRoomModeMutation resets SEG rooms back to a single RECT scope', () => {
  const result = applyWallRoomModeMutation({
    scopes: [
      {
        id: 'scope-1',
        roomId: 'R001',
        position: 0,
        mode: 'SEG',
        include: 'Y',
        scopeName: '',
        colorId: 'COLOR1',
        paintProductId: '',
        primerProductId: '',
        primeMode: 'NONE',
        heightIn: '',
        perimeterIn: '',
        standardDoorCount: '',
        standardWindowCount: '',
        heightFactor: '1',
        complexityFactor: '1',
        wallFlagFactor: '1',
        cutInTopFactor: '1',
        cutInBottomFactor: '1',
        paintCoats: '2',
        primerCoats: '1',
        spotPrimePercent: '',
        overrideAreaSqFt: '',
        overridePaintHours: '',
        overridePrimerHours: '',
        overridePaintGallons: '',
        overridePrimerGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        notes: '',
      },
      {
        id: 'scope-2',
        roomId: 'R001',
        position: 1,
        mode: 'SEG',
        include: 'Y',
        scopeName: '',
        colorId: 'COLOR1',
        paintProductId: '',
        primerProductId: '',
        primeMode: 'NONE',
        heightIn: '',
        perimeterIn: '',
        standardDoorCount: '',
        standardWindowCount: '',
        heightFactor: '1',
        complexityFactor: '1',
        wallFlagFactor: '1',
        cutInTopFactor: '1',
        cutInBottomFactor: '1',
        paintCoats: '2',
        primerCoats: '1',
        spotPrimePercent: '',
        overrideAreaSqFt: '',
        overridePaintHours: '',
        overridePrimerHours: '',
        overridePaintGallons: '',
        overridePrimerGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        notes: '',
      },
    ],
    segments: [
      {
        id: 'segment-1',
        wallScopeId: 'scope-1',
        roomId: 'R001',
        position: 0,
        segmentName: '',
        include: 'Y',
        shapeType: 'RECTANGLE',
        quantity: '1',
        widthIn: '',
        heightIn: '',
        baseIn: '',
        manualAreaSqFt: '',
        standardDoorCount: '',
        standardWindowCount: '',
        overrideAreaSqFt: '',
        notes: '',
      },
    ],
    roomId: 'R001',
    nextMode: 'RECT',
    defaultHeightFactor: '1.25',
  })

  assert.equal(result.scopes.length, 1)
  assert.equal(result.scopes[0].mode, 'RECT')
  assert.equal(result.scopes[0].roomId, 'R001')
  assert.equal(result.scopes[0].heightFactor, '1.25')
  assert.equal(result.segments.length, 0)
})

test('moveTrimScopeMutation reorders scopes within the room', () => {
  const reordered = moveTrimScopeMutation({
    scopes: [
      {
        id: 'trim-1',
        roomId: 'R001',
        position: 0,
        include: 'Y',
        scopeName: 'Base',
        trimTypeId: '',
        trimFamily: '',
        unitType: 'LF',
        measurementMode: 'MANUAL',
        helperSource: '',
        measurementValue: '',
        helperValue: '',
        colorId: '',
        paintProductId: '',
        primerProductId: '',
        paintEnabled: 'Y',
        primeMode: 'NONE',
        spotPrimePercent: '',
        productionRateId: '',
        prepFactor: '1',
        heightFactor: '1',
        profileFactor: '1',
        roomFlagFactor: '1',
        maskingFactor: '1',
        stairFactor: '1',
        difficultFinishFactor: '1',
        caulkFillFactor: '1',
        paintCoats: '2',
        primerCoats: '1',
        overrideMeasurement: '',
        overrideHours: '',
        overrideGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        overrideDescription: '',
        notes: '',
      },
      {
        id: 'trim-2',
        roomId: 'R001',
        position: 1,
        include: 'Y',
        scopeName: 'Crown',
        trimTypeId: '',
        trimFamily: '',
        unitType: 'LF',
        measurementMode: 'MANUAL',
        helperSource: '',
        measurementValue: '',
        helperValue: '',
        colorId: '',
        paintProductId: '',
        primerProductId: '',
        paintEnabled: 'Y',
        primeMode: 'NONE',
        spotPrimePercent: '',
        productionRateId: '',
        prepFactor: '1',
        heightFactor: '1',
        profileFactor: '1',
        roomFlagFactor: '1',
        maskingFactor: '1',
        stairFactor: '1',
        difficultFinishFactor: '1',
        caulkFillFactor: '1',
        paintCoats: '2',
        primerCoats: '1',
        overrideMeasurement: '',
        overrideHours: '',
        overrideGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        overrideDescription: '',
        notes: '',
      },
    ],
    roomId: 'R001',
    scopeId: 'trim-2',
    direction: -1,
  })

  const roomScopes = reordered.filter((scope) => scope.roomId === 'R001')
  assert.deepEqual(roomScopes.map((scope) => [scope.id, scope.position]), [
    ['trim-2', 0],
    ['trim-1', 1],
  ])
})

test('stripInvalidTrimHelperModeMutation removes helper mode for SEG rooms', () => {
  const next = stripInvalidTrimHelperModeMutation({
    scopes: [
      {
        id: 'trim-1',
        roomId: 'R001',
        position: 0,
        include: 'Y',
        scopeName: 'Base',
        trimTypeId: 'BASE',
        trimFamily: 'BASEBOARD',
        unitType: 'LF',
        measurementMode: 'ROOM_HELPER',
        helperSource: 'ROOM_PERIMETER',
        measurementValue: '',
        helperValue: '100',
        colorId: '',
        paintProductId: '',
        primerProductId: '',
        paintEnabled: 'Y',
        primeMode: 'NONE',
        spotPrimePercent: '',
        productionRateId: '',
        prepFactor: '1',
        heightFactor: '1',
        profileFactor: '1',
        roomFlagFactor: '1',
        maskingFactor: '1',
        stairFactor: '1',
        difficultFinishFactor: '1',
        caulkFillFactor: '1',
        paintCoats: '2',
        primerCoats: '1',
        overrideMeasurement: '',
        overrideHours: '',
        overrideGallons: '',
        overrideSupplyCost: '',
        overrideTotal: '',
        overrideDescription: '',
        notes: '',
      },
    ],
    roomModeById: new Map([['R001', 'SEG']]),
    trimTypeOptions: [{ id: 'BASE', label: 'Base', family: 'BASEBOARD', category: null, unit_type: 'LF', helper_allowed: true, default_production_rate_id: null }],
  })

  assert.equal(next[0].measurementMode, 'MANUAL')
  assert.equal(next[0].helperSource, '')
  assert.equal(next[0].helperValue, '')
})

test('toggleRoomFlagMutation adds and removes the same flag cleanly', () => {
  const added = toggleRoomFlagMutation([], 'R001', 'FLAG-1')
  assert.equal(added.length, 1)
  assert.equal(added[0].position, 0)

  const removed = toggleRoomFlagMutation(added, 'R001', 'FLAG-1')
  assert.equal(removed.length, 0)
})
