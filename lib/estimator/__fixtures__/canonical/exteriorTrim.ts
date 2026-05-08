import {
  accessFee,
  buildCanonicalEditorState,
  room,
  trimScope,
  type EstimateV2CanonicalFixture,
} from '../estimateV2CanonicalFixtureTypes.ts'

export const scenarioName = 'Exterior trim'
export const scenarioDescription =
  'A believable small exterior trim repaint for a front elevation, using manual trim measurement and one ladder setup access fee.'

const EXTERIOR_ROOM_ID = 'E001'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'exterior-trim',
  scenarioName,
  rooms: [
    room({
      id: 'room-exterior-trim',
      roomId: EXTERIOR_ROOM_ID,
      roomName: 'Front Exterior',
      lengthIn: '240',
      widthIn: '96',
      heightIn: '108',
    }),
  ],
  trimScopes: [
    trimScope({
      id: 'trim-exterior-front',
      roomId: EXTERIOR_ROOM_ID,
      scopeName: 'Exterior fascia and window trim',
      measurementMode: 'MANUAL',
      helperSource: 'ROOM_PERIMETER',
      measurementValue: '68',
      helperValue: '',
      baseboardOpeningCount: '0',
    }),
  ],
  accessFees: [
    accessFee({
      id: 'access-exterior-ladder',
      roomId: EXTERIOR_ROOM_ID,
    }),
  ],
})

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  // finalTotal = exterior trim 136.27 + ladder access 75.00.
  finalTotal: 211.27,
  rooms: [
    {
      roomId: EXTERIOR_ROOM_ID,
      // room total = trim scope only; access fees remain estimate-level in the canonical pricing summary.
      total: 136.27,
    },
  ],
  scopeTotals: {
    walls: [],
    ceilings: [],
    trim: [
      {
        scopeId: 'trim-exterior-front',
        roomId: EXTERIOR_ROOM_ID,
        // manual measurement = 68 lf of exterior fascia and window trim.
        // labor = (68 lf * 2 coats / 82 lf-hr) * 60 = 99.51.
        // paint = ceil((68 lf * 2 coats) / 350 coverage) = 1 gal * 31.32 = 31.32.
        // supplies = 68 * 0.08 = 5.44.
        // total = 99.51 + 31.32 + 5.44 = 136.27.
        total: 136.27,
      },
    ],
    doors: [],
    drywall: [],
    accessFees: [
      {
        scopeId: 'access-exterior-ladder',
        roomId: EXTERIOR_ROOM_ID,
        // total = 1 ladder setup * 75.00.
        total: 75,
      },
    ],
  },
}

export const exteriorTrimFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
  metadata: {
    sourceType: 'manually_crafted',
    expectedTotalSource: 'hand_verified',
  },
  comparisonNotes: [
    'The canonical catalog only exposes an interior-style baseboard trim type, so this historical exterior scenario reuses the shared trim rate as the closest available estimator proxy.',
  ],
  knownDifferenceNotes: [
    'If this scenario ever diverges from the current calculator, preserve the hand-verified target and classify the difference instead of regenerating expected totals from code output.',
  ],
}
