import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { useEstimateV2DerivedState } from '../useEstimateV2DerivedState'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'

function createDerivedStore() {
  const fixture = createMixedEstimateV2Fixture()
  const store = createEstimateV2Store({
    collections: {
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
    },
    meta: {
      loading: false,
      saving: false,
      estimate: fixture.estimate,
      job: fixture.job,
      catalogs: fixture.catalogs,
      wallCalculations: fixture.wallCalculations,
      ceilingCalculations: fixture.ceilingCalculations,
      trimCalculations: fixture.trimCalculations,
      selectedRoomId: 'R001',
      error: null,
      validationIssues: ['R001: Missing optional note', 'R002: Missing paint product'],
      lastSavedSnapshot: fixture.currentSnapshot,
      saveStatus: 'saved',
      autoSaveHint: null,
      settingsOpen: false,
      jobDefaultsOpen: false,
      jobSettingsDraft: fixture.jobSettingsDraft,
      orgJobProductDefaults: fixture.orgJobProductDefaults,
      customerDraft: {
        customerId: fixture.job.customer_id ?? '',
        name: fixture.job.customer_name ?? '',
        email: fixture.job.customer_email ?? '',
        phone: fixture.job.customer_phone ?? '',
        address: fixture.job.customer_address ?? '',
      },
      debugMeta: {
        dirtySource: null,
        lastSaveTrigger: null,
        lastNormalizedDomains: [],
      },
    },
  })

  return { fixture, store }
}

describe('useEstimateV2DerivedState', () => {
  it('builds stable mixed-estimate derived output from the canonical fixture', () => {
    const { fixture, store } = createDerivedStore()

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.roomModeById.get('R001')).toBe('RECT')
    expect(result.current.roomModeById.get('R002')).toBe('SEG')
    expect(result.current.sections.room.roomModeById.get('R002')).toBe('SEG')
    expect(result.current.roomScopeByRoomId.get('R002')?.map((scope) => scope.id)).toEqual([
      'wall-r002-main',
      'wall-r002-excluded',
    ])
    expect(result.current.currentSnapshot).toEqual(fixture.currentSnapshot)
    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.selectedRoom?.roomId).toBe('R001')
    expect(result.current.selectedRoomEffectiveSqFt).toBe(396)
    expect(result.current.selectedTrimMeasurement).toBe(44)
    expect(result.current.selectedTrimSubtotal).toBe(210)
    expect(result.current.totalEffectiveAreaSqFt).toBe(476)
    expect(result.current.wallPaintLabel).toBe('Wall Satin')
    expect(result.current.trimPaintLabel).toBe('Trim Enamel')
  })

  it('falls back safely to local preview calculations when snapshots are stale or calc payloads are malformed', () => {
    const { fixture, store } = createDerivedStore()
    store.getState().setMeta((prev) => ({
      ...prev,
      lastSavedSnapshot: {
        payload: fixture.currentSnapshot.payload,
        comparisonKey: 'stale-snapshot',
      },
      selectedRoomId: 'R002',
      ceilingCalculations: { scopes: 'not-an-array' } as never,
      trimCalculations: { scopes: null } as never,
    }))

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.selectedRoom?.roomId).toBe('R002')
    expect(result.current.selectedRoomEffectiveSqFt).toBe(80)
    expect(result.current.selectedCeilingEffectiveSqFt).toBeNull()
    expect(result.current.selectedTrimMeasurement).toBeNull()
    expect(result.current.wallPaintLabel).toBe('Wall Satin')
    expect(result.current.saveStatusText).toContain('Unsaved changes')
  })

  it('toggles dirty state off and on as the canonical saved snapshot changes', () => {
    const { store } = createDerivedStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)

    act(() => {
      store.getState().setScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'wall-r001-main' ? { ...scope, notes: 'Fresh note' } : scope
        )
      )
    })

    expect(result.current.dirty).toBe(true)
    expect(result.current.useLocalPreviewCalculations).toBe(true)

    act(() => {
      store.getState().setLastSavedSnapshot(result.current.currentSnapshot)
    })

    expect(result.current.dirty).toBe(false)
    expect(result.current.useLocalPreviewCalculations).toBe(false)
  })
})
