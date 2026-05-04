import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { estimateRouteFamily } from '../../../estimateRouteFamily'
import {
  ESTIMATE_V2_AUTO_SAVE_DELAY_MS,
  useEstimateV2SaveController,
} from '../useEstimateV2SaveController'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { areEstimateV2DirtySnapshotsEqual, buildEstimateV2DirtySnapshot } from '../estimateV2DirtySnapshot'

const authedFetch = vi.fn()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
}))

function createResponse(ok: boolean, payload: unknown, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Server Error',
    text: vi.fn(async () => JSON.stringify(payload)),
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

describe('useEstimateV2SaveController', () => {
  beforeEach(() => {
    authedFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lets autosave persist partial drafts without blocking on incomplete measurement inputs', async () => {
    const harness = createSaveHarness()
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
    authedFetch.mockResolvedValue(createResponse(true, { autosave: true }))

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

    expect(authedFetch).toHaveBeenCalledTimes(1)
    expect(harness.store.getState().meta.saveStatus).toBe('saved')
    expect(harness.store.getState().meta.autoSaveHint).toBe(null)
    expect(harness.store.getState().meta.debugMeta.lastSaveTrigger).toBe('auto')
  })

  it('reports manual save failures through the existing error/debug surfaces', async () => {
    const harness = createSaveHarness()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    authedFetch.mockResolvedValue(createResponse(false, { error: 'Save exploded' }))

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

    expect(authedFetch).not.toHaveBeenCalled()
    expect(harness.store.getState().meta.saving).toBe(false)

    unmount()
    vi.useRealTimers()
  })

  it('saves a dirty manual draft and marks the canonical snapshot saved', async () => {
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
    authedFetch.mockResolvedValue(createResponse(true, harness.fixture.summaryData))

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

    expect(authedFetch).not.toHaveBeenCalled()
    expect(harness.store.getState().meta.saveStatus).toBe('blocked')
    expect(harness.store.getState().meta.error).toBeNull()
    expect(harness.store.getState().meta.autoSaveHint).toContain('trim type is required')
    expect(harness.store.getState().meta.validationIssues[0]).toContain('trim type is required')
    expect(harness.store.getState().meta.debugMeta.lastSaveTrigger).toBe('manual')
  })

  it('keeps saved calculation validation issues in the blocked status path', async () => {
    const harness = createSaveHarness()
    harness.store.getState().setDoorScopes([
      {
        id: 'door-r001-main',
        roomId: 'R001',
        position: 0,
        include: 'Y',
        scopeName: 'Living Room Door',
        doorTypeId: '',
        quantity: '',
        sides: '',
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
    authedFetch.mockResolvedValue(
      createResponse(true, {
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
    const first = deferred<ReturnType<typeof createResponse>>()
    const second = deferred<ReturnType<typeof createResponse>>()
    authedFetch.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)

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

    second.resolve(createResponse(true, harness.fixture.summaryData))
    await secondSave
    first.resolve(createResponse(true, harness.fixture.summaryData))
    await firstSave

    expect(harness.store.getState().meta.lastSavedSnapshot).not.toBeNull()
    expect(harness.store.getState().meta.lastSavedSnapshot?.comparisonKey).toBeTruthy()
  })

  it('falls back to existing calculation payloads when a successful response omits them', async () => {
    const harness = createSaveHarness()
    authedFetch.mockResolvedValue(createResponse(true, {}))

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
    authedFetch.mockResolvedValue(createResponse(true, harness.fixture.summaryData))

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
    authedFetch.mockResolvedValue(createResponse(true, harness.fixture.summaryData))

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

  it('does not treat unchanged door scopes as newer local edits during autosave', async () => {
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
    authedFetch.mockResolvedValue(createResponse(true, { autosave: true }))

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

    expect(harness.store.getState().meta.saveStatus).toBe('saved')
    expect(harness.store.getState().meta.lastSavedSnapshot?.payload.room_door_scopes).toHaveLength(1)
  })

  it('does not apply an older save response over newer local ceiling edits', async () => {
    const harness = createSaveHarness()
    const ceilingScopeId = harness.fixture.ceilingScopes[0].id
    harness.store.getState().setCeilingScopes((prev) =>
      prev.map((scope) =>
        scope.id === ceilingScopeId
          ? { ...scope, ceilingTypeId: 'VAULT', ceilingGeometryMode: 'VAULTED' }
          : scope
      )
    )

    const pending = deferred<ReturnType<typeof createResponse>>()
    authedFetch.mockReturnValue(pending.promise)

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

    const savePromise = result.current.save('auto')
    expect(authedFetch).toHaveBeenCalledTimes(1)

    act(() => {
      harness.store.getState().setCeilingScopes((prev) =>
        prev.map((scope) =>
          scope.id === ceilingScopeId
            ? { ...scope, ceilingTypeId: 'FLAT', ceilingGeometryMode: 'FLAT' }
            : scope
        )
      )
    })

    pending.resolve(createResponse(true, harness.fixture.summaryData))
    await expect(savePromise).resolves.toBe(false)

    const scope = harness.store
      .getState()
      .collections.ceilingScopes.find((entry) => entry.id === ceilingScopeId)
    expect(scope?.ceilingTypeId).toBe('FLAT')
    expect(scope?.ceilingGeometryMode).toBe('FLAT')
    expect(harness.store.getState().meta.saveStatus).toBe('idle')
  })
})
