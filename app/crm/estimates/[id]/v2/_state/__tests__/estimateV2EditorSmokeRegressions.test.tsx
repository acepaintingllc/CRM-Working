import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import {
  estimateV2FunctionalCompletenessSmokeFixture,
  estimateV2FunctionalCompletenessSmokeIds as functionalSmokeIds,
} from '@/lib/estimator/__fixtures__/canonical/index.ts'
import { calculateDoors } from '@/lib/estimator/doors'
import type { EstimateV2DoorScopeDraft } from '@/types/estimator/v2Scopes'
import { buildEstimateV2DirtySnapshot } from '../estimateV2DirtySnapshot'
import { buildEstimateV2EditorLoadState } from '../estimateV2EditorLoadOrchestration'
import {
  prepareEstimateV2SaveState,
  resolveEstimateV2SaveResponseState,
} from '../estimateV2EditorSaveOrchestration'
import { shouldGuardEstimateV2Navigation } from '../estimateV2NavigationGuard'
import { useEstimateV2CeilingActions } from '../useEstimateV2CeilingActions'
import { useEstimateV2DerivedState } from '../useEstimateV2DerivedState'
import { useEstimateV2DoorActions } from '../useEstimateV2DoorActions'
import { useEstimateV2TrimActions } from '../useEstimateV2TrimActions'
import { useEstimateV2WallActions } from '../useEstimateV2WallActions'

function createDoorScope(include: EstimateV2DoorScopeDraft['include']): EstimateV2DoorScopeDraft {
  return {
    id: 'door-r001-main',
    roomId: 'R001',
    position: 0,
    include,
    scopeName: 'Living Room Door',
    doorTypeId: 'DOOR_PANEL',
    quantity: '1',
    sides: '2',
    colorId: 'COLOR3',
    paintProductId: 'P-TRIM',
    primerProductId: 'P-TRIM-PRIMER',
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
  }
}

