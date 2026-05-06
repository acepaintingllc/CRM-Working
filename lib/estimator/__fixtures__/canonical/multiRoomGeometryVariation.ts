import {
  buildCanonicalEditorState,
  CANONICAL_IDS,
  ceilingScope,
  ceilingSegment,
  room,
  trimScope,
  wallScope,
  wallSegment,
  type EstimateV2CanonicalFixture,
} from '../estimateV2CanonicalFixtureTypes.ts'

export const scenarioName = 'Multi-room with geometry variation'
export const scenarioDescription =
  'Three rooms combining rectangular, segmented rectangle, triangle, manual, and disabled geometry paths.'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'multi-room-geometry-variation',
  scenarioName,
  rooms: [
    room({ roomId: CANONICAL_IDS.rooms.livingRoom, roomName: 'Living Room', position: 0 }),
    room({
      id: 'room-dining',
      roomId: CANONICAL_IDS.rooms.diningRoom,
      roomName: 'Dining Room',
      lengthIn: '132',
      widthIn: '120',
      heightIn: '96',
      position: 1,
    }),
    room({
      id: 'room-bedroom',
      roomId: CANONICAL_IDS.rooms.bedroom,
      roomName: 'Bedroom',
      lengthIn: '126',
      widthIn: '96',
      heightIn: '96',
      position: 2,
    }),
  ],
  wallScopes: [
    wallScope({ id: 'wall-multi-living', roomId: CANONICAL_IDS.rooms.livingRoom, perimeterIn: '480', heightIn: '96' }),
    wallScope({ id: 'wall-multi-dining', roomId: CANONICAL_IDS.rooms.diningRoom, mode: 'SEG', heightIn: '', perimeterIn: '' }),
    wallScope({ id: 'wall-multi-bedroom-disabled', roomId: CANONICAL_IDS.rooms.bedroom, include: 'N', position: 2 }),
  ],
  wallSegments: [
    wallSegment({
      id: 'wall-seg-dining-rectangles',
      wallScopeId: 'wall-multi-dining',
      roomId: CANONICAL_IDS.rooms.diningRoom,
      quantity: '2',
      widthIn: '132',
      heightIn: '96',
      standardDoorCount: '1',
    }),
    wallSegment({
      id: 'wall-seg-dining-triangle',
      wallScopeId: 'wall-multi-dining',
      roomId: CANONICAL_IDS.rooms.diningRoom,
      position: 1,
      shapeType: 'TRIANGLE',
      baseIn: '120',
      heightIn: '48',
      widthIn: '',
    }),
  ],
  ceilingScopes: [
    ceilingScope({ id: 'ceiling-multi-living', roomId: CANONICAL_IDS.rooms.livingRoom }),
    ceilingScope({ id: 'ceiling-multi-dining', roomId: CANONICAL_IDS.rooms.diningRoom, mode: 'SEG', lengthIn: '', widthIn: '' }),
    ceilingScope({ id: 'ceiling-multi-bedroom', roomId: CANONICAL_IDS.rooms.bedroom, mode: 'SEG', lengthIn: '', widthIn: '' }),
  ],
  ceilingSegments: [
    ceilingSegment({
      id: 'ceiling-seg-dining-main',
      ceilingScopeId: 'ceiling-multi-dining',
      roomId: CANONICAL_IDS.rooms.diningRoom,
      widthIn: '132',
      heightIn: '120',
    }),
    ceilingSegment({
      id: 'ceiling-seg-dining-manual',
      ceilingScopeId: 'ceiling-multi-dining',
      roomId: CANONICAL_IDS.rooms.diningRoom,
      position: 1,
      shapeType: 'MANUAL',
      widthIn: '',
      heightIn: '',
      manualAreaSqFt: '18',
    }),
    ceilingSegment({
      id: 'ceiling-seg-bedroom-triangles',
      ceilingScopeId: 'ceiling-multi-bedroom',
      roomId: CANONICAL_IDS.rooms.bedroom,
      shapeType: 'TRIANGLE',
      quantity: '2',
      baseIn: '96',
      heightIn: '72',
      widthIn: '',
    }),
    ceilingSegment({
      id: 'ceiling-seg-bedroom-manual',
      ceilingScopeId: 'ceiling-multi-bedroom',
      roomId: CANONICAL_IDS.rooms.bedroom,
      position: 1,
      shapeType: 'MANUAL',
      widthIn: '',
      heightIn: '',
      manualAreaSqFt: '36',
    }),
  ],
  trimScopes: [
    trimScope({ id: 'trim-multi-living', roomId: CANONICAL_IDS.rooms.livingRoom }),
    trimScope({ id: 'trim-multi-bedroom', roomId: CANONICAL_IDS.rooms.bedroom, helperValue: '37', baseboardOpeningCount: '2' }),
  ],
})

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  // finalTotal = living 625.39 + dining 379.72 + bedroom 261.74.
  finalTotal: 1266.85,
  rooms: [
    {
      roomId: CANONICAL_IDS.rooms.livingRoom,
      // total = living walls 355.79 + ceiling 174.99 + trim 94.61.
      total: 625.39,
    },
    {
      roomId: CANONICAL_IDS.rooms.diningRoom,
      // total = dining segmented walls 276.79 + segmented ceiling 102.93.
      total: 379.72,
    },
    {
      roomId: CANONICAL_IDS.rooms.bedroom,
      // total = disabled walls 0.00 + segmented ceiling 172.69 + trim 89.05.
      total: 261.74,
    },
  ],
  scopeTotals: {
    walls: [
      {
        scopeId: 'wall-multi-living',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = living rectangular walls after one door and one window deduction.
        total: 355.79,
      },
      {
        scopeId: 'wall-multi-dining',
        roomId: CANONICAL_IDS.rooms.diningRoom,
        // total = segmented dining wall rectangles plus triangle after door deduction.
        total: 276.79,
      },
      {
        scopeId: 'wall-multi-bedroom-disabled',
        roomId: CANONICAL_IDS.rooms.bedroom,
        // total = disabled bedroom wall scope contributes 0.
        total: 0,
      },
    ],
    ceilings: [
      {
        scopeId: 'ceiling-multi-living',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = living rectangular ceiling 120 sf.
        total: 174.99,
      },
      {
        scopeId: 'ceiling-multi-dining',
        roomId: CANONICAL_IDS.rooms.diningRoom,
        // total = dining segmented ceiling 110 sf rectangle + 18 sf manual area.
        total: 102.93,
      },
      {
        scopeId: 'ceiling-multi-bedroom',
        roomId: CANONICAL_IDS.rooms.bedroom,
        // total = bedroom triangular dormers 48 sf + manual landing 36 sf.
        total: 172.69,
      },
    ],
    trim: [
      {
        scopeId: 'trim-multi-living',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = living baseboard helper measurement 41 lf.
        total: 94.61,
      },
      {
        scopeId: 'trim-multi-bedroom',
        roomId: CANONICAL_IDS.rooms.bedroom,
        // total = bedroom baseboard helper measurement 31 lf with two opening deductions.
        total: 89.05,
      },
    ],
    doors: [],
    drywall: [],
    accessFees: [],
  },
}

export const multiRoomGeometryVariationFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
}
