import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { useEstimateV2DerivedState } from '../useEstimateV2DerivedState'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { buildEstimateV2DirtySnapshot } from '../estimateV2DirtySnapshot'

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
      rollers: fixture.rollers,
      accessFees: fixture.accessFees,
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
    expect(result.current.currentPayload.rollers).toEqual(fixture.currentSnapshot.payload.rollers)
    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.selectedRoom?.roomId).toBe('R001')
    expect(result.current.selectedRoomEffectiveSqFt).toBe(396)
    expect(result.current.selectedTrimMeasurement).toBe(44)
    expect(result.current.selectedTrimSubtotal).toBe(210)
    expect(result.current.totalEffectiveAreaSqFt).toBe(476)
    expect(result.current.wallPaintLabel).toBe('Wall Satin')
    expect(result.current.trimPaintLabel).toBe('Trim Enamel')
  })

  it('derives trim type dropdown options from trim_items instead of trim production rates', () => {
    const { store } = createDerivedStore()
    store.getState().setCatalogs((prev) => ({
      ...prev,
      trim_items: [
        {
          id: 'BASE_STD',
          label: 'Baseboard Standard',
          family: 'BASEBOARD',
          category: 'BASEBOARD',
          unit_type: 'LF',
          helper_allowed: true,
          default_production_rate_id: 'TRIM_BASE_STD',
        },
      ],
      production_rates: [
        {
          id: 'TRIM_BASE_STD',
          label: 'Trim Base Production Rate',
          scope_id: 'TRIM',
          surface_type: 'BASEBOARD',
          condition: 'STANDARD',
          prep_sqft_per_hr: 60,
          sqft_per_hr: 90,
          primer_sqft_per_hr: 75,
        },
      ],
    }))

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.trimProductionRates.map((rate) => rate.id)).toEqual(['TRIM_BASE_STD'])
    expect(result.current.trimTypeOptions.map((option) => option.id)).toEqual(['BASE_STD'])
    expect(result.current.trimTypeOptions[0].default_production_rate_id).toBe('TRIM_BASE_STD')
    expect(result.current.trimTypeOptions[0].helper_allowed).toBe(true)
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
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(60)
    expect(result.current.selectedTrimMeasurement).toBeNull()
    expect(result.current.wallPaintLabel).toBe('Wall Satin')
    expect(result.current.saveStatusText).toContain('Unsaved changes')
  })

  it('previews geometry edits in scope measurements and scaled subtotals before save settles', () => {
    const { store } = createDerivedStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setRooms((prev) =>
        prev.map((room) => (room.roomId === 'R001' ? { ...room, lengthIn: '240' } : room))
      )
      store.getState().setScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'wall-r001-main' ? { ...scope, perimeterIn: '768' } : scope
        )
      )
      store.getState().setCeilingScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'ceiling-r001-main'
            ? { ...scope, lengthIn: '240', widthIn: '144' }
            : scope
        )
      )
    })

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.selectedRoomEffectiveSqFt).toBe(576)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBe(1018.18)
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(240)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBe(360)
    expect(result.current.totalEffectiveAreaSqFt).toBe(656)
  })

  it('uses pending nulls only while required local preview inputs are missing', () => {
    const { store } = createDerivedStore()
    store.getState().setSelectedRoomId('R002')
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setCeilingSegments((prev) =>
        prev.map((segment) =>
          segment.id === 'ceiling-seg-r002-1' ? { ...segment, manualAreaSqFt: '' } : segment
        )
      )
    })

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.selectedCeilingEffectiveSqFt).toBeNull()
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r002-main')).toBeNull()

    act(() => {
      store.getState().setCeilingSegments((prev) =>
        prev.map((segment) =>
          segment.id === 'ceiling-seg-r002-1' ? { ...segment, manualAreaSqFt: '90' } : segment
        )
      )
    })

    expect(result.current.selectedCeilingEffectiveSqFt).toBe(90)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r002-main')).toBe(135)
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

  it('marks excluded trim and door scopes dirty when they are included before save', () => {
    const { fixture, store } = createDerivedStore()
    const excludedDoorScope = {
      id: 'door-r002-excluded',
      roomId: 'R002',
      position: 0,
      include: 'N' as const,
      scopeName: 'Closet Door',
      doorTypeId: '',
      quantity: '',
      sides: '',
      colorId: '',
      paintProductId: '',
      primerProductId: '',
      primeMode: 'NONE' as const,
      spotPrimePercent: '',
      paintCoats: '2',
      primerCoats: '1',
      conditionFactor: '1',
      laborRate: '',
      materialRate: '',
      overridePaintHours: '',
      overridePrimerHours: '',
      overrideMaterialCost: '',
      overrideSupplyCost: '',
      overrideTotal: '',
      notes: '',
    }

    act(() => {
      store.getState().setDoorScopes([excludedDoorScope])
      store.getState().setLastSavedSnapshot(
        buildEstimateV2DirtySnapshot({
          jobSettingsDraft: fixture.jobSettingsDraft,
          rooms: fixture.rooms,
          scopes: fixture.scopes,
          segments: fixture.segments,
          roomFlags: fixture.roomFlags,
          ceilingScopes: fixture.ceilingScopes,
          ceilingSegments: fixture.ceilingSegments,
          trimScopes: fixture.trimScopes,
          doorScopes: [excludedDoorScope],
          rollers: fixture.rollers,
          accessFees: fixture.accessFees,
        })
      )
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)

    act(() => {
      store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r002-excluded' ? { ...scope, include: 'Y' } : scope
        )
      )
      store.getState().setDoorScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'door-r002-excluded' ? { ...scope, include: 'Y' } : scope
        )
      )
    })

    expect(result.current.dirty).toBe(true)
    expect(result.current.currentPayload.room_trim_scopes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'trim-r002-excluded', include: 'Y' })])
    )
    expect(result.current.currentPayload.room_door_scopes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'door-r002-excluded', include: 'Y' })])
    )
  })

  it('does not show a saved timestamp when a clean autosaved draft is manually save-blocked', () => {
    const { fixture, store } = createDerivedStore()

    act(() => {
      store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main' ? { ...scope, trimTypeId: '' } : scope
        )
      )
      store.getState().setSaveStatus('saved')
      store.getState().setLastSavedSnapshot(
        buildEstimateV2DirtySnapshot({
          jobSettingsDraft: fixture.jobSettingsDraft,
          rooms: store.getState().collections.rooms,
          scopes: store.getState().collections.scopes,
          segments: store.getState().collections.segments,
          roomFlags: store.getState().collections.roomFlags,
          ceilingScopes: store.getState().collections.ceilingScopes,
          ceilingSegments: store.getState().collections.ceilingSegments,
          trimScopes: store.getState().collections.trimScopes,
          rollers: store.getState().collections.rollers,
          accessFees: store.getState().collections.accessFees,
        })
      )
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)
    expect(result.current.saveStatusText).toBe(
      'Unsaved changes - save blocked: R001: trim type is required'
    )
    expect(result.current.saveStatusText).not.toContain('Saved')
  })

  it('does not show a saved timestamp when saved door calculations still have blocking issues', () => {
    const { store } = createDerivedStore()

    act(() => {
      store.getState().setSaveStatus('blocked')
      store.getState().setValidationIssues(['Doors: Door scope 1: door type is required'])
      store.getState().setAutoSaveHint('Doors: Door scope 1: door type is required')
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)
    expect(result.current.saveStatusText).toBe(
      'Unsaved changes - save blocked: Doors: Door scope 1: door type is required'
    )
    expect(result.current.saveStatusText).not.toContain('Saved')
  })
})
