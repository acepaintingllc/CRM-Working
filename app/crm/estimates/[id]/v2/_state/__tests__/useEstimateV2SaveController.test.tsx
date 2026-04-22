import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
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

  it('blocks invalid autosaves and records debug metadata without issuing a request', async () => {
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

    await expect(result.current.save('auto')).resolves.toBe(false)

    expect(authedFetch).not.toHaveBeenCalled()
    expect(harness.store.getState().meta.saveStatus).toBe('blocked')
    expect(harness.store.getState().meta.autoSaveHint).toBeTruthy()
    expect(harness.store.getState().meta.debugMeta.lastSaveTrigger).toBe('auto')
  })

  it('reports manual save failures through the existing error/debug surfaces', async () => {
    const harness = createSaveHarness()
    authedFetch.mockResolvedValue(createResponse(false, { error: 'Save exploded' }))

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

    expect(harness.store.getState().meta.lastSavedSnapshot).not.toBe('')
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
})
