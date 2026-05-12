import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyEstimateJobTemplate,
  applyEstimateRoomTemplate,
  createEstimateJobTemplateData,
  createEstimateRoomTemplateData,
  normalizeEstimateTemplateMutationBody,
  type EstimateTemplateCollections,
} from '../v2Templates.ts'
import type {
  EstimateV2JobSettingsDraft,
  EstimateV2RoomDraft,
  EstimateV2WallScopeDraft,
  EstimateV2WallSegmentDraft,
} from '../../../types/estimator/v2.ts'

function ids(...values: string[]) {
  let index = 0
  return () => values[index++] ?? `id-${index}`
}

function emptyCollections(overrides: Partial<EstimateTemplateCollections> = {}): EstimateTemplateCollections {
  return {
    rooms: [],
    wallScopes: [],
    wallSegments: [],
    roomFlags: [],
    ceilingScopes: [],
    ceilingSegments: [],
    trimScopes: [],
    doorScopes: [],
    drywallRepairs: [],
    rollers: [],
    accessFees: [],
    otherItems: [],
    prejobTrips: [],
    ...overrides,
  }
}

function room(overrides: Partial<EstimateV2RoomDraft> = {}): EstimateV2RoomDraft {
  return {
    id: 'room-row-1',
    roomId: 'R001',
    roomName: 'Bedroom',
    roomTypeId: 'BEDROOM',
    lengthIn: '120',
    widthIn: '144',
    heightIn: '96',
    wallComplexityId: '',
    notes: '',
    position: 0,
    conditionSelections: {},
    ...overrides,
  }
}

function wallScope(overrides: Partial<EstimateV2WallScopeDraft> = {}): EstimateV2WallScopeDraft {
  return {
    id: 'wall-scope-1',
    roomId: 'R001',
    position: 0,
    mode: 'SEG',
    include: 'Y',
    scopeName: 'Walls',
    colorId: 'COLOR1',
    paintProductId: 'paint-1',
    primerProductId: '',
    primeMode: 'NONE',
    heightIn: '96',
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
    conditionSelections: {},
    ...overrides,
  }
}

function wallSegment(overrides: Partial<EstimateV2WallSegmentDraft> = {}): EstimateV2WallSegmentDraft {
  return {
    id: 'wall-segment-1',
    wallScopeId: 'wall-scope-1',
    roomId: 'R001',
    position: 0,
    segmentName: 'North',
    include: 'Y',
    shapeType: 'RECTANGLE',
    quantity: '1',
    widthIn: '120',
    heightIn: '96',
    baseIn: '',
    manualAreaSqFt: '',
    standardDoorCount: '',
    standardWindowCount: '',
    overrideAreaSqFt: '',
    notes: '',
    ...overrides,
  }
}

function jobSettings(overrides: Partial<EstimateV2JobSettingsDraft> = {}): EstimateV2JobSettingsDraft {
  return {
    laborDayEnabled: true,
    dayhours: 8,
    roundingIncrementHours: 4,
    laborRate: 85,
    jobMinEnabled: true,
    jobMinAmount: 1200,
    crewSize: 2,
    wallPaintProductId: '',
    wallPrimerProductId: '',
    ceilingPaintProductId: '',
    ceilingPrimerProductId: '',
    trimPaintProductId: '',
    trimPrimerProductId: '',
    ...overrides,
  }
}

test('room templates clone row identifiers and relink nested wall segments into a new room', () => {
  const source = emptyCollections({
    rooms: [room()],
    wallScopes: [wallScope()],
    wallSegments: [wallSegment()],
  })
  const template = createEstimateRoomTemplateData({
    room: source.rooms[0],
    collections: source,
  })

  const result = applyEstimateRoomTemplate({
    collections: emptyCollections(),
    template,
    mode: 'new_room',
    createId: ids('new-room-row', 'new-scope', 'new-segment'),
  })

  assert.equal(result.selectedRoomId, 'R001')
  assert.equal(result.collections.rooms[0].id, 'new-room-row')
  assert.equal(result.collections.wallScopes[0].id, 'new-scope')
  assert.equal(result.collections.wallSegments[0].id, 'new-segment')
  assert.equal(result.collections.wallSegments[0].wallScopeId, 'new-scope')
})

