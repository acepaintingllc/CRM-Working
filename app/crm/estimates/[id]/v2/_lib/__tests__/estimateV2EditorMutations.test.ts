import { describe, expect, it } from 'vitest'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { updateRoomDimensionsMutation } from '../estimateV2EditorMutations'

describe('estimateV2EditorMutations', () => {
  it('syncs room dimensions to RECT wall and ceiling scopes without touching SEG ceilings', () => {
    const fixture = createMixedEstimateV2Fixture()

    const rectResult = updateRoomDimensionsMutation({
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      ceilingScopes: fixture.ceilingScopes,
      roomId: 'R001',
      field: 'widthIn',
      value: '156',
    })

    expect(rectResult.scopes.find((scope) => scope.id === 'wall-r001-main')?.perimeterIn).toBe('552')
    expect(rectResult.ceilingScopes?.find((scope) => scope.id === 'ceiling-r001-main')?.lengthIn).toBe('120')
    expect(rectResult.ceilingScopes?.find((scope) => scope.id === 'ceiling-r001-main')?.widthIn).toBe('156')

    const segResult = updateRoomDimensionsMutation({
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      ceilingScopes: fixture.ceilingScopes,
      roomId: 'R002',
      field: 'lengthIn',
      value: '111',
    })

    expect(segResult.ceilingScopes?.find((scope) => scope.id === 'ceiling-r002-main')?.mode).toBe('SEG')
    expect(segResult.ceilingScopes?.find((scope) => scope.id === 'ceiling-r002-main')?.lengthIn).toBe('')
    expect(segResult.ceilingScopes?.find((scope) => scope.id === 'ceiling-r002-main')?.widthIn).toBe('')
  })
})
