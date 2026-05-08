import {
  buildCanonicalEditorState,
  CANONICAL_IDS,
  room,
  wallScope,
  type EstimateV2CanonicalFixture,
} from '../estimateV2CanonicalFixtureTypes.ts'

export const scenarioName = 'Simple / no overrides'
export const scenarioDescription =
  'Single-room wall-only repaint with no manual overrides, no policy adjustments, and no disabled scopes.'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'simple-no-overrides',
  scenarioName,
  rooms: [room({})],
  wallScopes: [wallScope({ id: 'wall-simple-living' })],
})

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  // finalTotal = wall scope total 395.48 with no policy adjustments.
  finalTotal: 395.48,
  rooms: [
    {
      roomId: CANONICAL_IDS.rooms.livingRoom,
      // total = only room scope total, wall-simple-living 395.48.
      total: 395.48,
    },
  ],
  scopeTotals: {
    walls: [
      {
        scopeId: 'wall-simple-living',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = labor 267.00 + paint 100.00 + supplies 28.48.
        total: 395.48,
      },
    ],
    ceilings: [],
    trim: [],
    doors: [],
    drywall: [],
    accessFees: [],
  },
}

export const simpleNoOverridesFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
}
