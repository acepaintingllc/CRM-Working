import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addRoomMutation,
  applyCeilingRoomModeMutation,
  applyWallRoomModeMutation,
  deleteRoomCascadeMutation,
  moveTrimScopeMutation,
  syncWallCutInFromTrayCeilings,
  stripInvalidTrimHelperModeMutation,
  TRAY_CEILING_WALL_CUT_IN_FACTOR,
  toggleRoomFlagMutation,
  updateRoomDimensionsMutation,
} from '../../../app/crm/estimates/[id]/v2/_lib/estimateV2EditorMutations.ts'
import type {
  EstimateV2CeilingScopeDraft,
  EstimateV2RoomDraft,
  EstimateV2WallScopeDraft,
} from '../../../types/estimator/v2.ts'

function makeRoom(overrides: Partial<EstimateV2RoomDraft> = {}): EstimateV2RoomDraft {
  return {
    id: 'room-1',
    roomId: 'R001',
    roomName: 'Living Room',
    roomTypeId: '',
    lengthIn: '120',
    widthIn: '144',
    heightIn: '108',
    wallComplexityId: '',
    notes: '',
    position: 0,
    ...overrides,
  }
}

function makeWallScope(overrides: Partial<EstimateV2WallScopeDraft> = {}): EstimateV2WallScopeDraft {
  return {
    id: 'wall-r001-main',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: '',
    colorId: 'COLOR1',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'NONE',
    heightIn: '108',
    perimeterIn: '528',
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
    ...overrides,
  }
}

function makeCeilingScope(
  overrides: Partial<EstimateV2CeilingScopeDraft> = {}
): EstimateV2CeilingScopeDraft {
  return {
    id: 'ceiling-r001-main',
    roomId: 'R001',
    position: 0,
    mode: 'RECT',
    include: 'Y',
    scopeName: '',
    colorId: 'COLOR1',
    paintProductId: '',
    primerProductId: '',
    primeMode: 'NONE',
    spotPrimePercent: '',
    ceilingTypeId: '',
    lengthIn: '120',
    widthIn: '144',
    areaSf: '',
    heightFactor: '1',
    complexityFactor: '1',
    ceilingFlagFactor: '1',
    paintCoats: '2',
    primerCoats: '1',
    overrideAreaSqFt: '',
    overridePaintHours: '',
    overridePrimerHours: '',
    overridePaintGallons: '',
    overridePrimerGallons: '',
    overrideSupplyCost: '',
    overrideTotal: '',
    notes: '',
    ...overrides,
  }
}

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

test('updateRoomDimensionsMutation keeps RECT wall perimeter sync working without ceiling scopes', () => {
  const result = updateRoomDimensionsMutation({
    rooms: [makeRoom()],
    scopes: [makeWallScope()],
    roomId: 'R001',
    field: 'lengthIn',
    value: '132',
  })

  const room = result.rooms.find((entry) => entry.roomId === 'R001')
  const wallScope = result.scopes.find((scope) => scope.id === 'wall-r001-main')

  assert.equal(room?.lengthIn, '132')
  assert.equal(wallScope?.perimeterIn, '552')
  assert.equal(result.ceilingScopes, undefined)
})

test('updateRoomDimensionsMutation syncs RECT ceiling geometry even when no RECT wall scope exists', () => {
  const result = updateRoomDimensionsMutation({
    rooms: [makeRoom()],
    scopes: [],
    ceilingScopes: [makeCeilingScope()],
    roomId: 'R001',
    field: 'widthIn',
    value: '156',
  })

  const ceilingScope = result.ceilingScopes?.find((scope) => scope.id === 'ceiling-r001-main')

  assert.equal(result.scopes.length, 0)
  assert.equal(ceilingScope?.lengthIn, '120')
  assert.equal(ceilingScope?.widthIn, '156')
})

test('updateRoomDimensionsMutation syncs both RECT wall and RECT ceiling geometry for the changed room', () => {
  const result = updateRoomDimensionsMutation({
    rooms: [makeRoom()],
    scopes: [makeWallScope()],
    ceilingScopes: [makeCeilingScope({ areaSf: '88' })],
    roomId: 'R001',
    field: 'lengthIn',
    value: '130',
  })

  const wallScope = result.scopes.find((scope) => scope.id === 'wall-r001-main')
  const ceilingScope = result.ceilingScopes?.find((scope) => scope.id === 'ceiling-r001-main')

  assert.equal(wallScope?.perimeterIn, '548')
  assert.equal(ceilingScope?.lengthIn, '130')
  assert.equal(ceilingScope?.widthIn, '144')
  assert.equal(ceilingScope?.areaSf, '88')
})