test('fill blanks preserves existing room values and only copies missing room-level data', () => {
  const template = createEstimateRoomTemplateData({
    room: room({ roomName: 'Template Bedroom', roomTypeId: 'BEDROOM', lengthIn: '120' }),
    collections: emptyCollections(),
  })
  const current = emptyCollections({
    rooms: [room({ roomName: 'Existing Room', roomTypeId: '', lengthIn: '' })],
  })

  const result = applyEstimateRoomTemplate({
    collections: current,
    template,
    mode: 'fill_blanks',
    targetRoomId: 'R001',
    createId: ids('unused'),
  })

  assert.equal(result.collections.rooms[0].roomName, 'Existing Room')
  assert.equal(result.collections.rooms[0].roomTypeId, 'BEDROOM')
  assert.equal(result.collections.rooms[0].lengthIn, '120')
})

test('replace room removes nested rows for only the targeted room', () => {
  const template = createEstimateRoomTemplateData({
    room: room({ roomName: 'Template Room' }),
    collections: emptyCollections({
      wallScopes: [wallScope()],
      wallSegments: [wallSegment()],
    }),
  })
  const current = emptyCollections({
    rooms: [room({ roomId: 'R001' }), room({ id: 'room-row-2', roomId: 'R002' })],
    wallScopes: [wallScope({ roomId: 'R001' }), wallScope({ id: 'keep-scope', roomId: 'R002' })],
    wallSegments: [
      wallSegment({ roomId: 'R001' }),
      wallSegment({ id: 'keep-segment', wallScopeId: 'keep-scope', roomId: 'R002' }),
    ],
  })

  const result = applyEstimateRoomTemplate({
    collections: current,
    template,
    mode: 'replace_room',
    targetRoomId: 'R001',
    createId: ids('replacement-room', 'replacement-scope', 'replacement-segment'),
  })

  assert.equal(result.collections.rooms.length, 2)
  assert.equal(result.collections.rooms.find((entry) => entry.roomId === 'R001')?.id, 'replacement-room')
  assert.ok(result.collections.wallScopes.some((entry) => entry.id === 'keep-scope'))
  assert.ok(result.collections.wallSegments.some((entry) => entry.id === 'keep-segment'))
  assert.ok(result.collections.wallScopes.some((entry) => entry.id === 'replacement-scope'))
})

test('job templates replace drafts with cloned room graph and preserve template settings snapshot', () => {
  const source = emptyCollections({
    rooms: [room()],
    wallScopes: [wallScope()],
    wallSegments: [wallSegment()],
  })
  const template = createEstimateJobTemplateData({
    collections: source,
    jobSettingsDraft: jobSettings({ wallPaintProductId: 'paint-1' }),
  })

  const result = applyEstimateJobTemplate({
    collections: emptyCollections({ rooms: [room({ roomName: 'Old' })] }),
    jobSettingsDraft: jobSettings(),
    template,
    mode: 'replace_job',
    createId: ids('room-row', 'scope-row', 'segment-row'),
  })

  assert.equal(result.collections.rooms.length, 1)
  assert.equal(result.collections.rooms[0].id, 'room-row')
  assert.equal(result.collections.wallSegments[0].wallScopeId, 'scope-row')
  assert.equal(result.jobSettingsDraft?.wallPaintProductId, 'paint-1')
})

test('template mutation normalization rejects invalid data and preserves snapshot labels', () => {
  const valid = normalizeEstimateTemplateMutationBody({
    kind: 'room',
    name: 'Bedrooms',
    template_data: createEstimateRoomTemplateData({
      room: room(),
      collections: emptyCollections(),
      snapshotLabels: { 'paint-1': 'Emerald Interior' },
    }),
  })

  assert.equal(valid.ok, true)
  if (valid.ok) {
    assert.equal(valid.payload.snapshot_labels['paint-1'], 'Emerald Interior')
  }

  assert.deepEqual(normalizeEstimateTemplateMutationBody({ kind: 'room', name: '' }), {
    ok: false,
    message: 'Template name is required.',
  })
})
