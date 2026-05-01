import { describe, expect, it } from 'vitest'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import {
  areEstimateV2DirtySnapshotsEqual,
  buildEstimateV2DirtySnapshot,
} from '../estimateV2DirtySnapshot'

describe('estimateV2DirtySnapshot', () => {
  it('builds the same canonical snapshot for semantically unchanged collections', () => {
    const fixture = createMixedEstimateV2Fixture()

    const reorderedSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: fixture.jobSettingsDraft,
      rooms: [...fixture.rooms].reverse(),
      scopes: [...fixture.scopes].reverse(),
      segments: [...fixture.segments].reverse(),
      roomFlags: [...fixture.roomFlags].reverse(),
      rollers: [...fixture.rollers].reverse(),
      accessFees: [...fixture.accessFees].reverse(),
      ceilingScopes: [...fixture.ceilingScopes].reverse(),
      ceilingSegments: [...fixture.ceilingSegments].reverse(),
      trimScopes: [...fixture.trimScopes].reverse(),
    })

    expect(areEstimateV2DirtySnapshotsEqual(reorderedSnapshot, fixture.currentSnapshot)).toBe(true)
    expect(reorderedSnapshot.payload).toEqual(fixture.currentSnapshot.payload)
  })

  it('changes the comparison key when crew size changes', () => {
    const fixture = createMixedEstimateV2Fixture()

    const crewSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: { ...fixture.jobSettingsDraft, crewSize: 3 },
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      accessFees: fixture.accessFees,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
    })

    expect(crewSnapshot.comparisonKey).not.toBe(fixture.currentSnapshot.comparisonKey)
    expect(crewSnapshot.payload.jobsettings.crew_size).toBe(3)
  })

  it('serializes access fees into the save payload', () => {
    const fixture = createMixedEstimateV2Fixture()

    const snapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: fixture.jobSettingsDraft,
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      accessFees: [
        {
          id: 'access-fee-1',
          roomId: '',
          accessFeeId: ' ladder-tall ',
          qty: '2',
          actualCostOverride: '',
          notes: 'Vault ladder setup',
          position: 2,
        },
      ],
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
    })

    expect(snapshot.payload.access_fees).toEqual([
      {
        id: 'access-fee-1',
        room_id: null,
        access_fee_id: 'LADDER-TALL',
        qty: 2,
        actual_cost_override: null,
        notes: 'Vault ladder setup',
        position: 0,
        active: 'Y',
      },
    ])
  })
})
