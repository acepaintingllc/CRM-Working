import {
  buildCanonicalEditorState,
  ceilingScope,
  doorScope,
  room,
  trimScope,
  wallScope,
  type EstimateV2CanonicalFixture,
} from '../estimateV2CanonicalFixtureTypes.ts'

export const scenarioName = 'Full master bedroom'
export const scenarioDescription =
  'A realistic full-room master bedroom repaint with walls, ceiling, baseboards, and two painted doors for entry and closet access.'

const MASTER_BEDROOM_ROOM_ID = 'M001'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'full-master-bedroom',
  scenarioName,
  rooms: [
    room({
      id: 'room-master-bedroom',
      roomId: MASTER_BEDROOM_ROOM_ID,
      roomName: 'Master Bedroom',
      lengthIn: '180',
      widthIn: '168',
      heightIn: '108',
    }),
  ],
  wallScopes: [
    wallScope({
      id: 'wall-master-bedroom',
      roomId: MASTER_BEDROOM_ROOM_ID,
      heightIn: '108',
      perimeterIn: '696',
      standardDoorCount: '1',
      standardWindowCount: '2',
    }),
  ],
  ceilingScopes: [
    ceilingScope({
      id: 'ceiling-master-bedroom',
      roomId: MASTER_BEDROOM_ROOM_ID,
      lengthIn: '180',
      widthIn: '168',
    }),
  ],
  trimScopes: [
    trimScope({
      id: 'trim-master-bedroom-base',
      roomId: MASTER_BEDROOM_ROOM_ID,
      helperValue: '58',
      baseboardOpeningCount: '2',
    }),
  ],
  doorScopes: [
    doorScope({
      id: 'door-master-bedroom-set',
      roomId: MASTER_BEDROOM_ROOM_ID,
      quantity: '2',
      sides: '2',
    }),
  ],
})

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  // finalTotal = walls 550.06 + ceiling 337.50 + trim 111.58 + doors 260.00.
  finalTotal: 1259.14,
  rooms: [
    {
      roomId: MASTER_BEDROOM_ROOM_ID,
      // room total = same as final total because there are no estimate-level policy adjustments in this scenario.
      total: 1259.14,
    },
  ],
  scopeTotals: {
    walls: [
      {
        scopeId: 'wall-master-bedroom',
        roomId: MASTER_BEDROOM_ROOM_ID,
        // raw area = (696 in perimeter * 108 in height) / 144 = 522.00 sf.
        // effective area = 522.00 - 1 door deduction 20.00 - 2 window deductions 20.00 = 482.00 sf.
        // labor = (482.00 * 2 coats / 160 sf-hr) * 60 = 361.50.
        // paint = ceil((482.00 * 2 coats) / 400 coverage) = 3 gal * 50.00 = 150.00.
        // supplies = 482.00 * 0.08 = 38.56.
        // total = 361.50 + 150.00 + 38.56 = 550.06.
        total: 550.06,
      },
    ],
    ceilings: [
      {
        scopeId: 'ceiling-master-bedroom',
        roomId: MASTER_BEDROOM_ROOM_ID,
        // area = (180 in * 168 in) / 144 = 210.00 sf.
        // labor = (210.00 * 2 coats / 120 sf-hr) * 60 = 210.00.
        // paint = ceil((210.00 * 2 coats) / 400 coverage) = 2 gal * 48.00 = 96.00.
        // supplies = 210.00 * 0.15 = 31.50.
        // total = 210.00 + 96.00 + 31.50 = 337.50.
        total: 337.5,
      },
    ],
    trim: [
      {
        scopeId: 'trim-master-bedroom-base',
        roomId: MASTER_BEDROOM_ROOM_ID,
        // helper measurement = 58 lf perimeter helper - (2 openings * 3 lf) = 52 lf.
        // labor = (52 lf * 2 coats / 82 lf-hr) * 60 = 76.10.
        // paint = ceil((52 lf * 2 coats) / 350 coverage) = 1 gal * 31.32 = 31.32.
        // supplies = 52 * 0.08 = 4.16.
        // total = 76.10 + 31.32 + 4.16 = 111.58.
        total: 111.58,
      },
    ],
    doors: [
      {
        scopeId: 'door-master-bedroom-set',
        roomId: MASTER_BEDROOM_ROOM_ID,
        // labor = 2 doors * 2 sides * 0.5 hr base * 2 coats * 60 = 240.00.
        // material = 2 doors * 2 sides * 5.00 = 20.00.
        // total = 240.00 + 20.00 = 260.00.
        total: 260,
      },
    ],
    drywall: [],
    accessFees: [],
  },
}

export const fullMasterBedroomFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
  metadata: {
    sourceType: 'manually_crafted',
    expectedTotalSource: 'hand_verified',
  },
  comparisonNotes: [
    'This scenario assumes a customer-visible full-room repaint with typical two-coat wall and ceiling work plus two doors.',
  ],
}