test('syncWallCutInFromTrayCeilings applies tray top cut-in factor without lowering manual overrides', () => {
  const ceilingScopes = [
    makeCeilingScope({
      ceilingGeometryMode: 'TRAY',
      include: 'Y',
    }),
  ]

  const synced = syncWallCutInFromTrayCeilings({
    wallScopes: [
      makeWallScope(),
      makeWallScope({ id: 'wall-2', cutInTopFactor: '1.3' }),
      makeWallScope({ id: 'wall-3', roomId: 'R002' }),
    ],
    ceilingScopes,
  })

  assert.equal(synced[0].cutInTopFactor, TRAY_CEILING_WALL_CUT_IN_FACTOR)
  assert.equal(synced[1].cutInTopFactor, '1.3')
  assert.equal(synced[2].cutInTopFactor, '1')
})

test('syncWallCutInFromTrayCeilings removes only the default tray top cut-in factor when tray is removed', () => {
  const synced = syncWallCutInFromTrayCeilings({
    wallScopes: [
      makeWallScope({ cutInTopFactor: TRAY_CEILING_WALL_CUT_IN_FACTOR }),
      makeWallScope({ id: 'wall-2', cutInTopFactor: '1.3' }),
    ],
    ceilingScopes: [makeCeilingScope({ ceilingGeometryMode: 'FLAT', include: 'Y' })],
  })

  assert.equal(synced[0].cutInTopFactor, '1')
  assert.equal(synced[1].cutInTopFactor, '1.3')
})

test('syncWallCutInFromTrayCeilings ignores stale tray metadata on SEG ceilings', () => {
  const synced = syncWallCutInFromTrayCeilings({
    wallScopes: [makeWallScope()],
    ceilingScopes: [
      makeCeilingScope({
        mode: 'SEG',
        ceilingGeometryMode: 'TRAY',
        include: 'Y',
      }),
    ],
  })

  assert.equal(synced[0].cutInTopFactor, '1')
})

test('applyCeilingRoomModeMutation forces SEG ceiling scopes to flat', () => {
  const result = applyCeilingRoomModeMutation({
    scopes: [
      makeCeilingScope({
        ceilingTypeId: 'COFFERED',
        ceilingGeometryMode: 'COFFERED',
        cofferSectionLengthIn: '48',
        cofferSectionWidthIn: '36',
        cofferSectionCount: '6',
        cofferFaceHeightIn: '4',
        cofferBottomWidthIn: '3',
      }),
    ],
    segments: [],
    roomId: 'R001',
    nextMode: 'SEG',
    defaultHeightFactor: '1',
  })

  const scope = result.scopes[0]
  assert.equal(scope.mode, 'SEG')
  assert.equal(scope.ceilingTypeId, 'FLAT')
  assert.equal(scope.ceilingGeometryMode, 'FLAT')
  assert.equal(scope.cofferSectionLengthIn, '')
  assert.equal(scope.cofferFaceHeightIn, '')
})

test('updateRoomDimensionsMutation does not overwrite SEG ceiling scopes', () => {
  const result = updateRoomDimensionsMutation({
    rooms: [makeRoom({ id: 'room-2', roomId: 'R002', lengthIn: '96', widthIn: '120' })],
    scopes: [makeWallScope({ id: 'wall-r002-main', roomId: 'R002', mode: 'SEG', perimeterIn: '' })],
    ceilingScopes: [
      makeCeilingScope({
        id: 'ceiling-r002-main',
        roomId: 'R002',
        mode: 'SEG',
        lengthIn: '222',
        widthIn: '333',
        areaSf: '44',
      }),
    ],
    roomId: 'R002',
    field: 'lengthIn',
    value: '101',
  })

  const ceilingScope = result.ceilingScopes?.find((scope) => scope.id === 'ceiling-r002-main')

  assert.equal(ceilingScope?.mode, 'SEG')
  assert.equal(ceilingScope?.lengthIn, '222')
  assert.equal(ceilingScope?.widthIn, '333')
  assert.equal(ceilingScope?.areaSf, '44')
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
        baseboardOpeningCount: '',
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
        baseboardOpeningCount: '',
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
        baseboardOpeningCount: '',
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
        baseboardOpeningCount: '',
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
