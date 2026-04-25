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
      rooms: [...fixture.rooms].reverse(),
      scopes: [...fixture.scopes].reverse(),
      segments: [...fixture.segments].reverse(),
      roomFlags: [...fixture.roomFlags].reverse(),
      rollers: [...fixture.rollers].reverse(),
      ceilingScopes: [...fixture.ceilingScopes].reverse(),
      ceilingSegments: [...fixture.ceilingSegments].reverse(),
      trimScopes: [...fixture.trimScopes].reverse(),
    })

    expect(areEstimateV2DirtySnapshotsEqual(reorderedSnapshot, fixture.currentSnapshot)).toBe(true)
    expect(reorderedSnapshot.payload).toEqual(fixture.currentSnapshot.payload)
  })
})
