import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { buildEstimateV2DirtySnapshot } from '../estimateV2DirtySnapshot'
import { useEstimateV2WallCalculationDerived } from '../useEstimateV2WallCalculationDerived'

function buildWallHookParams(options?: { useLocalPreviewCalculations?: boolean }) {
  const fixture = createMixedEstimateV2Fixture()
  const currentSnapshot = buildEstimateV2DirtySnapshot({
    jobSettingsDraft: fixture.jobSettingsDraft,
    rooms: fixture.rooms,
    scopes: fixture.scopes,
    segments: fixture.segments,
    roomFlags: fixture.roomFlags,
    ceilingScopes: fixture.ceilingScopes,
    ceilingSegments: fixture.ceilingSegments,
    trimScopes: fixture.trimScopes,
    rollers: fixture.rollers,
    accessFees: fixture.accessFees,
    otherItems: [],
  })
  const localPreviewCalculations = calculateEstimateV2Preview({
    payload: currentSnapshot.payload,
    catalogs: fixture.catalogs,
    orgDefaults: {
      walls_paint_id: fixture.jobSettingsDraft.wallPaintProductId,
      walls_primer_id: fixture.jobSettingsDraft.wallPrimerProductId,
      ceiling_paint_id: fixture.jobSettingsDraft.ceilingPaintProductId,
      ceiling_primer_id: fixture.jobSettingsDraft.ceilingPrimerProductId,
      trim_paint_id: fixture.jobSettingsDraft.trimPaintProductId,
      trim_primer_id: fixture.jobSettingsDraft.trimPrimerProductId,
    },
  })

  return {
    fixture,
    params: {
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      wallCalculations: fixture.wallCalculations,
      currentWallScopes: currentSnapshot.payload.room_wall_scopes,
      localWallCalculations: localPreviewCalculations.walls,
      selectedRoom: fixture.rooms[0],
      firstScope: fixture.scopes[0],
      selectedRoomScopes: fixture.scopes.filter((scope) => scope.roomId === 'R001'),
      useLocalPreviewCalculations: options?.useLocalPreviewCalculations ?? false,
    },
  }
}

describe('useEstimateV2WallCalculationDerived', () => {
  it('uses canonical server wall calculations when local preview is disabled', () => {
    const { params } = buildWallHookParams({ useLocalPreviewCalculations: false })

    const { result } = renderHook(() => useEstimateV2WallCalculationDerived(params))

    expect(result.current.displayedScopeEffectiveAreaById.get('wall-r001-main')).toBe(396)
    expect(result.current.displayedSegmentEffectiveAreaById.get('wall-seg-r002-1')).toBe(64)
    expect(result.current.displayedRoomEffectiveAreaByRoomId.get('R001')).toBe(396)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBe(700)
    expect(result.current.selectedWallSubtotal).toBe(700)
    expect(result.current.totalEffectiveAreaSqFt).toBe(476)
    expect(result.current.selectedRoomEffectiveSqFt).toBe(396)
    expect(result.current.selectedScopeEffectiveSqFt).toBe(396)
  })

  it('uses local wall area and override-driven totals when local preview is enabled', () => {
    const { fixture } = buildWallHookParams()
    const scopes = fixture.scopes.map((scope) =>
      scope.id === 'wall-r001-main'
        ? { ...scope, overrideAreaSqFt: '450', overrideTotal: '123' }
        : scope
    )
    const currentSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: fixture.jobSettingsDraft,
      rooms: fixture.rooms,
      scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
      rollers: fixture.rollers,
      accessFees: fixture.accessFees,
      otherItems: [],
    })
    const localPreviewCalculations = calculateEstimateV2Preview({
      payload: currentSnapshot.payload,
      catalogs: fixture.catalogs,
      orgDefaults: {
        walls_paint_id: fixture.jobSettingsDraft.wallPaintProductId,
        walls_primer_id: fixture.jobSettingsDraft.wallPrimerProductId,
        ceiling_paint_id: fixture.jobSettingsDraft.ceilingPaintProductId,
        ceiling_primer_id: fixture.jobSettingsDraft.ceilingPrimerProductId,
        trim_paint_id: fixture.jobSettingsDraft.trimPaintProductId,
        trim_primer_id: fixture.jobSettingsDraft.trimPrimerProductId,
      },
    })

    const { result } = renderHook(() =>
      useEstimateV2WallCalculationDerived({
        rooms: fixture.rooms,
        scopes,
        segments: fixture.segments,
        wallCalculations: fixture.wallCalculations,
        currentWallScopes: currentSnapshot.payload.room_wall_scopes,
        localWallCalculations: localPreviewCalculations.walls,
        selectedRoom: fixture.rooms[0],
        firstScope: scopes[0],
        selectedRoomScopes: scopes.filter((scope) => scope.roomId === 'R001'),
        useLocalPreviewCalculations: true,
      })
    )

    expect(result.current.displayedScopeEffectiveAreaById.get('wall-r001-main')).toBe(450)
    expect(result.current.displayedRoomEffectiveAreaByRoomId.get('R001')).toBe(450)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBe(123)
    expect(result.current.selectedWallSubtotal).toBe(123)
    expect(result.current.totalEffectiveAreaSqFt).toBe(530)
    expect(result.current.selectedRoomEffectiveSqFt).toBe(450)
    expect(result.current.selectedScopeEffectiveSqFt).toBe(450)
  })
})