function createSmokeRegressionStore() {
  const fixture = createMixedEstimateV2Fixture()
  const doorScopes = [createDoorScope('Y')]
  const store = createEstimateV2Store({
    collections: {
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      accessFees: fixture.accessFees,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
      doorScopes,
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
      catalogsError: null,
      error: null,
      validationIssues: [],
      lastSavedSnapshot: buildEstimateV2DirtySnapshot({
        jobSettingsDraft: fixture.jobSettingsDraft,
        rooms: fixture.rooms,
        scopes: fixture.scopes,
        segments: fixture.segments,
        roomFlags: fixture.roomFlags,
        ceilingScopes: fixture.ceilingScopes,
        ceilingSegments: fixture.ceilingSegments,
        trimScopes: fixture.trimScopes,
        doorScopes,
        rollers: fixture.rollers,
        accessFees: fixture.accessFees,
      }),
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

function createToggleHarness() {
  const { fixture, store } = createSmokeRegressionStore()
  const requestDestructiveConfirm = vi.fn()
  const derived = renderHook(() => useEstimateV2DerivedState({ store }))
  const wallActions = renderHook(() =>
    useEstimateV2WallActions({
      store,
      roomModeById: derived.result.current.roomModeById,
      requestDestructiveConfirm,
    })
  )
  const ceilingActions = renderHook(() =>
    useEstimateV2CeilingActions({
      store,
      roomModeById: derived.result.current.roomModeById,
      requestDestructiveConfirm,
    })
  )
  const trimActions = renderHook(() =>
    useEstimateV2TrimActions({
      store,
      trimTypeOptions: fixture.catalogs.trim_items,
      roomModeById: derived.result.current.roomModeById,
      roomHeightFactorByRoomId: derived.result.current.roomHeightFactorByRoomId,
      requestDestructiveConfirm,
    })
  )
  const doorActions = renderHook(() =>
    useEstimateV2DoorActions({
      store,
      doorTypeOptions: fixture.catalogs.door_types ?? [],
      requestDestructiveConfirm,
    })
  )

  return { store, derived, wallActions, ceilingActions, trimActions, doorActions }
}

describe('Estimate V2 editor smoke regressions', () => {
  it('marks the editor dirty when room scope include toggles change persisted scope membership', () => {
    const toggleCases = [
      {
        dirtySource: 'walls',
        toggle: (harness: ReturnType<typeof createToggleHarness>) =>
          harness.wallActions.result.current.toggleRoomInclude('R001'),
      },
      {
        dirtySource: 'ceilings',
        toggle: (harness: ReturnType<typeof createToggleHarness>) =>
          harness.ceilingActions.result.current.toggleRoomInclude('R001'),
      },
      {
        dirtySource: 'trim',
        toggle: (harness: ReturnType<typeof createToggleHarness>) =>
          harness.trimActions.result.current.toggleRoomInclude('R001'),
      },
      {
        dirtySource: 'doors',
        toggle: (harness: ReturnType<typeof createToggleHarness>) =>
          harness.doorActions.result.current.toggleRoomInclude('R001'),
      },
    ]

    for (const toggleCase of toggleCases) {
      const harness = createToggleHarness()

      expect(harness.derived.result.current.dirty).toBe(false)

      act(() => {
        toggleCase.toggle(harness)
      })

      expect(harness.store.getState().meta.debugMeta.dirtySource).toBe(toggleCase.dirtySource)
      expect(harness.derived.result.current.dirty).toBe(true)
      expect(harness.derived.result.current.saveStatusText).toContain('Unsaved changes')
    }
  })

  it('keeps invalid dirty drafts guarded and never reports the current draft as saved', () => {
    const { store } = createSmokeRegressionStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main' ? { ...scope, trimTypeId: '' } : scope
        )
      )
      store.getState().setDoorScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'door-r001-main' ? { ...scope, doorTypeId: '' } : scope
        )
      )
    })

    expect(result.current.dirty).toBe(true)
    expect(result.current.saveStatusText).toContain('Unsaved changes - save blocked:')
    expect(result.current.saveStatusText).toContain('trim type is required')
    expect(result.current.saveStatusText).not.toContain('Saved')
    expect(
      shouldGuardEstimateV2Navigation({
        saving: false,
        saveVm: {
          dirty: result.current.dirty,
          debugMeta: {
            dirtySource: store.getState().meta.debugMeta.dirtySource,
            lastSaveTrigger: store.getState().meta.debugMeta.lastSaveTrigger,
            lastNormalizedDomains: store.getState().meta.debugMeta.lastNormalizedDomains,
            usingLocalPreview: result.current.useLocalPreviewCalculations,
          },
        },
      })
    ).toBe(true)
  })

  it('keeps geometry edits dirty and saveable after a blocked navigation is cancelled', () => {
    const { store } = createSmokeRegressionStore()
    const { result } = renderHook(() => useEstimateV2DerivedState({ store }))

    act(() => {
      store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, lengthIn: '240' } : room
        )
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

    expect(result.current.dirty).toBe(true)
    expect(result.current.sections.save.canManualSave).toBe(true)
    expect(result.current.saveStatusText).toContain('Unsaved changes')
    expect(result.current.selectedRoomEffectiveSqFt).toBe(576)
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(240)
    expect(result.current.totalEffectiveAreaSqFt).toBe(656)

    const blockedNavigation = shouldGuardEstimateV2Navigation({
      saving: false,
      saveVm: {
        dirty: result.current.dirty,
        debugMeta: {
          dirtySource: store.getState().meta.debugMeta.dirtySource,
          lastSaveTrigger: store.getState().meta.debugMeta.lastSaveTrigger,
          lastNormalizedDomains: store.getState().meta.debugMeta.lastNormalizedDomains,
          usingLocalPreview: result.current.useLocalPreviewCalculations,
        },
      },
    })

    expect(blockedNavigation).toBe(true)

    // Cancelling a guarded navigation should not mutate editor collections or clean snapshots.

    expect(result.current.dirty).toBe(true)
    expect(result.current.sections.save.canManualSave).toBe(true)
    expect(result.current.saveStatusText).toContain('Unsaved changes')
    expect(result.current.selectedRoomEffectiveSqFt).toBe(576)
    expect(result.current.selectedCeilingEffectiveSqFt).toBe(240)
    expect(result.current.totalEffectiveAreaSqFt).toBe(656)
  })

  it('creates a valid trim starter row when trim is activated for a room with no trim items', () => {
    const { fixture, store } = createSmokeRegressionStore()
    const defaultTrimType = fixture.catalogs.trim_items[0]
    expect(defaultTrimType).toBeDefined()
    store.getState().setTrimScopes((prev) => prev.filter((scope) => scope.roomId !== 'R001'))
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
        rollers: store.getState().collections.rollers,
        accessFees: store.getState().collections.accessFees,
      })
    )
    const derived = renderHook(() => useEstimateV2DerivedState({ store }))
    const requestDestructiveConfirm = vi.fn()
    const trimActions = renderHook(() =>
      useEstimateV2TrimActions({
        store,
        trimTypeOptions: fixture.catalogs.trim_items,
        roomModeById: derived.result.current.roomModeById,
        roomHeightFactorByRoomId: derived.result.current.roomHeightFactorByRoomId,
        requestDestructiveConfirm,
      })
    )

    expect(derived.result.current.dirty).toBe(false)

    act(() => {
      trimActions.result.current.toggleRoomInclude('R001')
    })

    const trimScope = store.getState().collections.trimScopes.find((scope) => scope.roomId === 'R001')
    expect(trimScope).toMatchObject({
      include: 'Y',
      trimTypeId: defaultTrimType?.id,
      measurementMode: 'ROOM_HELPER',
      helperSource: 'ROOM_PERIMETER',
    })
    expect(derived.result.current.dirty).toBe(true)
    expect(derived.result.current.sections.save.canManualSave).toBe(true)
    expect(derived.result.current.sections.save.blockingIssues).toEqual([])
    expect(derived.result.current.currentPayload.room_trim_scopes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          room_id: 'R001',
          include: 'Y',
          trim_type_id: defaultTrimType?.id,
          measurement_mode: 'ROOM_HELPER',
        }),
      ])
    )
  })

  it('creates a valid door starter row when doors are activated for a room with no door items', () => {
    const { fixture, store } = createSmokeRegressionStore()
    const doorType = {
      id: 'DOOR_PANEL',
      label: 'Panel door',
      unit_rate_type: 'per_side',
      unit: 'SIDE',
      default_qty: 1,
      labor_rate: 0.4,
      material_rate: 12,
      amount: 12,
    }
    store.getState().setDoorScopes([])
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
        rollers: store.getState().collections.rollers,
        accessFees: store.getState().collections.accessFees,
      })
    )
    const derived = renderHook(() => useEstimateV2DerivedState({ store }))
    const requestDestructiveConfirm = vi.fn()
    const doorActions = renderHook(() =>
      useEstimateV2DoorActions({
        store,
        doorTypeOptions: [doorType],
        requestDestructiveConfirm,
      })
    )

    expect(derived.result.current.dirty).toBe(false)

    act(() => {
      doorActions.result.current.toggleRoomInclude('R001')
    })

    const doorScope = (store.getState().collections.doorScopes ?? []).find(
      (scope) => scope.roomId === 'R001'
    )
    expect(doorScope).toMatchObject({
      include: 'Y',
      doorTypeId: doorType.id,
      quantity: '1',
      sides: '2',
    })
    expect(derived.result.current.dirty).toBe(true)
    expect(derived.result.current.sections.save.canManualSave).toBe(true)
    const doorCalculations = calculateDoors({
      scopes: (derived.result.current.currentPayload.room_door_scopes ?? []).map((scope) => ({
        ...scope,
        room_id: String(scope.room_id),
      })),
      settings: {
        labor_rate_per_hour: fixture.jobSettingsDraft.laborRate,
        crew_size: fixture.jobSettingsDraft.crewSize,
      },
      catalogs: {
        door_unit_rates: [doorType],
      },
    })
    expect(doorCalculations.missing_inputs).toEqual([])
  })

  it('preserves functional-completeness rows through editor save reconciliation and reload', () => {
    const store = createEstimateV2Store(functionalSmokeFixtureStoreState())
    const prepared = prepareEstimateV2SaveState(store.getState())
    const payload = prepared.payloadSnapshot.payload

    expect(payload.rooms).toHaveLength(3)
    expect(payload.room_wall_scopes.map((row) => row.id).sort()).toEqual([
      functionalSmokeIds.walls.bedroom,
      functionalSmokeIds.walls.bedroomExcluded,
    ].sort())
    expect(payload.wall_segments.map((row) => row.id).sort()).toEqual([
      functionalSmokeIds.wallSegments.bedroomManual,
      functionalSmokeIds.wallSegments.bedroomRectangle,
    ].sort())
    expect(payload.room_ceiling_scopes.map((row) => row.id)).toEqual([
      functionalSmokeIds.ceilings.bathroom,
    ])
    expect(payload.ceiling_scope_segments.map((row) => row.id)).toEqual([
      functionalSmokeIds.ceilingSegments.bathroomManual,
    ])
    expect(payload.room_trim_scopes.map((row) => row.id).sort()).toEqual([
      functionalSmokeIds.trim.bedroom,
      functionalSmokeIds.trim.hallway,
    ].sort())
    expect(payload.room_door_scopes?.map((row) => row.id)).toEqual([
      functionalSmokeIds.doors.hallway,
    ])
    expect(payload.drywall_repairs?.map((row) => row.id)).toEqual([
      functionalSmokeIds.drywall.bedroom,
    ])
    expect(payload.access_fees.map((row) => row.id).sort()).toEqual([
      functionalSmokeIds.accessFees.bedroom,
      functionalSmokeIds.accessFees.job,
    ].sort())
    expect(payload.prejob?.map((row) => row.id).sort()).toEqual([
      functionalSmokeIds.prejob.bedroomFurniture,
      functionalSmokeIds.prejob.bedroomWallpaper,
    ].sort())

    const reconciled = resolveEstimateV2SaveResponseState({
      trigger: 'manual',
      payload: {
        estimate: { updated_at: '2026-05-05T12:05:00.000Z' },
        pricing_summary: null,
      },
      meta: store.getState().meta,
      prepared,
      currentState: store.getState(),
      effectiveJobProductDefaults: store.getState().meta.orgJobProductDefaults,
    })

    expect(store.getState().collections.rooms).toHaveLength(3)
    expect(reconciled.collections.scopes.map((row) => row.id).sort()).toEqual(
      payload.room_wall_scopes.map((row) => row.id).sort()
    )
    expect(reconciled.collections.ceilingScopes.map((row) => row.id)).toEqual(
      payload.room_ceiling_scopes.map((row) => row.id)
    )
    expect(reconciled.collections.trimScopes.map((row) => row.id).sort()).toEqual(
      payload.room_trim_scopes.map((row) => row.id).sort()
    )
    expect((reconciled.collections.doorScopes ?? []).map((row) => row.id)).toEqual(
      payload.room_door_scopes?.map((row) => row.id)
    )
    expect((reconciled.collections.drywallRepairs ?? []).map((row) => row.id)).toEqual(
      payload.drywall_repairs?.map((row) => row.id)
    )
    expect((reconciled.collections.prejobTrips ?? []).map((row) => row.id).sort()).toEqual(
      payload.prejob?.map((row) => row.id).sort()
    )

    const fixtureState = functionalSmokeFixtureStoreState()
    const fixtureEstimate = fixtureState.meta.estimate
    if (!fixtureEstimate) throw new Error('Functional smoke fixture is missing estimate metadata')
    const reloadState = buildEstimateV2EditorLoadState({
      store,
      estimatePayload: {
        estimate: {
          ...fixtureEstimate,
          updated_at: '2026-05-05T12:05:00.000Z',
        },
        inputs: {
          jobsettings: payload.jobsettings,
          org_defaults: null,
          paint_products: fixtureState.meta.catalogs.paint_products,
          rooms: payload.rooms,
          room_wall_scopes: payload.room_wall_scopes,
          wall_segments: payload.wall_segments,
          room_ceiling_scopes: payload.room_ceiling_scopes,
          ceiling_scope_segments: payload.ceiling_scope_segments,
          room_trim_scopes: payload.room_trim_scopes,
          room_door_scopes: payload.room_door_scopes ?? [],
          drywall_repairs: payload.drywall_repairs ?? [],
          rollers: payload.rollers,
          prejob: payload.prejob ?? [],
          trim_items: fixtureState.meta.catalogs.trim_items,
          job_colors: fixtureState.meta.catalogs.color_codes,
          room_flags: payload.room_flags,
          access_fees: payload.access_fees,
          other: payload.other ?? [],
        },
        wall_calculations: null,
        ceiling_calculations: null,
        trim_calculations: null,
        door_calculations: null,
        drywall_calculations: null,
        trim_paint: null,
        pricing_summary: null,
      },
      catalogsPayload: { catalogs: fixtureState.meta.catalogs },
      catalogsOk: true,
      catalogsErrorMessage: null,
      job: fixtureState.meta.job,
    })
    const reloadedStore = createEstimateV2Store({
      collections: reloadState.collections,
      meta: {
        loading: false,
        saving: false,
        estimate: reloadState.meta.estimate,
        job: reloadState.meta.job,
        catalogs: reloadState.meta.catalogs,
        wallCalculations: null,
        ceilingCalculations: null,
        trimCalculations: null,
        doorCalculations: null,
        drywallCalculations: null,
        pricingSummary: null,
        selectedRoomId: functionalSmokeIds.rooms.bedroom,
        catalogsError: null,
        error: null,
        validationIssues: reloadState.meta.validationIssues,
        lastSavedSnapshot: reloadState.meta.lastSavedSnapshot,
        saveStatus: reloadState.saveStatus,
        autoSaveHint: null,
        settingsOpen: false,
        jobDefaultsOpen: false,
        jobSettingsDraft: reloadState.meta.jobSettingsDraft,
        orgJobProductDefaults: reloadState.meta.orgJobProductDefaults,
        customerDraft: reloadState.meta.customerDraft,
        debugMeta: reloadState.meta.debugMeta,
      },
    })
    const { result } = renderHook(() => useEstimateV2DerivedState({ store: reloadedStore }))

    expect(result.current.currentPayload.rooms).toHaveLength(3)
    expect(result.current.currentPayload.room_wall_scopes.map((row) => row.id).sort()).toEqual(
      payload.room_wall_scopes.map((row) => row.id).sort()
    )
    expect(result.current.currentPayload.room_door_scopes?.map((row) => row.id)).toEqual([
      functionalSmokeIds.doors.hallway,
    ])
    expect(result.current.currentPayload.prejob?.map((row) => row.id).sort()).toEqual(
      payload.prejob?.map((row) => row.id).sort()
    )
  })
})

function functionalSmokeFixtureStoreState() {
  return structuredClone(estimateV2FunctionalCompletenessSmokeFixture.editorState)
}
