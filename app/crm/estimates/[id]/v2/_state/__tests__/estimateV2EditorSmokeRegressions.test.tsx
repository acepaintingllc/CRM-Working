import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import type { EstimateV2DoorScopeDraft } from '@/types/estimator/v2'
import { buildEstimateV2DirtySnapshot } from '../estimateV2DirtySnapshot'
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
  const derived = renderHook(() => useEstimateV2DerivedState({ store }))
  const wallActions = renderHook(() =>
    useEstimateV2WallActions({
      store,
      roomModeById: derived.result.current.roomModeById,
    })
  )
  const ceilingActions = renderHook(() =>
    useEstimateV2CeilingActions({
      store,
      roomModeById: derived.result.current.roomModeById,
    })
  )
  const trimActions = renderHook(() =>
    useEstimateV2TrimActions({
      store,
      trimTypeOptions: fixture.catalogs.trim_items,
      roomModeById: derived.result.current.roomModeById,
      roomHeightFactorByRoomId: derived.result.current.roomHeightFactorByRoomId,
    })
  )
  const doorActions = renderHook(() =>
    useEstimateV2DoorActions({
      store,
      doorTypeOptions: fixture.catalogs.door_types ?? [],
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
})
