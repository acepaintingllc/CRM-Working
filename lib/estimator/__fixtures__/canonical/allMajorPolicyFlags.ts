import {
  accessFee,
  buildCanonicalEditorState,
  buildCanonicalJobSettings,
  CANONICAL_IDS,
  ceilingScope,
  room,
  trimScope,
  wallScope,
  type EstimateV2CanonicalFixture,
} from '../estimateV2CanonicalFixtureTypes.ts'

export const scenarioName = 'All major policy flags'
export const scenarioDescription =
  'Single-room estimate with labor-day rounding, job minimum, full primer, and access-fee policy coverage.'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'all-major-policy-flags',
  scenarioName,
  jobSettingsDraft: buildCanonicalJobSettings({
    laborDayEnabled: true,
    jobMinEnabled: true,
    jobMinAmount: 1200,
  }),
  rooms: [room({})],
  wallScopes: [wallScope({ id: 'wall-policy-flags', primeMode: 'FULL', primerCoats: '1' })],
  ceilingScopes: [ceilingScope({ id: 'ceiling-policy-flags' })],
  trimScopes: [trimScope({ id: 'trim-policy-flags', primeMode: 'FULL', primerCoats: '1' })],
  accessFees: [accessFee({ id: 'access-policy-flags' })],
})

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  // finalTotal = calculated subtotal raised to the configured 1200.00 job minimum.
  finalTotal: 1200,
  rooms: [
    {
      roomId: CANONICAL_IDS.rooms.livingRoom,
      // total = room subtotal plus allocated minimum adjustment.
      total: 1200,
    },
  ],
  scopeTotals: {
    walls: [
      {
        scopeId: 'wall-policy-flags',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = wall paint subtotal 395.48 + full-primer labor/material/supply 108.46.
        total: 503.94,
      },
    ],
    ceilings: [
      {
        scopeId: 'ceiling-policy-flags',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = ceiling labor 120.00 + paint 48.00 + supplies 18.00.
        total: 186,
      },
    ],
    trim: [
      {
        scopeId: 'trim-policy-flags',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = trim paint subtotal 94.60 + primer material/supply 19.93.
        total: 114.53,
      },
    ],
    doors: [],
    drywall: [],
    accessFees: [
      {
        scopeId: 'access-policy-flags',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = 1 ladder setup * 75.00.
        total: 75,
      },
    ],
  },
}

export const allMajorPolicyFlagsFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
}
