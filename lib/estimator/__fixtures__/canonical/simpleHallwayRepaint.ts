import {
  buildCanonicalEditorState,
  ceilingScope,
  room,
  trimScope,
  wallScope,
  type EstimateV2CanonicalFixture,
} from '../estimateV2CanonicalFixtureTypes.ts'

export const scenarioName = 'Simple hallway repaint'
export const scenarioDescription =
  'A believable narrow interior hallway repaint with walls, ceiling, and baseboards, sized like a modest residential connector hall.'

const HALLWAY_ROOM_ID = 'H001'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'simple-hallway-repaint',
  scenarioName,
  rooms: [
    room({
      id: 'room-hallway',
      roomId: HALLWAY_ROOM_ID,
      roomName: 'Hallway',
      lengthIn: '180',
      widthIn: '40',
      heightIn: '96',
    }),
  ],
  wallScopes: [
    wallScope({
      id: 'wall-hallway-main',
      roomId: HALLWAY_ROOM_ID,
      heightIn: '96',
      perimeterIn: '440',
      standardDoorCount: '1',
      standardWindowCount: '0',
    }),
  ],
  ceilingScopes: [
    ceilingScope({
      id: 'ceiling-hallway-main',
      roomId: HALLWAY_ROOM_ID,
      lengthIn: '180',
      widthIn: '40',
    }),
  ],
  trimScopes: [
    trimScope({
      id: 'trim-hallway-base',
      roomId: HALLWAY_ROOM_ID,
      helperValue: '37',
      baseboardOpeningCount: '2',
    }),
  ],
})

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  // finalTotal = walls 326.87 + ceiling 105.50 + trim 78.65.
  finalTotal: 511.02,
  rooms: [
    {
      roomId: HALLWAY_ROOM_ID,
      // room total = same as final total because there are no estimate-level access fees or policy adjustments.
      total: 511.02,
    },
  ],
  scopeTotals: {
    walls: [
      {
        scopeId: 'wall-hallway-main',
        roomId: HALLWAY_ROOM_ID,
        // raw area = (440 in perimeter * 96 in height) / 144 = 293.33 sf.
        // effective area = 293.33 - 1 standard door deduction 20.00 = 273.33 sf.
        // labor = (273.33 * 2 coats / 160 sf-hr) * 60 = 205.00.
        // paint = ceil((273.33 * 2 coats) / 400 coverage) = 2 gal * 50.00 = 100.00.
        // supplies = 273.33 * 0.08 = 21.87.
        // total = 205.00 + 100.00 + 21.87 = 326.87.
        total: 326.87,
      },
    ],
    ceilings: [
      {
        scopeId: 'ceiling-hallway-main',
        roomId: HALLWAY_ROOM_ID,
        // area = (180 in * 40 in) / 144 = 50.00 sf.
        // labor = (50.00 * 2 coats / 120 sf-hr) * 60 = 50.00.
        // paint = ceil((50.00 * 2 coats) / 400 coverage) = 1 gal * 48.00 = 48.00.
        // supplies = 50.00 * 0.15 = 7.50.
        // total = 50.00 + 48.00 + 7.50 = 105.50.
        total: 105.5,
      },
    ],
    trim: [
      {
        scopeId: 'trim-hallway-base',
        roomId: HALLWAY_ROOM_ID,
        // room perimeter helper = ((180 in + 40 in) * 2) / 12 = 36.67 lf.
        // effective measurement = 36.67 - (2 openings * 3 lf) = 30.67 lf.
        // labor = (30.67 lf * 2 coats / 82 lf-hr) * 60 = 44.88.
        // paint = ceil((30.67 lf * 2 coats) / 350 coverage) = 1 gal * 31.32 = 31.32.
        // supplies = 30.67 * 0.08 = 2.45.
        // total = 44.88 + 31.32 + 2.45 = 78.65.
        total: 78.65,
      },
    ],
    doors: [],
    drywall: [],
    accessFees: [],
  },
}

export const simpleHallwayRepaintFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
  metadata: {
    sourceType: 'manually_crafted',
    expectedTotalSource: 'hand_verified',
  },
  comparisonNotes: [
    'This scenario represents a routine residential connector hallway, not a stress test for unusual geometry or override behavior.',
  ],
}
