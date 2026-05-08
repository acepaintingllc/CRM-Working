import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { estimateRouteFamily } from '../../../estimateRouteFamily'
import {
  ESTIMATE_V2_AUTO_SAVE_DELAY_MS,
  useEstimateV2SaveController,
} from '../useEstimateV2SaveController'
import { useEstimateV2DerivedState } from '../useEstimateV2DerivedState'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import {
  areEstimateV2DirtySnapshotsEqual,
  buildEstimateV2DirtySnapshot,
  type EstimateV2DirtySnapshot,
} from '../estimateV2DirtySnapshot'

const saveEstimateV2InputsMock = vi.fn()

vi.mock('@/lib/estimates/v2/client', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('@/lib/estimates/v2/client')
  return {
    ...actual,
    saveEstimateV2Inputs: (...args: unknown[]) => saveEstimateV2InputsMock(...args),
  }
})

function createResponse(ok: boolean, payload: unknown, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Server Error',
    text: vi.fn(async () => JSON.stringify(payload)),
  }
}

function createSaveResult(ok: boolean, json: unknown, status = ok ? 200 : 500) {
  const text = JSON.stringify(json)
  const response = createResponse(ok, json, status) as unknown as Response
  const payload =
    json && typeof json === 'object' && 'data' in json
      ? ((json as { data?: unknown }).data ?? null)
      : null
  const error =
    json && typeof json === 'object' && 'error' in json
      ? (json as { error?: unknown }).error
      : null
  const errorMessage =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
        ? String((error as { message: string }).message)
        : ok
          ? null
          : 'Failed to save estimate'

  return {
    endpoint: '/api/estimates/estimate-1',
    method: 'PUT' as const,
    response,
    parsed: { json, text },
    payload,
    errorMessage,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

function createSaveHarness() {
  const fixture = createMixedEstimateV2Fixture()
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
      validationIssues: [],
      lastSavedSnapshot: fixture.currentSnapshot,
      saveStatus: 'idle',
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

  return {
    fixture,
    store,
    effectiveJobProductDefaults: fixture.orgJobProductDefaults,
  }
}

function buildCurrentStoreSnapshot(store: ReturnType<typeof createSaveHarness>['store']) {
  const state = store.getState()
  return buildEstimateV2DirtySnapshot({
    jobSettingsDraft: state.meta.jobSettingsDraft,
    rooms: state.collections.rooms,
    scopes: state.collections.scopes,
    segments: state.collections.segments,
    roomFlags: state.collections.roomFlags,
    rollers: state.collections.rollers,
    accessFees: state.collections.accessFees,
    ceilingScopes: state.collections.ceilingScopes,
    ceilingSegments: state.collections.ceilingSegments,
    trimScopes: state.collections.trimScopes,
    doorScopes: state.collections.doorScopes,
    drywallRepairs: state.collections.drywallRepairs,
    otherItems: state.collections.otherItems,
  })
}

function getTrimPayloadMeasurement(
  snapshot: EstimateV2DirtySnapshot | null | undefined,
  scopeId: string
) {
  if (!snapshot) return null
  const scope = snapshot.payload.room_trim_scopes.find((entry) => entry.id === scopeId)
  return scope?.measurement_value ?? scope?.helper_value ?? null
}

function getStoreTrimMeasurement(store: ReturnType<typeof createSaveHarness>['store'], scopeId: string) {
  const scope = store.getState().collections.trimScopes.find((entry) => entry.id === scopeId)
  if (!scope) return null
  return scope.measurementMode === 'MANUAL' ? Number(scope.measurementValue) : Number(scope.helperValue)
}

function makeDoorScope(patch = {}) {
  return {
    id: 'door-r001-main',
    roomId: 'R001',
    position: 0,
    include: 'Y' as const,
    scopeName: 'Living Room Door',
    doorTypeId: 'DOOR_PANEL',
    quantity: '1',
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
    ...patch,
  }
}

function makeDrywallRepair(patch = {}) {
  return {
    id: 'drywall-r001-main',
    roomId: 'R001',
    position: 0,
    surface: 'wall' as const,
    repairType: 'flat_wall_crack',
    unit: 'LF' as const,
    quantity: '2',
    overrideTotal: '',
    ...patch,
  }
}

describe('useEstimateV2SaveController', () => {
  beforeEach(() => {
    saveEstimateV2InputsMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('commits a focused editor field before Save draft snapshots the payload', async () => {
    const harness = createSaveHarness()
    const events: string[] = []
    const commitFocusedEditorField = vi.fn(() => {
      events.push('commit')
      harness.store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main'
            ? {
                ...scope,
                measurementMode: 'MANUAL',
                measurementValue: '47',
                helperValue: '',
              }
            : scope
        )
      )
    })
    saveEstimateV2InputsMock.mockImplementation(async () => {
      events.push('save')
      return createSaveResult(true, { data: harness.fixture.summaryData })
    })

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: 'estimate-1',
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: buildCurrentStoreSnapshot(harness.store),
        dirty: false,
        commitFocusedEditorField,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    act(() => {
      result.current.saveDraft()
    })

    await waitFor(() => {
      expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)
    })
    const request = saveEstimateV2InputsMock.mock.calls[0][0]
    const savedTrimScope = request.payload.room_trim_scopes.find(
      (scope: { id: string }) => scope.id === 'trim-r001-main'
    )
    expect(events).toEqual(['commit', 'save'])
    expect(savedTrimScope?.measurement_value).toBe(47)
  })

  it('persists trim total and hours overrides through the manual save controller state', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r001-main'
          ? {
              ...scope,
              overrideHours: '3.75',
              overrideSupplyCost: '42',
              overrideTotal: '315',
              overrideDescription: 'Manual trim total',
            }
          : scope
      )
    )
    saveEstimateV2InputsMock.mockResolvedValue(
      createSaveResult(true, { data: harness.fixture.summaryData })
    )

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: buildCurrentStoreSnapshot(harness.store),
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    const request = saveEstimateV2InputsMock.mock.calls[0][0]
    const savedTrimPayload = request.payload.room_trim_scopes.find(
      (scope: { id: string }) => scope.id === 'trim-r001-main'
    )
    const savedTrimScope = harness.store
      .getState()
      .collections.trimScopes.find((scope) => scope.id === 'trim-r001-main')
    const snapshotTrimScope =
      harness.store.getState().meta.lastSavedSnapshot?.payload.room_trim_scopes.find(
        (scope) => scope.id === 'trim-r001-main'
      )

    expect(savedTrimPayload).toMatchObject({
      override_hours: 3.75,
      override_supply_cost: 42,
      override_total: 315,
      override_description: 'Manual trim total',
    })
    expect(savedTrimScope).toMatchObject({
      overrideHours: '3.75',
      overrideSupplyCost: '42',
      overrideTotal: '315',
      overrideDescription: 'Manual trim total',
    })
    expect(snapshotTrimScope).toMatchObject({
      override_hours: 3.75,
      override_supply_cost: 42,
      override_total: 315,
    })
  })

  it('commits a focused editor field before Save & continue decides whether to save', async () => {
    const harness = createSaveHarness()
    const navigateToDetails = vi.fn()
    const commitFocusedEditorField = vi.fn(() => {
      harness.store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === 'trim-r001-main'
            ? {
                ...scope,
                measurementMode: 'MANUAL',
                measurementValue: '49',
                helperValue: '',
              }
            : scope
        )
      )
    })
    saveEstimateV2InputsMock.mockResolvedValue(
      createSaveResult(true, { data: harness.fixture.summaryData })
    )

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: 'estimate-1',
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: buildCurrentStoreSnapshot(harness.store),
        dirty: false,
        commitFocusedEditorField,
        navigateToDetails,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    act(() => {
      result.current.saveAndContinue()
    })

    await waitFor(() => {
      expect(navigateToDetails).toHaveBeenCalledWith('/crm/estimates/estimate-1/v2/details')
    })
    const request = saveEstimateV2InputsMock.mock.calls[0][0]
    const savedTrimScope = request.payload.room_trim_scopes.find(
      (scope: { id: string }) => scope.id === 'trim-r001-main'
    )
    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)
    expect(savedTrimScope?.measurement_value).toBe(49)
  })

  it('lets autosave persist partial drafts without clearing the manual Save Draft snapshot', async () => {
    const harness = createSaveHarness()
    const initialSavedSnapshot = harness.store.getState().meta.lastSavedSnapshot
    harness.store.getState().setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r001-main'
          ? {
              ...scope,
              measurementMode: 'MANUAL',
              helperSource: '',
              helperValue: '',
              measurementValue: '',
            }
        : scope
      )
    )
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(true, { autosave: true }))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('auto')).resolves.toBe(true)

    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)
    expect(harness.store.getState().meta.saveStatus).toBe('idle')
    expect(harness.store.getState().meta.autoSaveHint).toBe(null)
    expect(harness.store.getState().meta.debugMeta.lastSaveTrigger).toBe('auto')
    expect(harness.store.getState().meta.lastSavedSnapshot).toBe(initialSavedSnapshot)
    expect(
      areEstimateV2DirtySnapshotsEqual(
        harness.store.getState().meta.lastSavedSnapshot,
        buildEstimateV2DirtySnapshot({
          jobSettingsDraft: harness.store.getState().meta.jobSettingsDraft,
          rooms: harness.store.getState().collections.rooms,
          scopes: harness.store.getState().collections.scopes,
          segments: harness.store.getState().collections.segments,
          roomFlags: harness.store.getState().collections.roomFlags,
          rollers: harness.store.getState().collections.rollers,
          accessFees: harness.store.getState().collections.accessFees,
          ceilingScopes: harness.store.getState().collections.ceilingScopes,
          ceilingSegments: harness.store.getState().collections.ceilingSegments,
          trimScopes: harness.store.getState().collections.trimScopes,
        })
      )
    ).toBe(false)
  })

  it('reports manual save failures through the existing error/debug surfaces', async () => {
    const harness = createSaveHarness()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(false, { error: 'Save exploded' }))

    try {
      const { result } = renderHook(() =>
        useEstimateV2SaveController({
          estimateId: harness.fixture.estimate.id,
          routeFamily: estimateRouteFamily,
          store: harness.store,
          currentSnapshot: harness.fixture.currentSnapshot,
          dirty: true,
          effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
        })
      )

      await expect(result.current.save('manual')).resolves.toBe(false)

      expect(harness.store.getState().meta.error?.message).toBe('Save exploded')
      expect(harness.store.getState().meta.saveStatus).toBe('error')
      expect(harness.store.getState().meta.debugMeta.lastSaveTrigger).toBe('manual')
      expect(consoleError).toHaveBeenCalledWith(
        'Estimate V2 editor save failed',
        expect.stringContaining('save PUT /api/estimates/'),
        expect.objectContaining({
          operation: 'save',
          method: 'PUT',
          trigger: 'manual',
          status: 500,
          message: 'Save exploded',
          responseEnvelope: 'error',
          errorShape: 'string',
        })
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('leaves a failed autosave draft dirty without promoting the autosave payload', async () => {
    const harness = createSaveHarness()
    const initialSavedSnapshot = harness.store.getState().meta.lastSavedSnapshot
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    harness.store.getState().setRooms((prev) =>
      prev.map((room) =>
        room.roomId === 'R001' ? { ...room, roomName: 'Failed Autosave Room' } : room
      )
    )
    const dirtySnapshot = buildCurrentStoreSnapshot(harness.store)
    saveEstimateV2InputsMock.mockResolvedValue(
      createSaveResult(false, { error: 'Autosave failed' })
    )

    try {
      const { result } = renderHook(() =>
        useEstimateV2SaveController({
          estimateId: harness.fixture.estimate.id,
          routeFamily: estimateRouteFamily,
          store: harness.store,
          currentSnapshot: dirtySnapshot,
          dirty: true,
          effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
        })
      )

      await expect(result.current.save('auto')).resolves.toBe(false)

      expect(harness.store.getState().meta.lastSavedSnapshot).toBe(initialSavedSnapshot)
      expect(
        areEstimateV2DirtySnapshotsEqual(
          harness.store.getState().meta.lastSavedSnapshot,
          dirtySnapshot
        )
      ).toBe(false)
      expect(
        areEstimateV2DirtySnapshotsEqual(
          harness.store.getState().meta.lastSavedSnapshot,
          buildCurrentStoreSnapshot(harness.store)
        )
      ).toBe(false)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('sets retryable error meta when manual save fails', async () => {
    const harness = createSaveHarness()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    saveEstimateV2InputsMock.mockResolvedValue(
      createSaveResult(false, { error: 'Manual retryable failure' })
    )

    try {
      const { result } = renderHook(() =>
        useEstimateV2SaveController({
          estimateId: harness.fixture.estimate.id,
          routeFamily: estimateRouteFamily,
          store: harness.store,
          currentSnapshot: buildCurrentStoreSnapshot(harness.store),
          dirty: true,
          effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
        })
      )

      await expect(result.current.save('manual')).resolves.toBe(false)

      expect(harness.store.getState().meta.error).toEqual({
        message: 'Manual retryable failure',
        code: undefined,
        retryable: true,
      })
      expect(harness.store.getState().meta.saveStatus).toBe('error')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('allows a second manual save retry after a failed save and clears the error on success', async () => {
    const harness = createSaveHarness()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    saveEstimateV2InputsMock
      .mockResolvedValueOnce(createSaveResult(false, { error: 'Server save blew up' }))
      .mockResolvedValueOnce(createSaveResult(true, { data: harness.fixture.summaryData }))

    try {
      const { result } = renderHook(() =>
        useEstimateV2SaveController({
          estimateId: harness.fixture.estimate.id,
          routeFamily: estimateRouteFamily,
          store: harness.store,
          currentSnapshot: buildCurrentStoreSnapshot(harness.store),
          dirty: true,
          effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
        })
      )

      await expect(result.current.save('manual')).resolves.toBe(false)
      expect(harness.store.getState().meta.error?.message).toBe('Server save blew up')
      expect(harness.store.getState().meta.saveStatus).toBe('error')

      await expect(result.current.save('manual')).resolves.toBe(true)

      expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(2)
      expect(harness.store.getState().meta.error).toBeNull()
      expect(harness.store.getState().meta.saveStatus).toBe('saved')
    } finally {
      consoleError.mockRestore()
    }
  })

  it('exposes manual save state transitions from idle to saving to saved', async () => {
    const harness = createSaveHarness()
    const pendingSave = deferred<ReturnType<typeof createSaveResult>>()
    saveEstimateV2InputsMock.mockReturnValue(pendingSave.promise)

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: buildCurrentStoreSnapshot(harness.store),
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    expect(harness.store.getState().meta.saveStatus).toBe('idle')
    const savePromise = result.current.save('manual')
    expect(harness.store.getState().meta.saving).toBe(true)
    expect(harness.store.getState().meta.saveStatus).toBe('idle')

    await act(async () => {
      pendingSave.resolve(createSaveResult(true, { data: harness.fixture.summaryData }))
      await savePromise
    })

    expect(harness.store.getState().meta.saving).toBe(false)
    expect(harness.store.getState().meta.saveStatus).toBe('saved')
  })

  it('exposes failed manual save state transitions from idle to saving to error', async () => {
    const harness = createSaveHarness()
    const pendingSave = deferred<ReturnType<typeof createSaveResult>>()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    saveEstimateV2InputsMock.mockReturnValue(pendingSave.promise)

    try {
      const { result } = renderHook(() =>
        useEstimateV2SaveController({
          estimateId: harness.fixture.estimate.id,
          routeFamily: estimateRouteFamily,
          store: harness.store,
          currentSnapshot: buildCurrentStoreSnapshot(harness.store),
          dirty: true,
          effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
        })
      )

      expect(harness.store.getState().meta.saveStatus).toBe('idle')
      const savePromise = result.current.save('manual')
      expect(harness.store.getState().meta.saving).toBe(true)
      expect(harness.store.getState().meta.saveStatus).toBe('idle')

      await act(async () => {
        pendingSave.resolve(createSaveResult(false, { error: 'Manual transition failed' }))
        await savePromise
      })

      expect(harness.store.getState().meta.saving).toBe(false)
      expect(harness.store.getState().meta.saveStatus).toBe('error')
      expect(harness.store.getState().meta.error?.retryable).toBe(true)
    } finally {
      consoleError.mockRestore()
    }
  })

  it('exposes autosave state transitions from idle to autosaving to idle on success', async () => {
    vi.useFakeTimers()
    const harness = createSaveHarness()
    const pendingSave = deferred<ReturnType<typeof createSaveResult>>()
    saveEstimateV2InputsMock.mockReturnValue(pendingSave.promise)
    harness.store.getState().setRooms((prev) =>
      prev.map((room) =>
        room.roomId === 'R001' ? { ...room, roomName: 'Autosave Transition Room' } : room
      )
    )

    const { unmount } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: buildCurrentStoreSnapshot(harness.store),
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    expect(harness.store.getState().meta.saveStatus).toBe('idle')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_V2_AUTO_SAVE_DELAY_MS)
    })
    expect(harness.store.getState().meta.saving).toBe(true)
    expect(harness.store.getState().meta.saveStatus).toBe('autosaving')

    await act(async () => {
      pendingSave.resolve(createSaveResult(true, { autosave: true }))
      await Promise.resolve()
    })

    expect(harness.store.getState().meta.saving).toBe(false)
    expect(harness.store.getState().meta.saveStatus).toBe('idle')

    unmount()
    vi.useRealTimers()
  })

  it('keeps a dirty draft ready for manual Save Draft before the autosave delay elapses', () => {
    vi.useFakeTimers()
    const harness = createSaveHarness()
    harness.store.getState().setRooms((prev) =>
      prev.map((room) =>
        room.roomId === 'R001' ? { ...room, roomName: 'Living Room Updated' } : room
      )
    )
    const dirtySnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: harness.store.getState().meta.jobSettingsDraft,
      rooms: harness.store.getState().collections.rooms,
      scopes: harness.store.getState().collections.scopes,
      segments: harness.store.getState().collections.segments,
      roomFlags: harness.store.getState().collections.roomFlags,
      rollers: harness.store.getState().collections.rollers,
      accessFees: harness.store.getState().collections.accessFees,
      ceilingScopes: harness.store.getState().collections.ceilingScopes,
      ceilingSegments: harness.store.getState().collections.ceilingSegments,
      trimScopes: harness.store.getState().collections.trimScopes,
    })

    const { unmount } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: dirtySnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    act(() => {
      vi.advanceTimersByTime(ESTIMATE_V2_AUTO_SAVE_DELAY_MS - 1)
    })

    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()
    expect(harness.store.getState().meta.saving).toBe(false)

    unmount()
    vi.useRealTimers()
  })

  it('autosaves after dirty state is set and the autosave delay elapses', async () => {
    vi.useFakeTimers()
    const harness = createSaveHarness()
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(true, { autosave: true }))

    const { rerender, unmount } = renderHook(
      ({ currentSnapshot, dirty }) =>
        useEstimateV2SaveController({
          estimateId: harness.fixture.estimate.id,
          routeFamily: estimateRouteFamily,
          store: harness.store,
          currentSnapshot,
          dirty,
          effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
        }),
      {
        initialProps: {
          currentSnapshot: buildCurrentStoreSnapshot(harness.store),
          dirty: false,
        },
      }
    )

    act(() => {
      harness.store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Autosave Timer Room' } : room
        )
      )
    })
    rerender({
      currentSnapshot: buildCurrentStoreSnapshot(harness.store),
      dirty: true,
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_V2_AUTO_SAVE_DELAY_MS)
    })

    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)
    expect(saveEstimateV2InputsMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        trigger: 'auto',
        payload: expect.objectContaining({
          rooms: expect.arrayContaining([
            expect.objectContaining({
              room_name: 'Autosave Timer Room',
            }),
          ]),
        }),
      })
    )

    unmount()
    vi.useRealTimers()
  })

  it('does not autosave while a save is already in progress', async () => {
    vi.useFakeTimers()
    const harness = createSaveHarness()
    act(() => {
      harness.store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Saving Gate Room' } : room
        )
      )
      harness.store.getState().setSaving(true)
    })

    const { unmount } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: buildCurrentStoreSnapshot(harness.store),
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_V2_AUTO_SAVE_DELAY_MS)
    })

    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()

    unmount()
    vi.useRealTimers()
  })

  it('does not autosave while the estimate is loading', async () => {
    vi.useFakeTimers()
    const harness = createSaveHarness()
    act(() => {
      harness.store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Loading Gate Room' } : room
        )
      )
      harness.store.getState().setLoading(true)
    })

    const { unmount } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: buildCurrentStoreSnapshot(harness.store),
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ESTIMATE_V2_AUTO_SAVE_DELAY_MS)
    })

    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()

    unmount()
    vi.useRealTimers()
  })

  it('does not autosave or manually save when the estimate failed to load', async () => {
    vi.useFakeTimers()
    const store = createEstimateV2Store()
    store.getState().setMeta((prev) => ({
      ...prev,
      loading: false,
      saving: false,
      estimate: null,
      error: { message: 'Quote not found', retryable: true },
      lastSavedSnapshot: null,
    }))
    const currentSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: store.getState().meta.jobSettingsDraft,
      rooms: store.getState().collections.rooms,
      scopes: store.getState().collections.scopes,
      segments: store.getState().collections.segments,
      roomFlags: store.getState().collections.roomFlags,
      ceilingScopes: store.getState().collections.ceilingScopes,
      ceilingSegments: store.getState().collections.ceilingSegments,
      trimScopes: store.getState().collections.trimScopes,
      doorScopes: store.getState().collections.doorScopes,
      drywallRepairs: store.getState().collections.drywallRepairs,
      rollers: store.getState().collections.rollers,
      accessFees: store.getState().collections.accessFees,
      otherItems: store.getState().collections.otherItems,
    })

    const { result, unmount } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: 'missing-estimate',
        routeFamily: estimateRouteFamily,
        store,
        currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: {
          wallPaintProductId: '',
          wallPrimerProductId: '',
          ceilingPaintProductId: '',
          ceilingPrimerProductId: '',
          trimPaintProductId: '',
          trimPrimerProductId: '',
        },
      })
    )

    act(() => {
      vi.advanceTimersByTime(ESTIMATE_V2_AUTO_SAVE_DELAY_MS)
    })

    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()
    await expect(result.current.save('manual')).resolves.toBe(false)
    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()

    unmount()
    vi.useRealTimers()
  })

  it('saves a dirty manual draft and marks the canonical snapshot saved', async () => {
    const harness = createSaveHarness()
    const savedAt = '2026-05-04T15:30:00.000Z'
    harness.store.getState().setRooms((prev) =>
      prev.map((room) =>
        room.roomId === 'R001' ? { ...room, roomName: 'Living Room Updated' } : room
      )
    )
    const dirtySnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: harness.store.getState().meta.jobSettingsDraft,
      rooms: harness.store.getState().collections.rooms,
      scopes: harness.store.getState().collections.scopes,
      segments: harness.store.getState().collections.segments,
      roomFlags: harness.store.getState().collections.roomFlags,
      rollers: harness.store.getState().collections.rollers,
      accessFees: harness.store.getState().collections.accessFees,
      ceilingScopes: harness.store.getState().collections.ceilingScopes,
      ceilingSegments: harness.store.getState().collections.ceilingSegments,
      trimScopes: harness.store.getState().collections.trimScopes,
    })
    saveEstimateV2InputsMock.mockResolvedValue(
      createSaveResult(true, {
        data: {
          ...harness.fixture.summaryData,
          estimate: {
            ...harness.fixture.summaryData.estimate,
            updated_at: savedAt,
          },
        },
      })
    )

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: dirtySnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    expect(harness.store.getState().meta.saveStatus).toBe('saved')
    expect(harness.store.getState().meta.estimate?.updated_at).toBe(savedAt)
    expect(harness.store.getState().meta.debugMeta.lastSaveTrigger).toBe('manual')
    expect(
      areEstimateV2DirtySnapshotsEqual(
        harness.store.getState().meta.lastSavedSnapshot,
        buildEstimateV2DirtySnapshot({
          jobSettingsDraft: harness.store.getState().meta.jobSettingsDraft,
          rooms: harness.store.getState().collections.rooms,
          scopes: harness.store.getState().collections.scopes,
          segments: harness.store.getState().collections.segments,
          roomFlags: harness.store.getState().collections.roomFlags,
          rollers: harness.store.getState().collections.rollers,
          accessFees: harness.store.getState().collections.accessFees,
          ceilingScopes: harness.store.getState().collections.ceilingScopes,
          ceilingSegments: harness.store.getState().collections.ceilingSegments,
          trimScopes: harness.store.getState().collections.trimScopes,
        })
      )
    ).toBe(true)
  })

  it('saves settings drawer edits through the canonical manual draft save while the drawer stays open', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setSettingsOpen(true)
    harness.store.getState().setJobSettingsDraft((prev) => ({
      ...prev,
      laborRate: 90,
      jobMinEnabled: true,
      jobMinAmount: 1250,
    }))
    const dirtySnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: harness.store.getState().meta.jobSettingsDraft,
      rooms: harness.store.getState().collections.rooms,
      scopes: harness.store.getState().collections.scopes,
      segments: harness.store.getState().collections.segments,
      roomFlags: harness.store.getState().collections.roomFlags,
      rollers: harness.store.getState().collections.rollers,
      accessFees: harness.store.getState().collections.accessFees,
      ceilingScopes: harness.store.getState().collections.ceilingScopes,
      ceilingSegments: harness.store.getState().collections.ceilingSegments,
      trimScopes: harness.store.getState().collections.trimScopes,
      doorScopes: harness.store.getState().collections.doorScopes,
      drywallRepairs: harness.store.getState().collections.drywallRepairs,
      otherItems: harness.store.getState().collections.otherItems,
    })
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(true, harness.fixture.summaryData))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: dirtySnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    expect(saveEstimateV2InputsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: `/api/estimates/${harness.fixture.estimate.id}`,
        trigger: 'manual',
        payload: expect.objectContaining({
          jobsettings: expect.objectContaining({
            override_labor_rate: 90,
            job_minimum_enabled: true,
            job_minimum_amount: 1250,
          }),
        }),
      })
    )
    expect(saveEstimateV2InputsMock.mock.calls[0][0].payload.jobsettings).toMatchObject({
      override_labor_rate: 90,
      job_minimum_enabled: true,
      job_minimum_amount: 1250,
    })
    expect(harness.store.getState().meta.settingsOpen).toBe(true)
    expect(harness.store.getState().meta.saveStatus).toBe('saved')
    expect(
      areEstimateV2DirtySnapshotsEqual(
        harness.store.getState().meta.lastSavedSnapshot,
        buildEstimateV2DirtySnapshot({
          jobSettingsDraft: harness.store.getState().meta.jobSettingsDraft,
          rooms: harness.store.getState().collections.rooms,
          scopes: harness.store.getState().collections.scopes,
          segments: harness.store.getState().collections.segments,
          roomFlags: harness.store.getState().collections.roomFlags,
          rollers: harness.store.getState().collections.rollers,
          accessFees: harness.store.getState().collections.accessFees,
          ceilingScopes: harness.store.getState().collections.ceilingScopes,
          ceilingSegments: harness.store.getState().collections.ceilingSegments,
          trimScopes: harness.store.getState().collections.trimScopes,
          doorScopes: harness.store.getState().collections.doorScopes,
          drywallRepairs: harness.store.getState().collections.drywallRepairs,
          otherItems: harness.store.getState().collections.otherItems,
        })
      )
    ).toBe(true)
  })

  it('blocks manual save with validation feedback instead of a console-only error path', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r001-main' ? { ...scope, trimTypeId: '' } : scope
      )
    )

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(false)

    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()
    expect(harness.store.getState().meta.saveStatus).toBe('blocked')
    expect(harness.store.getState().meta.error).toBeNull()
    expect(harness.store.getState().meta.autoSaveHint).toContain('trim type is required')
    expect(harness.store.getState().meta.validationIssues[0]).toContain('trim type is required')
    expect(harness.store.getState().meta.debugMeta.lastSaveTrigger).toBe('manual')
  })

  it('blocks malformed override input before save and leaves the draft value visible', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r001-main' ? { ...scope, overrideTotal: '12abc' } : scope
      )
    )

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(false)

    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()
    expect(harness.store.getState().meta.saveStatus).toBe('blocked')
    expect(harness.store.getState().meta.validationIssues).toEqual([
      'Living Room: Baseboards: total override must be blank or a nonnegative finite number',
    ])
    expect(
      harness.store.getState().collections.trimScopes.find((scope) => scope.id === 'trim-r001-main')
        ?.overrideTotal
    ).toBe('12abc')
  })

  it('blocks invalid door scopes before the network save runs', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setDoorScopes([
      makeDoorScope({
        doorTypeId: '',
        quantity: '',
        sides: '3',
      }),
    ])

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(false)

    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()
    expect(harness.store.getState().meta.saveStatus).toBe('blocked')
    expect(harness.store.getState().meta.autoSaveHint).toContain('door type is required')
    expect(harness.store.getState().meta.validationIssues).toEqual([
      'Living Room: Living Room Door: door type is required',
      'Living Room: Living Room Door: door quantity is required',
      'Living Room: Living Room Door: door sides must be 1 or 2',
    ])
  })

  it('blocks invalid drywall repairs before the network save runs', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setDrywallRepairs([
      makeDrywallRepair({
        repairType: 'flat_wall_crack',
        surface: 'ceiling',
        quantity: '-1',
      }),
    ])

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(false)

    expect(saveEstimateV2InputsMock).not.toHaveBeenCalled()
    expect(harness.store.getState().meta.saveStatus).toBe('blocked')
    expect(harness.store.getState().meta.validationIssues).toEqual([
      'Living Room: Ceiling drywall repair 1: repair type is not valid for the ceiling',
      'Living Room: Ceiling drywall repair 1: quantity must be nonnegative',
    ])
  })

  it('lets valid door and drywall drafts reach the network save', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setDoorScopes([makeDoorScope()])
    harness.store.getState().setDrywallRepairs([makeDrywallRepair()])
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(true, harness.fixture.summaryData))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    expect(saveEstimateV2InputsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          room_door_scopes: [
            expect.objectContaining({
              door_type_id: 'DOOR_PANEL',
              quantity: 1,
              sides: 2,
            }),
          ],
          drywall_repairs: [
            expect.objectContaining({
              repair_type: 'flat_wall_crack',
              surface: 'wall',
              quantity: 2,
            }),
          ],
        }),
      })
    )
  })

  it('keeps saved calculation validation issues in the blocked status path', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setDoorScopes([makeDoorScope()])
    saveEstimateV2InputsMock.mockResolvedValue(
      createSaveResult(true, {
        data: {
          ...harness.fixture.summaryData,
          door_calculations: {
            missing_inputs: [
              {
                message: 'Door scope 1: door type is required',
              },
            ],
          },
        },
      })
    )

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(false)

    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)
    expect(harness.store.getState().meta.saveStatus).toBe('blocked')
    expect(harness.store.getState().meta.autoSaveHint).toBe(
      'Doors: Door scope 1: door type is required'
    )
    expect(harness.store.getState().meta.validationIssues).toEqual([
      'Doors: Door scope 1: door type is required',
    ])
  })

  it('does not let stale save responses overwrite the latest saved snapshot', async () => {
    const harness = createSaveHarness()
    const first = deferred<ReturnType<typeof createSaveResult>>()
    const second = deferred<ReturnType<typeof createSaveResult>>()
    saveEstimateV2InputsMock
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    const firstSave = act(async () => result.current.save('manual'))
    const secondSave = act(async () => result.current.save('manual'))

    second.resolve(createSaveResult(true, harness.fixture.summaryData))
    await secondSave
    first.resolve(createSaveResult(true, harness.fixture.summaryData))
    await firstSave

    expect(harness.store.getState().meta.lastSavedSnapshot).not.toBeNull()
    expect(harness.store.getState().meta.lastSavedSnapshot?.comparisonKey).toBeTruthy()
  })

  it('queues one follow-up manual save when Save Draft is requested during an in-flight save', async () => {
    const harness = createSaveHarness()
    const first = deferred<ReturnType<typeof createSaveResult>>()
    saveEstimateV2InputsMock
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(createSaveResult(true, { data: harness.fixture.summaryData }))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    const firstSave = result.current.save('manual')
    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)

    act(() => {
      harness.store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Queued Manual Save Room' } : room
        )
      )
    })

    await expect(result.current.save('manual')).resolves.toBe(false)

    let firstSaveResult: boolean | undefined
    await act(async () => {
      first.resolve(createSaveResult(true, { data: harness.fixture.summaryData }))
      firstSaveResult = await firstSave
    })

    expect(firstSaveResult).toBe(true)
    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(2)
    expect(saveEstimateV2InputsMock.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        trigger: 'manual',
        payload: expect.objectContaining({
          rooms: expect.arrayContaining([
            expect.objectContaining({
              room_name: 'Queued Manual Save Room',
            }),
          ]),
        }),
      })
    )
    expect(harness.store.getState().meta.saveStatus).toBe('saved')
    expect(
      areEstimateV2DirtySnapshotsEqual(
        harness.store.getState().meta.lastSavedSnapshot,
        buildCurrentStoreSnapshot(harness.store)
      )
    ).toBe(true)
  })

  it('queues one follow-up manual save after an in-flight autosave and includes later edits', async () => {
    const harness = createSaveHarness()
    const autosave = deferred<ReturnType<typeof createSaveResult>>()
    saveEstimateV2InputsMock
      .mockImplementationOnce(() => autosave.promise)
      .mockResolvedValueOnce(createSaveResult(true, { data: harness.fixture.summaryData }))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: buildCurrentStoreSnapshot(harness.store),
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    act(() => {
      harness.store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Autosave In Flight Room' } : room
        )
      )
    })
    const autosavePromise = result.current.save('auto')
    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)
    expect(saveEstimateV2InputsMock.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        trigger: 'auto',
        payload: expect.objectContaining({
          rooms: expect.arrayContaining([
            expect.objectContaining({
              room_name: 'Autosave In Flight Room',
            }),
          ]),
        }),
      })
    )

    act(() => {
      harness.store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Manual Follow Up Room' } : room
        )
      )
    })

    await expect(result.current.save('manual')).resolves.toBe(false)
    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      autosave.resolve(createSaveResult(true, { autosave: true }))
      await autosavePromise
    })

    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(2)
    expect(saveEstimateV2InputsMock.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        trigger: 'manual',
        payload: expect.objectContaining({
          rooms: expect.arrayContaining([
            expect.objectContaining({
              room_name: 'Manual Follow Up Room',
            }),
          ]),
        }),
      })
    )
    expect(harness.store.getState().meta.saving).toBe(false)
    expect(harness.store.getState().meta.saveStatus).toBe('saved')
    expect(
      areEstimateV2DirtySnapshotsEqual(
        harness.store.getState().meta.lastSavedSnapshot,
        buildCurrentStoreSnapshot(harness.store)
      )
    ).toBe(true)
  })

  it('coalesces repeated manual save attempts during saving into a single follow-up save', async () => {
    const harness = createSaveHarness()
    const first = deferred<ReturnType<typeof createSaveResult>>()
    saveEstimateV2InputsMock
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(createSaveResult(true, { data: harness.fixture.summaryData }))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    const firstSave = result.current.save('manual')
    act(() => {
      harness.store.getState().setRooms((prev) =>
        prev.map((room) =>
          room.roomId === 'R001' ? { ...room, roomName: 'Coalesced Manual Save Room' } : room
        )
      )
    })

    await expect(result.current.save('manual')).resolves.toBe(false)
    await expect(result.current.save('manual')).resolves.toBe(false)

    await act(async () => {
      first.resolve(createSaveResult(true, { data: harness.fixture.summaryData }))
      await firstSave
    })

    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(2)
    expect(saveEstimateV2InputsMock.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        trigger: 'manual',
        payload: expect.objectContaining({
          rooms: expect.arrayContaining([
            expect.objectContaining({
              room_name: 'Coalesced Manual Save Room',
            }),
          ]),
        }),
      })
    )
  })

  it('does not show a reverted manual trim draft as saved when an in-flight save persisted the intermediate value', async () => {
    const harness = createSaveHarness()
    const trimScopeId = 'trim-r001-main'
    act(() => {
      harness.store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === trimScopeId
            ? {
                ...scope,
                measurementMode: 'MANUAL',
                helperSource: '',
                helperValue: '',
                measurementValue: '44',
              }
            : scope
        )
      )
      harness.store.getState().setLastSavedSnapshot(buildCurrentStoreSnapshot(harness.store))
      harness.store.getState().setSaveStatus('saved')
    })

    const pendingSave = deferred<ReturnType<typeof createSaveResult>>()
    saveEstimateV2InputsMock.mockReturnValue(pendingSave.promise)

    const { result } = renderHook(() => {
      const derived = useEstimateV2DerivedState({ store: harness.store })
      const controller = useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: derived.currentSnapshot,
        dirty: derived.dirty,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
      return { derived, save: controller.save }
    })

    expect(result.current.derived.dirty).toBe(false)
    expect(result.current.derived.saveStatusText).toContain('Saved')

    act(() => {
      harness.store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === trimScopeId ? { ...scope, measurementValue: '43' } : scope
        )
      )
    })

    expect(result.current.derived.dirty).toBe(true)
    expect(result.current.derived.currentPayload.room_trim_scopes[0].measurement_value).toBe(43)

    const savePromise = result.current.save('manual')
    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)
    const savedRequest = saveEstimateV2InputsMock.mock.calls[0]?.[0] as {
      payload: { room_trim_scopes: Array<{ id: string; measurement_value: number | null }> }
    }
    const persistedTrimMeasurement =
      savedRequest.payload.room_trim_scopes.find((scope) => scope.id === trimScopeId)
        ?.measurement_value ?? null
    expect(persistedTrimMeasurement).toBe(43)

    act(() => {
      harness.store.getState().setTrimScopes((prev) =>
        prev.map((scope) =>
          scope.id === trimScopeId ? { ...scope, measurementValue: '44' } : scope
        )
      )
    })

    let saveSucceeded: boolean | undefined
    await act(async () => {
      pendingSave.resolve(createSaveResult(true, { data: harness.fixture.summaryData }))
      saveSucceeded = await savePromise
    })
    expect(saveSucceeded).toBe(false)

    const lastSavedTrimMeasurement = getTrimPayloadMeasurement(
      harness.store.getState().meta.lastSavedSnapshot,
      trimScopeId
    )
    const currentTrimMeasurement = getStoreTrimMeasurement(harness.store, trimScopeId)

    expect(lastSavedTrimMeasurement).toBe(persistedTrimMeasurement)
    expect(currentTrimMeasurement).toBe(44)
    expect(result.current.derived.dirty).toBe(true)
    expect(result.current.derived.sections.save.canManualSave).toBe(true)
    expect(result.current.derived.saveStatusText).not.toContain('Saved')
  })

  it('falls back to existing calculation payloads when a successful response omits them', async () => {
    const harness = createSaveHarness()
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(true, {}))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    expect(harness.store.getState().meta.wallCalculations).toEqual(harness.fixture.wallCalculations)
    expect(harness.store.getState().meta.ceilingCalculations).toEqual(
      harness.fixture.ceilingCalculations
    )
    expect(harness.store.getState().meta.trimCalculations).toEqual(harness.fixture.trimCalculations)
  })

  it('records normalization domains when invalid trim helper state is sanitized before save', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r002-excluded'
          ? {
              ...scope,
              include: 'Y',
              measurementMode: 'ROOM_HELPER',
              helperSource: 'ROOM_PERIMETER',
              helperValue: '12',
              measurementValue: '12',
            }
          : scope
      )
    )
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(true, harness.fixture.summaryData))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    expect(harness.store.getState().meta.debugMeta.lastNormalizedDomains.includes('trim')).toBe(
      true
    )
    expect(
      harness.store
        .getState()
        .collections.trimScopes.find((scope) => scope.id === 'trim-r002-excluded')?.helperValue
    ).not.toBe('12')
  })

  it('updates the saved snapshot to the sanitized canonical state after a successful save', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setTrimScopes((prev) =>
      prev.map((scope) =>
        scope.id === 'trim-r002-excluded'
          ? {
              ...scope,
              include: 'Y',
              measurementMode: 'ROOM_HELPER',
              helperSource: 'ROOM_PERIMETER',
              helperValue: '12',
              measurementValue: '12',
            }
          : scope
      )
    )
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(true, harness.fixture.summaryData))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    const expectedSavedSnapshot = buildEstimateV2DirtySnapshot({
      jobSettingsDraft: harness.store.getState().meta.jobSettingsDraft,
      rooms: harness.store.getState().collections.rooms,
      scopes: harness.store.getState().collections.scopes,
      segments: harness.store.getState().collections.segments,
      roomFlags: harness.store.getState().collections.roomFlags,
      rollers: harness.store.getState().collections.rollers,
      accessFees: harness.store.getState().collections.accessFees,
      ceilingScopes: harness.store.getState().collections.ceilingScopes,
      ceilingSegments: harness.store.getState().collections.ceilingSegments,
      trimScopes: harness.store.getState().collections.trimScopes,
    })

    expect(
      areEstimateV2DirtySnapshotsEqual(
        harness.store.getState().meta.lastSavedSnapshot,
        expectedSavedSnapshot
      )
    ).toBe(true)
  })

  it('persists autosaved door scopes without promoting them to the clean snapshot', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setDoorScopes([
      {
        id: 'door-r001-main',
        roomId: 'R001',
        position: 0,
        include: 'Y',
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
      },
    ])
    saveEstimateV2InputsMock.mockResolvedValue(createSaveResult(true, { autosave: true }))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('auto')).resolves.toBe(true)

    expect(harness.store.getState().meta.saveStatus).toBe('idle')
    expect(harness.store.getState().meta.lastSavedSnapshot?.payload.room_door_scopes).toHaveLength(0)
  })

  it('ignores a stale autosave response when newer local ceiling edits remain dirty', async () => {
    const harness = createSaveHarness()
    const ceilingScopeId = harness.fixture.ceilingScopes[0].id
    harness.store.getState().setCeilingScopes((prev) =>
      prev.map((scope) =>
        scope.id === ceilingScopeId
          ? { ...scope, ceilingTypeId: 'VAULT', ceilingGeometryMode: 'VAULTED' }
          : scope
      )
    )

    const pending = deferred<ReturnType<typeof createSaveResult>>()
    saveEstimateV2InputsMock.mockReturnValue(pending.promise)

    const { result } = renderHook(() => {
      const derived = useEstimateV2DerivedState({ store: harness.store })
      const controller = useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store: harness.store,
        currentSnapshot: derived.currentSnapshot,
        dirty: derived.dirty,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
      return { derived, save: controller.save }
    })

    expect(result.current.derived.dirty).toBe(true)
    const savePromise = result.current.save('auto')
    expect(saveEstimateV2InputsMock).toHaveBeenCalledTimes(1)

    act(() => {
      harness.store.getState().setCeilingScopes((prev) =>
        prev.map((scope) =>
          scope.id === ceilingScopeId
            ? { ...scope, ceilingTypeId: 'FLAT', ceilingGeometryMode: 'FLAT' }
            : scope
        )
      )
    })
    expect(result.current.derived.dirty).toBe(true)

    pending.resolve(createSaveResult(true, harness.fixture.summaryData))
    await expect(savePromise).resolves.toBe(false)

    const scope = harness.store
      .getState()
      .collections.ceilingScopes.find((entry) => entry.id === ceilingScopeId)
    expect(scope?.ceilingTypeId).toBe('FLAT')
    expect(scope?.ceilingGeometryMode).toBe('FLAT')
    expect(harness.store.getState().meta.saveStatus).toBe('idle')
    expect(result.current.derived.dirty).toBe(true)
  })
})
