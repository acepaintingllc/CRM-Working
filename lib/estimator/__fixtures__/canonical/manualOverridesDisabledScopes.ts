import {
  accessFee,
  buildCanonicalEditorState,
  CANONICAL_IDS,
  ceilingScope,
  doorScope,
  drywallRepair,
  room,
  trimScope,
  wallScope,
  type EstimateV2CanonicalFixture,
} from '../estimateV2CanonicalFixtureTypes.ts'

export const scenarioName = 'Manual overrides + disabled scopes'
export const scenarioDescription =
  'One-room estimate covering explicit manual totals and disabled wall, door, drywall, and access rows.'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'manual-overrides-disabled-scopes',
  scenarioName,
  rooms: [room({})],
  wallScopes: [
    wallScope({ id: 'wall-override-active', overrideTotal: '450' }),
    wallScope({ id: 'wall-disabled', include: 'N', position: 1, overrideTotal: '999' }),
  ],
  ceilingScopes: [ceilingScope({ id: 'ceiling-override-active', overrideTotal: '210' })],
  trimScopes: [trimScope({ id: 'trim-override-active', overrideTotal: '125' })],
  doorScopes: [doorScope({ id: 'door-disabled', include: 'N', overrideTotal: '300' })],
  drywallRepairs: [
    drywallRepair({ id: 'drywall-override-active', quantity: '3', overrideTotal: '80' }),
    drywallRepair({ id: 'drywall-disabled-zero', position: 1, quantity: '0', overrideTotal: '120' }),
  ],
  accessFees: [
    accessFee({ id: 'access-override-active', actualCostOverride: '95' }),
    accessFee({ id: 'access-disabled-zero', position: 1, qty: '0', actualCostOverride: '120' }),
  ],
})

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  // finalTotal = active room scopes 865.00 + active access fee 95.00.
  finalTotal: 960,
  rooms: [
    {
      roomId: CANONICAL_IDS.rooms.livingRoom,
      // total = wall override 450.00 + ceiling override 210.00 + trim override 125.00 + drywall override 80.00.
      total: 865,
    },
  ],
  scopeTotals: {
    walls: [
      {
        scopeId: 'wall-override-active',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = manual wall override total.
        total: 450,
      },
      {
        scopeId: 'wall-disabled',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = disabled scope contributes 0 despite 999.00 override.
        total: 0,
      },
    ],
    ceilings: [
      {
        scopeId: 'ceiling-override-active',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = manual ceiling override total.
        total: 210,
      },
    ],
    trim: [
      {
        scopeId: 'trim-override-active',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = manual trim override total.
        total: 125,
      },
    ],
    doors: [
      {
        scopeId: 'door-disabled',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = disabled door contributes 0 despite 300.00 override.
        total: 0,
      },
    ],
    drywall: [
      {
        scopeId: 'drywall-override-active',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = manual drywall override total.
        total: 80,
      },
      {
        scopeId: 'drywall-disabled-zero',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = zero quantity disabled-style drywall row contributes 0.
        total: 0,
      },
    ],
    accessFees: [
      {
        scopeId: 'access-override-active',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = manual access actual-cost override.
        total: 95,
      },
      {
        scopeId: 'access-disabled-zero',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = zero quantity access row contributes 0 despite 120.00 override.
        total: 0,
      },
    ],
  },
}

export const manualOverridesDisabledScopesFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
}
