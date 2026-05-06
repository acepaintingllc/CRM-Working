import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { calculateEstimateV2Preview } from '@/lib/estimator/v2PreviewCalculations'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { buildEstimateV2DirtySnapshot } from '../estimateV2DirtySnapshot'
import { useEstimateV2CeilingCalculationDerived } from '../useEstimateV2CeilingCalculationDerived'

function buildCeilingHookParams(options?: { useLocalPreviewCalculations?: boolean }) {
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
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      rooms: fixture.rooms,
      ceilingCalculations: fixture.ceilingCalculations,
      ceilingTypes: fixture.catalogs.ceiling_types,
      currentCeilingScopes: currentSnapshot.payload.room_ceiling_scopes,
      localCeilingCalculations: localPreviewCalculations.ceilings,
      selectedRoomCeilingScopes: fixture.ceilingScopes.filter((scope) => scope.roomId === 'R001'),
      useLocalPreviewCalculations: options?.useLocalPreviewCalculations ?? false,
    },
  }
}

describe('useEstimateV2CeilingCalculationDerived', () => {
  it('uses canonical server ceiling calculations when local preview is disabled', () => {
    const { params } = buildCeilingHookParams({ useLocalPreviewCalculations: false })

    const { result } = renderHook(() => useEstimateV2CeilingCalculationDerived(params))

    expect(result.current.displayedCeilingScopeEffectiveAreaById.get('ceiling-r001-main')).toBe(120)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBe(180)
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(120)
    expect(result.current.selectedCeilingSubtotal).toBe(180)
  })

  it('uses local ceiling area, preview metrics, and override-driven totals when local preview is enabled', () => {
    const { fixture } = buildCeilingHookParams()
    const ceilingScopes = fixture.ceilingScopes.map((scope) =>
      scope.id === 'ceiling-r001-main'
        ? { ...scope, overrideAreaSqFt: '144', overrideTotal: '321' }
        : scope
    )
    const currentSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: fixture.jobSettingsDraft,
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      ceilingScopes,
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
      useEstimateV2CeilingCalculationDerived({
        ceilingScopes,
        ceilingSegments: fixture.ceilingSegments,
        rooms: fixture.rooms,
        ceilingCalculations: fixture.ceilingCalculations,
        ceilingTypes: fixture.catalogs.ceiling_types,
        currentCeilingScopes: currentSnapshot.payload.room_ceiling_scopes,
        localCeilingCalculations: localPreviewCalculations.ceilings,
        selectedRoomCeilingScopes: ceilingScopes.filter((scope) => scope.roomId === 'R001'),
        useLocalPreviewCalculations: true,
      })
    )

    expect(result.current.displayedCeilingScopeEffectiveAreaById.get('ceiling-r001-main')).toBe(144)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBe(321)
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(144)
    expect(result.current.selectedCeilingSubtotal).toBe(321)
    expect(result.current.ceilingScopePreviewMetricsById.get('ceiling-r001-main')).toMatchObject({
      effectiveAreaSqFt: 144,
    })
  })
})
