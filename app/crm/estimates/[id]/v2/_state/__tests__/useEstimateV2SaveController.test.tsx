import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { estimateRouteFamily } from '../../../estimateRouteFamily'
import { useEstimateV2SaveController } from '../useEstimateV2SaveController'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'

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
  let debugMeta = {
    dirtySource: null,
    lastSaveTrigger: null,
    lastNormalizedDomains: [] as string[],
  }

  const collections = {
    rooms: fixture.rooms,
    setRooms: vi.fn(),
    scopes: fixture.scopes,
    setScopes: vi.fn(),
    segments: fixture.segments,
    setSegments: vi.fn(),
    roomFlags: fixture.roomFlags,
    setRoomFlags: vi.fn(),
    ceilingScopes: fixture.ceilingScopes,
    setCeilingScopes: vi.fn(),
    ceilingSegments: fixture.ceilingSegments,
    setCeilingSegments: vi.fn(),
    trimScopes: fixture.trimScopes,
    setTrimScopes: vi.fn(),
  }

  const meta = {
    loading: false,
    setLoading: vi.fn(),
    saving: false,
    setSaving: vi.fn(),
    estimate: fixture.estimate,
    setEstimate: vi.fn(),
    job: fixture.job,
    setJob: vi.fn(),
    catalogs: fixture.catalogs,
    setCatalogs: vi.fn(),
    wallCalculations: fixture.wallCalculations,
    setWallCalculations: vi.fn(),
    ceilingCalculations: fixture.ceilingCalculations,
    setCeilingCalculations: vi.fn(),
    trimCalculations: fixture.trimCalculations,
    setTrimCalculations: vi.fn(),
    selectedRoomId: 'R001',
    setSelectedRoomId: vi.fn(),
    error: null,
    setError: vi.fn(),
    validationIssues: [] as string[],
    setValidationIssues: vi.fn(),
    lastSavedSnapshot: fixture.currentSnapshot,
    setLastSavedSnapshot: vi.fn(),
    saveStatus: 'idle' as const,
    setSaveStatus: vi.fn(),
    autoSaveHint: null,
    setAutoSaveHint: vi.fn(),
    settingsOpen: false,
    setSettingsOpen: vi.fn(),
    jobDefaultsOpen: false,
    setJobDefaultsOpen: vi.fn(),
    jobSettingsDraft: fixture.jobSettingsDraft,
    setJobSettingsDraft: vi.fn(),
    orgJobProductDefaults: fixture.orgJobProductDefaults,
    setOrgJobProductDefaults: vi.fn(),
    customerDraft: {
      customerId: fixture.job.customer_id ?? '',
      name: fixture.job.customer_name ?? '',
      email: fixture.job.customer_email ?? '',
      phone: fixture.job.customer_phone ?? '',
      address: fixture.job.customer_address ?? '',
    },
    setCustomerDraft: vi.fn(),
    debugMeta,
    setDebugMeta: vi.fn((updater) => {
      debugMeta =
        typeof updater === 'function' ? updater(debugMeta) : updater
    }),
  }

  return {
    fixture,
    collections,
    meta,
    effectiveJobProductDefaults: fixture.orgJobProductDefaults,
  }
}

describe('useEstimateV2SaveController', () => {
  beforeEach(() => {
    authedFetch.mockReset()
  })

  it('blocks invalid autosaves and records debug metadata without issuing a request', async () => {
    const harness = createSaveHarness()
    harness.collections.trimScopes = harness.collections.trimScopes.map((scope) =>
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

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        collections: harness.collections as never,
        meta: harness.meta as never,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('auto')).resolves.toBe(false)

    expect(authedFetch).not.toHaveBeenCalled()
    expect(harness.meta.setSaveStatus).toHaveBeenCalledWith('blocked')
    expect(harness.meta.setAutoSaveHint).toHaveBeenCalled()
    expect(harness.meta.setDebugMeta).toHaveBeenCalled()
  })

  it('reports manual save failures through the existing error/debug surfaces', async () => {
    const harness = createSaveHarness()
    authedFetch.mockResolvedValue(createResponse(false, { error: 'Save exploded' }))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        collections: harness.collections as never,
        meta: harness.meta as never,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(false)

    expect(harness.meta.setError).toHaveBeenCalled()
    expect(harness.meta.setSaveStatus).toHaveBeenCalledWith('error')
    expect(harness.meta.setDebugMeta).toHaveBeenCalled()
  })

  it('does not let stale save responses overwrite the latest saved snapshot', async () => {
    const harness = createSaveHarness()
    const first = deferred<ReturnType<typeof createResponse>>()
    const second = deferred<ReturnType<typeof createResponse>>()
    authedFetch
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        collections: harness.collections as never,
        meta: harness.meta as never,
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

    const snapshots = harness.meta.setLastSavedSnapshot.mock.calls.map((call) => call[0])
    expect(snapshots.some((value) => value === '')).toBe(false)
  })

  it('falls back to existing calculation payloads when a successful response omits them', async () => {
    const harness = createSaveHarness()
    authedFetch.mockResolvedValue(createResponse(true, {}))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        collections: harness.collections as never,
        meta: harness.meta as never,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    expect(harness.meta.setWallCalculations).toHaveBeenCalledWith(harness.fixture.wallCalculations)
    expect(harness.meta.setCeilingCalculations).toHaveBeenCalledWith(
      harness.fixture.ceilingCalculations
    )
    expect(harness.meta.setTrimCalculations).toHaveBeenCalledWith(harness.fixture.trimCalculations)
  })

  it('records normalization domains when invalid trim helper state is sanitized before save', async () => {
    const harness = createSaveHarness()
    harness.collections.trimScopes = harness.collections.trimScopes.map((scope) =>
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
    authedFetch.mockResolvedValue(createResponse(true, harness.fixture.summaryData))

    const { result } = renderHook(() =>
      useEstimateV2SaveController({
        estimateId: harness.fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        collections: harness.collections as never,
        meta: harness.meta as never,
        currentSnapshot: harness.fixture.currentSnapshot,
        dirty: true,
        effectiveJobProductDefaults: harness.effectiveJobProductDefaults,
      })
    )

    await expect(result.current.save('manual')).resolves.toBe(true)

    expect(harness.collections.setTrimScopes).toHaveBeenCalled()
    const debugStates = harness.meta.setDebugMeta.mock.calls
      .map((call) => call[0])
      .filter((value) => typeof value === 'function')
      .map((updater) =>
        updater({
          dirtySource: null,
          lastSaveTrigger: null,
          lastNormalizedDomains: [],
        })
      )
    expect(debugStates.some((state) => state.lastNormalizedDomains.includes('trim'))).toBe(true)
  })
})
