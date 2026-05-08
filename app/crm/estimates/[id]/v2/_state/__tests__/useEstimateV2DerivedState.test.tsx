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
  it('uses server-calculated totals as the source of truth while the saved snapshot is clean', () => {
    const { store } = createDerivedStore()

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)
    expect(result.current.sections.calculation.hasServerCalculations).toBe(true)
    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.selectedWallSubtotal).toBe(700)
    expect(result.current.selectedCeilingSubtotal).toBe(180)
    expect(result.current.selectedTrimSubtotal).toBe(210)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBe(700)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBe(180)
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBe(210)
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 476,
      ceilingsSqFt: 180,
      trimMeasurement: 44,
    })
  })

  it('switches displayed totals to local preview values once a saved scope is dirty', () => {
    const { store } = createDerivedStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBe(210)
    expect(result.current.selectedTrimSubtotal).toBe(210)

    act(() => {
      store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main'
            ? { ...scope, helperValue: '50', overrideTotal: '' }
            : scope
        )
      )
    })

    expect(result.current.dirty).toBe(true)
    expect(result.current.sections.calculation.hasServerCalculations).toBe(true)
    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.selectedTrimMeasurement).toBe(44)
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBe(125)
    expect(result.current.selectedTrimSubtotal).toBe(125)
  })

  it('falls back to local preview totals when server wall room totals are missing', () => {
    const { store } = createDerivedStore()

    act(() => {
      store.getState().setMeta((prev) => ({
        ...prev,
        wallCalculations: {
          ...(prev.wallCalculations ?? {}),
          room_totals: [],
        },
      }))
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)
    expect(result.current.sections.calculation.hasServerCalculations).toBe(false)
    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.selectedRoomEffectiveSqFt).toBe(396)
    expect(result.current.selectedWallSubtotal).toBeNull()
    expect(result.current.selectedCeilingSubtotal).toBeNull()
    expect(result.current.selectedTrimSubtotal).toBe(210)
    expect(result.current.activeScopeTotals.wallsSqFt).toBe(476)
  })

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
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 476,
      ceilingsSqFt: 180,
      trimMeasurement: 44,
      trimUnit: 'LF',
      doorSides: 0,
      doorCount: 0,
      doorsActive: false,
    })
    expect(result.current.wallPaintLabel).toBe('Wall Satin')
    expect(result.current.saveStatusText).toBe('Saved Apr 21, 2:00 PM')
    expect(result.current.trimPaintLabel).toBe('Trim Enamel')
  })

  it('formats the loaded canonical estimate updated_at as the saved timestamp', () => {
    const { store } = createDerivedStore()

    act(() => {
      store.getState().setEstimate((prev) =>
        prev ? { ...prev, updated_at: '2026-05-04T15:30:00.000Z' } : prev
      )
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)
    expect(result.current.saveStatusText).toBe('Saved May 4, 3:30 PM')
  })

  it('filters saved validation issues for page display in the save-derived state', () => {
    const { store } = createDerivedStore()

    act(() => {
      store.getState().setValidationIssues([
        'Walls: Scope 1: paint_prod_rate_sqft_per_hour is required',
        'Walls: Scope 1: paint_prod_rate_sqft_per_hour is required',
        'Walls: Scope 1: paint_coverage_sqft_per_gal_per_coat is required',
        'R001: height is required for RECT wall mode',
      ])
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)
    expect(result.current.sections.save.visibleValidationIssues).toEqual([
      'Living Room: height is required for RECT wall mode',
    ])
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

  it('previews geometry edits in scope measurements but keeps calculator subtotals pending before save settles', () => {
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
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBeNull()
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(240)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBeNull()
    expect(result.current.totalEffectiveAreaSqFt).toBe(656)
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 656,
      ceilingsSqFt: 300,
      trimMeasurement: 64,
    })
  })

  it('excludes disabled scopes from subtotal rollups even when a displayed effective total exists', () => {
    const { store } = createDerivedStore()

    act(() => {
      store.getState().setSelectedRoomId('R002')
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r002-main')).toBe(220)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r002-excluded')).toBe(80)
    expect(result.current.selectedWallSubtotal).toBe(220)
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r002-excluded')).toBe(60)
    expect(result.current.selectedTrimSubtotal).toBeNull()
    expect(result.current.selectedTrimMeasurement).toBeNull()
    expect(result.current.activeScopeTotals.wallsSqFt).toBe(476)
    expect(result.current.activeScopeTotals.trimMeasurement).toBe(44)
  })

  it('uses manual overrides as the displayed effective total while preview mode is active', () => {
    const { store } = createDerivedStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main' ? { ...scope, overrideTotal: '333' } : scope
        )
      )
    })

    expect(result.current.dirty).toBe(true)
    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBe(333)
    expect(result.current.selectedTrimSubtotal).toBe(333)
  })

  it('keeps room subtotals internally consistent with estimate-level totals', () => {
    const { store } = createDerivedStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.totalEffectiveAreaSqFt).toBe(476)
    expect(result.current.activeScopeTotals.wallsSqFt).toBe(476)
    expect(result.current.displayedRoomEffectiveAreaByRoomId.get('R001')).toBe(396)
    expect(result.current.displayedRoomEffectiveAreaByRoomId.get('R002')).toBe(80)
    expect(result.current.selectedRoomEffectiveSqFt).toBe(396)
    expect(result.current.selectedWallSubtotal).toBe(700)
    expect(result.current.selectedCeilingSubtotal).toBe(180)
    expect(result.current.selectedTrimSubtotal).toBe(210)
    expect(
      (result.current.displayedRoomEffectiveAreaByRoomId.get('R001') ?? 0) +
        (result.current.displayedRoomEffectiveAreaByRoomId.get('R002') ?? 0)
    ).toBe(result.current.totalEffectiveAreaSqFt)

    act(() => {
      store.getState().setSelectedRoomId('R002')
    })

    expect(result.current.selectedRoomEffectiveSqFt).toBe(80)
    expect(result.current.selectedWallSubtotal).toBe(220)
    expect(result.current.selectedCeilingSubtotal).toBe(90)
    expect(result.current.selectedTrimSubtotal).toBeNull()
    expect(result.current.activeScopeTotals.ceilingsSqFt).toBe(180)
    expect(result.current.activeScopeTotals.trimMeasurement).toBe(44)
  })

  it('keeps the active scope rail totals separated by scope and unit for dirty edits', () => {
    const { store } = createDerivedStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'wall-r001-main' ? { ...scope, overrideAreaSqFt: '488' } : scope
        )
      )
      store.getState().setCeilingScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'ceiling-r001-main' ? { ...scope, areaSf: '180' } : scope
        )
      )
      store.getState().setCeilingSegments((prev) =>
        prev.map((segment) =>
          segment.id === 'ceiling-seg-r002-1' ? { ...segment, manualAreaSqFt: '70' } : segment
        )
      )
      store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main'
            ? { ...scope, helperValue: '54' }
            : scope.id === 'trim-r002-excluded'
              ? { ...scope, include: 'Y', measurementValue: '42' }
              : scope
        )
      )
      store.getState().setDoorScopes([
        {
          id: 'door-r001-main',
          roomId: 'R001',
          position: 0,
          include: 'Y',
          scopeName: 'Entry Door',
          doorTypeId: 'DOOR',
          quantity: '1',
          sides: '2',
          colorId: '',
          paintProductId: '',
          primerProductId: '',
          primeMode: 'NONE',
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
        },
      ])
    })

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.activeScopeTotals).toMatchObject({
      wallsSqFt: 568,
      ceilingsSqFt: 250,
      trimMeasurement: 86,
      trimUnit: 'LF',
      doorSides: 2,
      doorCount: 1,
      doorsActive: true,
    })
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBeNull()
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBeNull()
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r002-excluded')).toBeNull()
  })

  it('keeps ceiling dollar subtotals pending until server calculations refresh', () => {
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
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r002-main')).toBeNull()
  })

  it('keeps dirty door dollar totals off stale server calculations', () => {
    const { fixture, store } = createDerivedStore()
    const savedDoorScope = {
      id: 'door-r001-main',
      roomId: 'R001',
      position: 0,
      include: 'Y' as const,
      scopeName: 'Entry Door',
      doorTypeId: 'DOOR',
      quantity: '2',
      sides: '2',
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
      store.getState().setDoorScopes([savedDoorScope])
      store.getState().setDoorCalculations({
        scopes: [{ id: 'door-r001-main', include: 'Y', effective_units: 4, effective_total: 125 }],
      })
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
          doorScopes: [savedDoorScope],
          drywallRepairs: store.getState().collections.drywallRepairs,
          rollers: store.getState().collections.rollers,
          accessFees: store.getState().collections.accessFees,
          otherItems: store.getState().collections.otherItems,
        })
      )
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.sections.calculation.doorScopeEffectiveTotalById.get('door-r001-main')).toBe(125)
    expect(result.current.sections.calculation.selectedDoorSubtotal).toBe(125)

    act(() => {
      store.getState().setDoorScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'door-r001-main' ? { ...scope, quantity: '3' } : scope
        )
      )
    })

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.sections.calculation.doorScopeEffectiveUnitsById.get('door-r001-main')).toBe(6)
    expect(result.current.sections.calculation.doorScopeEffectiveTotalById.get('door-r001-main')).toBeNull()
    expect(result.current.sections.calculation.selectedDoorSubtotal).toBeNull()

    act(() => {
      store.getState().setDoorScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'door-r001-main' ? { ...scope, overrideTotal: '333' } : scope
        )
      )
    })

    expect(result.current.sections.calculation.doorScopeEffectiveTotalById.get('door-r001-main')).toBe(333)
    expect(result.current.sections.calculation.selectedDoorSubtotal).toBe(333)
  })

  it('keeps dirty drywall dollar totals off stale server calculations', () => {
    const { fixture, store } = createDerivedStore()
    const wallRepair = {
      id: 'drywall-r001-wall',
      roomId: 'R001',
      position: 0,
      surface: 'wall' as const,
      repairType: 'flat_wall_crack',
      unit: 'LF' as const,
      quantity: '4',
      overrideTotal: '',
    }
    const ceilingRepair = {
      id: 'drywall-r001-ceiling',
      roomId: 'R001',
      position: 1,
      surface: 'ceiling' as const,
      repairType: 'ceiling_crack',
      unit: 'LF' as const,
      quantity: '3',
      overrideTotal: '',
    }

    act(() => {
      store.getState().setDrywallRepairs([wallRepair, ceilingRepair])
      store.getState().setDrywallCalculations({
        scopes: [
          { id: 'drywall-r001-wall', effective_quantity: 4, effective_total: 64 },
          { id: 'drywall-r001-ceiling', effective_quantity: 3, effective_total: 90 },
        ],
      })
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
          doorScopes: store.getState().collections.doorScopes,
          drywallRepairs: [wallRepair, ceilingRepair],
          rollers: store.getState().collections.rollers,
          accessFees: store.getState().collections.accessFees,
          otherItems: store.getState().collections.otherItems,
        })
      )
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.sections.calculation.selectedWallDrywallSubtotal).toBe(64)
    expect(result.current.sections.calculation.selectedCeilingDrywallSubtotal).toBe(90)

    act(() => {
      store.getState().setDrywallRepairs((prev) =>
        prev.map((repair) =>
          repair.id === 'drywall-r001-wall'
            ? { ...repair, quantity: '7' }
            : repair.id === 'drywall-r001-ceiling'
              ? { ...repair, overrideTotal: '120' }
              : repair
        )
      )
    })

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.sections.calculation.drywallRepairEffectiveQuantityById.get('drywall-r001-wall')).toBe(7)
    expect(result.current.sections.calculation.drywallRepairEffectiveTotalById.get('drywall-r001-wall')).toBeNull()
    expect(result.current.sections.calculation.selectedWallDrywallSubtotal).toBeNull()
    expect(result.current.sections.calculation.drywallRepairEffectiveTotalById.get('drywall-r001-ceiling')).toBe(120)
    expect(result.current.sections.calculation.selectedCeilingDrywallSubtotal).toBe(120)
  })

  it('does not invent dollar subtotals for new unsaved wall, ceiling, trim, door, or drywall scopes', () => {
    const { store } = createDerivedStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setScopes((prev) => [
        ...prev,
        {
          ...prev[0],
          id: 'wall-r001-unsaved',
          position: 1,
          scopeName: 'Unsaved Wall Scope',
          perimeterIn: '240',
          heightIn: '108',
        },
      ])
      store.getState().setCeilingScopes((prev) => [
        ...prev,
        {
          ...prev[0],
          id: 'ceiling-r001-unsaved',
          position: 1,
          scopeName: 'Unsaved Ceiling Scope',
          lengthIn: '120',
          widthIn: '120',
        },
      ])
      store.getState().setTrimScopes((prev) => [
        ...prev,
        {
          ...prev[0],
          id: 'trim-r001-unsaved',
          position: 1,
          scopeName: 'Unsaved Trim Scope',
          measurementMode: 'MANUAL',
          helperValue: '',
          measurementValue: '32',
          overrideTotal: '',
          overrideHours: '',
        },
      ])
      store.getState().setDoorScopes((prev) => [
        ...prev,
        {
          id: 'door-r001-unsaved',
          roomId: 'R001',
          position: 0,
          include: 'Y',
          scopeName: 'Unsaved Door Scope',
          doorTypeId: 'DOOR',
          quantity: '2',
          sides: '2',
          colorId: '',
          paintProductId: '',
          primerProductId: '',
          primeMode: 'NONE',
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
        },
      ])
      store.getState().setDrywallRepairs((prev) => [
        ...prev,
        {
          id: 'drywall-r001-unsaved',
          roomId: 'R001',
          position: 0,
          surface: 'wall',
          repairType: 'flat_wall_crack',
          unit: 'LF',
          quantity: '5',
          overrideTotal: '',
        },
      ])
    })

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.displayedScopeEffectiveAreaById.get('wall-r001-unsaved')).toBe(180)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-unsaved')).toBeNull()
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-unsaved')).toBeNull()
    expect(result.current.trimScopeEffectiveMeasurementById.get('trim-r001-unsaved')).toBe(32)
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-unsaved')).toBeNull()
    expect(result.current.sections.calculation.doorScopeEffectiveUnitsById.get('door-r001-unsaved')).toBe(4)
    expect(result.current.sections.calculation.doorScopeEffectiveTotalById.get('door-r001-unsaved')).toBeNull()
    expect(result.current.sections.calculation.drywallRepairEffectiveQuantityById.get('drywall-r001-unsaved')).toBe(5)
    expect(result.current.sections.calculation.drywallRepairEffectiveTotalById.get('drywall-r001-unsaved')).toBeNull()
  })

  it('returns to server-calculated subtotals after edited scopes match the saved snapshot again', () => {
    const { store } = createDerivedStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'wall-r001-main' ? { ...scope, primeMode: 'SPOT', spotPrimePercent: '50' } : scope
        )
      )
      store.getState().setCeilingScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'ceiling-r001-main' ? { ...scope, paintProductId: '' } : scope
        )
      )
      store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main' ? { ...scope, helperValue: '50', overrideTotal: '' } : scope
        )
      )
    })

    expect(result.current.useLocalPreviewCalculations).toBe(true)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBeNull()
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBeNull()
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBe(125)

    act(() => {
      store.getState().setScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'wall-r001-main' ? { ...scope, primeMode: 'FULL', spotPrimePercent: '' } : scope
        )
      )
      store.getState().setCeilingScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'ceiling-r001-main' ? { ...scope, paintProductId: 'P-CEIL' } : scope
        )
      )
      store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main' ? { ...scope, helperValue: '44', overrideTotal: '210' } : scope
        )
      )
    })

    expect(result.current.useLocalPreviewCalculations).toBe(false)
    expect(result.current.wallScopeEffectiveTotalById.get('wall-r001-main')).toBe(700)
    expect(result.current.ceilingScopeEffectiveTotalById.get('ceiling-r001-main')).toBe(180)
    expect(result.current.trimScopeEffectiveTotalById.get('trim-r001-main')).toBe(210)
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
      'Unsaved changes - save blocked: Living Room: trim type is required'
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

  it('shows curated save-failed status text while keeping raw error details out of the footer copy', () => {
    const { store } = createDerivedStore()

    act(() => {
      store.getState().setMeta((prev) => ({
        ...prev,
        saveStatus: 'error',
        error: { message: 'Save exploded in route handler', retryable: true },
      }))
      store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Dirty retry room' } : room
        )
      )
    })

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(true)
    expect(result.current.sections.save.canManualSave).toBe(true)
    expect(result.current.saveStatusText).toBe("We couldn't save your changes. Try again.")
    expect(result.current.saveStatusText).not.toContain('Save exploded in route handler')
  })

  it('does not mark the default draft dirty after a failed estimate load', () => {
    const store = createEstimateV2Store()
    store.getState().setMeta((prev) => ({
      ...prev,
      loading: false,
      estimate: null,
      error: { message: 'Quote not found', retryable: true },
      lastSavedSnapshot: null,
    }))

    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    expect(result.current.dirty).toBe(false)
    expect(result.current.currentSnapshot.comparisonKey).toBeTruthy()
  })
})
