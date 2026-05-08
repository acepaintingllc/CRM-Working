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

export const scenarioName = 'All scope types'
export const scenarioDescription =
  'Single-room fixture with active walls, ceilings, trim, doors, drywall, and an access fee.'

export const editorState = buildCanonicalEditorState({
  scenarioId: 'all-scope-types',
  scenarioName,
  rooms: [room({})],
  wallScopes: [wallScope({ id: 'wall-all-scopes' })],
  ceilingScopes: [ceilingScope({ id: 'ceiling-all-scopes' })],
  trimScopes: [trimScope({ id: 'trim-all-scopes' })],
  doorScopes: [doorScope({ id: 'door-all-scopes', overrideSupplyCost: '48.11' })],
  drywallRepairs: [drywallRepair({ id: 'drywall-all-scopes', quantity: '6' })],
  accessFees: [accessFee({ id: 'access-all-scopes' })],
})

export const expectedTotals: EstimateV2CanonicalFixture['expectedTotals'] = {
  // finalTotal = room total 926.19 + access fee 75.00.
  finalTotal: 1001.19,
  rooms: [
    {
      roomId: CANONICAL_IDS.rooms.livingRoom,
      // total = walls 395.48 + ceilings 186.00 + trim 94.60 + doors 178.11 + drywall 72.00.
      total: 926.19,
    },
  ],
  scopeTotals: {
    walls: [
      {
        scopeId: 'wall-all-scopes',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = wall labor/material/supply subtotal from 356 sf.
        total: 395.48,
      },
    ],
    ceilings: [
      {
        scopeId: 'ceiling-all-scopes',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = labor 120.00 + paint 48.00 + supplies 18.00 for 120 ceiling sf.
        total: 186,
      },
    ],
    trim: [
      {
        scopeId: 'trim-all-scopes',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = labor 60.00 + paint 31.32 + supplies 3.28 for 41 lf baseboard.
        total: 94.6,
      },
    ],
    doors: [
      {
        scopeId: 'door-all-scopes',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = labor 120.00 + material 10.00 + explicit supply override 48.11.
        total: 178.11,
      },
    ],
    drywall: [
      {
        scopeId: 'drywall-all-scopes',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = 6 sqft wall patch * 12.00.
        total: 72,
      },
    ],
    accessFees: [
      {
        scopeId: 'access-all-scopes',
        roomId: CANONICAL_IDS.rooms.livingRoom,
        // total = 1 ladder setup * 75.00.
        total: 75,
      },
    ],
  },
}

export const allScopeTypesFixture: EstimateV2CanonicalFixture = {
  scenarioName,
  scenarioDescription,
  editorState,
  expectedTotals,
}
