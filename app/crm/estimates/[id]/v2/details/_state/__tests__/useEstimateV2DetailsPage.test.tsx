import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMixedEstimateV2Fixture } from '../../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import type { EstimateV2EditorStoreApi } from '@/lib/estimates/v2/store/estimateV2Store'
import { estimateRouteFamily } from '../../../../estimateRouteFamily'
import { useEstimateV2DetailsPage } from '../useEstimateV2DetailsPage'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  authedFetch: vi.fn(),
  useEstimateV2EditorLoader: vi.fn(),
  initializedStores: new WeakSet<object>(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => mocks.authedFetch(...args),
}))

vi.mock('../../../_state/useEstimateV2EditorLoader', () => ({
  useEstimateV2EditorLoader: mocks.useEstimateV2EditorLoader,
}))

function createResponse(payload: unknown, init?: { ok?: boolean; status?: number; statusText?: string }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    statusText: init?.statusText ?? 'OK',
    text: vi.fn(async () => JSON.stringify({ data: payload })),
  }
}

function createErrorResponse(message: string, status = 500) {
  return {
    ok: false,
    status,
    statusText: 'Server Error',
    text: vi.fn(async () => JSON.stringify({ error: message })),
  }
}

function createRollerRatesPayload() {
  return {
    categories: [
      {
        key: 'supply_rates_roller_covers',
        rows: [
          {
            id: 'WALL_9',
            display_name: 'Wall',
            scope: 'Wall',
            size_in: 9,
            price_each: 6,
            active: 'Y',
          },
          {
            id: 'WALL_12',
            display_name: 'Wall',
            scope: 'Wall',
            size_in: 12,
            price_each: 8,
            active: 'Y',
          },
          {
            id: 'CEIL_14',
            display_name: 'Ceiling',
            scope: 'Ceiling',
            size_in: 14,
            price_each: 10,
            active: 'Y',
          },
          {
            id: 'TRIM_4',
            display_name: 'Trim applicator',
            scope: 'Trim',
            size_in: 4,
            price_each: 4,
            active: 'Y',
          },
        ],
      },
    ],
  }
}

function hasSaveRequest(estimateId: string) {
  return mocks.authedFetch.mock.calls.some(
    ([url, init]) =>
      url === estimateRouteFamily.estimateApiHref(estimateId) &&
      typeof init === 'object' &&
      init != null &&
      (init as { method?: string }).method === 'PUT'
  )
}

function validationMessages(vm: ReturnType<typeof useEstimateV2DetailsPage>['vm']) {
  return vm.validationIssues.map((issue) => issue.message)
}

function mockLoadedEstimate(fixture: ReturnType<typeof createMixedEstimateV2Fixture>) {
  mocks.useEstimateV2EditorLoader.mockImplementation(({ store }: { store: EstimateV2EditorStoreApi }) => {
    if (mocks.initializedStores.has(store)) return
    mocks.initializedStores.add(store)
    const state = store.getState()
    state.setCollections({
      rooms: fixture.rooms,
      scopes: fixture.scopes,
      segments: fixture.segments,
      roomFlags: fixture.roomFlags,
      rollers: fixture.rollers,
      ceilingScopes: fixture.ceilingScopes,
      ceilingSegments: fixture.ceilingSegments,
      trimScopes: fixture.trimScopes,
    })
    state.setMeta((prev) => ({
      ...prev,
      loading: false,
      estimate: fixture.estimate,
      job: fixture.job,
      catalogs: fixture.catalogs,
      wallCalculations: fixture.wallCalculations,
      ceilingCalculations: fixture.ceilingCalculations,
      trimCalculations: fixture.trimCalculations,
      pricingSummary: fixture.pricingSummary,
      lastSavedSnapshot: fixture.currentSnapshot,
    }))
  })
}

describe('useEstimateV2DetailsPage', () => {
  beforeEach(() => {
    mocks.push.mockReset()
    mocks.authedFetch.mockReset()
    mocks.useEstimateV2EditorLoader.mockReset()
  })

  it('writes roller changes into the canonical persisted editor collection', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [
          {
            key: 'supply_rates_roller_covers',
            rows: [
              {
                id: 'WALL_12',
                display_name: 'Wall',
                scope: 'Wall',
                size_in: 12,
                price_each: 8,
                active: 'Y',
              },
              {
                id: 'CEIL_14',
                display_name: 'Ceiling',
                scope: 'Ceiling',
                size_in: 14,
                price_each: 10,
                active: 'Y',
              },
              {
                id: 'TRIM_4',
                display_name: 'Trim applicator',
                scope: 'Trim',
                size_in: 4,
                price_each: 4,
                active: 'Y',
              },
            ],
          },
        ],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.wallRollerOptions.some((option) => option.id === 'WALL_12')).toBe(
        true
      )
    })

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Changed from details page',
      })
      result.current.actions.setRollerRow('wall:COLOR2', {
        coverId: 'WALL_12',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('ceiling', {
        coverId: 'CEIL_14',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('trim', {
        coverId: 'TRIM_4',
        quantity: '2',
        notes: 'Trim applicator',
      })
    })

    expect(result.current.vm.wallRollerRows[0]).toMatchObject({
      coverId: 'WALL_12',
      quantity: '3',
      notes: 'Changed from details page',
      errors: [],
    })
    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })
    const saveRequest = mocks.authedFetch.mock.calls.find(
      ([url, init]) =>
        url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) &&
        typeof init === 'object' &&
        init != null &&
        (init as { method?: string }).method === 'PUT'
    )
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      rollers: Array<{
        scope: string
        wall_color_id: string | null
        selected_option_id: string | null
        roller_size_in: number | null
        covers_qty: number | null
        notes: string | null
      }>
    }
    expect(body.rollers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'Wall',
          wall_color_id: 'COLOR1',
          selected_option_id: 'WALL_12',
          roller_size_in: 12,
          covers_qty: 3,
          notes: 'Changed from details page',
        }),
        expect.objectContaining({
          scope: 'Ceiling',
          wall_color_id: null,
          selected_option_id: 'CEIL_14',
          roller_size_in: 14,
          covers_qty: 1,
        }),
        expect.objectContaining({
          scope: 'Trim',
          wall_color_id: null,
          selected_option_id: 'TRIM_4',
          roller_size_in: 4,
          covers_qty: 2,
          notes: 'Trim applicator',
        }),
      ])
    )
  })

  it('round-trips unassigned wall scope roller identity through details draft save payloads', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes[0] = {
      ...fixture.scopes[0],
      id: 'wall-unassigned',
      scopeName: 'Unassigned walls',
      colorId: '',
    }
    const wallCalculationScopes = fixture.wallCalculations.scopes ?? []
    const wallCalculationTraces = fixture.wallCalculations.scope_traces ?? []
    fixture.wallCalculations.scopes = wallCalculationScopes
    fixture.wallCalculations.scope_traces = wallCalculationTraces
    wallCalculationScopes[0] = {
      ...wallCalculationScopes[0],
      id: 'wall-unassigned',
      color_id: null,
      scope_name: 'Unassigned walls',
    }
    wallCalculationTraces[0] = {
      ...wallCalculationTraces[0],
      scope_id: 'wall-unassigned',
    }
    fixture.rollers = [
      {
        id: 'roller-unassigned',
        scope: 'Wall',
        wallColorId: 'SCOPE:wall-unassigned',
        selectedOptionId: 'WALL_9',
        rollerSizeIn: '9',
        coversQty: '2',
        notes: 'Saved unassigned scope',
        position: 0,
      },
      {
        id: 'roller-wall-color-2',
        scope: 'Wall',
        wallColorId: 'COLOR2',
        selectedOptionId: 'WALL_12',
        rollerSizeIn: '12',
        coversQty: '1',
        notes: '',
        position: 1,
      },
    ]
    mocks.authedFetch.mockResolvedValue(createResponse(createRollerRatesPayload()))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    const unassignedRow = result.current.vm.wallRollerRows.find(
      (row) => row.id === 'wall:scope:wall-unassigned'
    )
    expect(unassignedRow).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Saved unassigned scope',
    })

    act(() => {
      result.current.actions.setRollerRow('wall:scope:wall-unassigned', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Updated unassigned scope',
      })
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = mocks.authedFetch.mock.calls.find(
      ([url, init]) =>
        url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) &&
        typeof init === 'object' &&
        init != null &&
        (init as { method?: string }).method === 'PUT'
    )
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as {
      rollers: Array<{
        id: string
        scope: string
        wall_color_id: string | null
        selected_option_id: string | null
        roller_size_in: number | null
        covers_qty: number | null
        notes: string | null
      }>
    }
    expect(body.rollers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'roller-unassigned',
          scope: 'Wall',
          wall_color_id: 'scope:wall-unassigned',
          selected_option_id: 'WALL_12',
          roller_size_in: 12,
          covers_qty: 3,
          notes: 'Updated unassigned scope',
        }),
      ])
    )
  })

  it('blocks ambiguous same-size roller options instead of silently rehydrating the first match', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [
          {
            key: 'supply_rates_roller_covers',
            rows: [
              {
                id: 'WALL_9_STANDARD',
                display_name: 'Wall standard',
                scope: 'Wall',
                size_in: 9,
                price_each: 6,
                active: 'Y',
              },
              {
                id: 'WALL_9_PREMIUM',
                display_name: 'Wall premium',
                scope: 'Wall',
                size_in: 9,
                price_each: 8,
                active: 'Y',
              },
              {
                id: 'CEIL_14',
                display_name: 'Ceiling',
                scope: 'Ceiling',
                size_in: 14,
                price_each: 10,
                active: 'Y',
              },
              {
                id: 'TRIM_4',
                display_name: 'Trim applicator',
                scope: 'Trim',
                size_in: 4,
                price_each: 4,
                active: 'Y',
              },
            ],
          },
        ],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.wallRollerOptions).toHaveLength(2)
    })

    expect(result.current.vm.wallRollerRows[0]).toMatchObject({
      coverId: '',
      quantity: '2',
      notes: 'Main wall roller',
    })
    expect(validationMessages(result.current.vm)).toContain(
      'Warm White saved wall roller cover size 9" matches multiple active options; make sizes unique before continuing.'
    )

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(mocks.push).not.toHaveBeenCalled()
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('blocks continue to summary when a stale saved roller option has no safe fallback', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.rollers[0] = {
      ...fixture.rollers[0],
      selectedOptionId: 'WALL_9_ARCHIVED',
      rollerSizeIn: '9',
      coversQty: '2',
    }
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [
          {
            key: 'supply_rates_roller_covers',
            rows: [
              {
                id: 'WALL_12',
                display_name: 'Wall',
                scope: 'Wall',
                size_in: 12,
                price_each: 8,
                active: 'Y',
              },
              {
                id: 'CEIL_14',
                display_name: 'Ceiling',
                scope: 'Ceiling',
                size_in: 14,
                price_each: 10,
                active: 'Y',
              },
              {
                id: 'TRIM_4',
                display_name: 'Trim applicator',
                scope: 'Trim',
                size_in: 4,
                price_each: 4,
                active: 'Y',
              },
            ],
          },
        ],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    expect(result.current.vm.validationIssues.map((issue) => issue.id)).toContain(
      'rollers:wall:COLOR1:coverId:stale-option'
    )

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(mocks.push).not.toHaveBeenCalled()
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('blocks continue to summary while roller options are unavailable', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createErrorResponse('Rates unavailable', 503))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('unavailable')
    })

    expect(result.current.vm.continueBlockedReason).toBe('Rates unavailable')

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(mocks.push).not.toHaveBeenCalled()
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('saves and routes to summary when continue validation passes', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_9',
        quantity: '2',
        notes: 'Main wall roller',
      })
      result.current.actions.setRollerRow('wall:COLOR2', {
        coverId: 'WALL_12',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('ceiling', {
        coverId: 'CEIL_14',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('trim', {
        coverId: 'TRIM_4',
        quantity: '2',
        notes: '',
      })
    })

    expect(result.current.vm.canContinueToSummary).toBe(true)

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(true)
    })

    expect(hasSaveRequest(fixture.estimate.id)).toBe(true)
    expect(mocks.push).toHaveBeenCalledWith(estimateRouteFamily.summaryHref(fixture.estimate.id))
  })

  it('does not route to summary when continue save fails', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createErrorResponse('Save failed during continue', 500)
      }
      return createResponse(createRollerRatesPayload())
    })
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_9',
        quantity: '2',
        notes: '',
      })
      result.current.actions.setRollerRow('wall:COLOR2', {
        coverId: 'WALL_12',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('ceiling', {
        coverId: 'CEIL_14',
        quantity: '1',
        notes: '',
      })
      result.current.actions.setRollerRow('trim', {
        coverId: 'TRIM_4',
        quantity: '2',
        notes: '',
      })
    })

    expect(result.current.vm.canContinueToSummary).toBe(true)

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(hasSaveRequest(fixture.estimate.id)).toBe(true)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(result.current.error?.message).toBe('Save failed during continue')
    expect(result.current.saveStatus).toBe('error')
  })

  it('blocks continue to summary when grouped wall overrides conflict', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes = [
      {
        ...fixture.scopes[0],
        id: 'wall-conflict-a',
        colorId: 'COLOR1',
        overridePaintGallons: '4',
      },
      {
        ...fixture.scopes[1],
        id: 'wall-conflict-b',
        colorId: 'COLOR1',
        overridePaintGallons: '5',
      },
    ]
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [
          {
            key: 'supply_rates_roller_covers',
            rows: [
              {
                id: 'WALL_9',
                display_name: 'Wall',
                scope: 'Wall',
                size_in: 9,
                price_each: 6,
                active: 'Y',
              },
            ],
          },
        ],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('loaded')
    })

    expect(result.current.vm.wallRows).toHaveLength(1)
    expect(result.current.vm.wallRows[0]).toMatchObject({
      overrideGallons: '4',
      finalGallons: 4,
      overrideOwnerScopeId: 'wall-conflict-a',
    })
    expect(validationMessages(result.current.vm)).toContain(
      'Warm White has conflicting saved gallon overrides across grouped scopes; apply or clear the grouped override to normalize it to the first active scope.'
    )

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(false)
    })

    expect(mocks.push).not.toHaveBeenCalled()
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('marks roller options unavailable on HTTP failure without required-select validation', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createErrorResponse('Rates unavailable', 503))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('unavailable')
    })

    expect(result.current.vm.rollerOptionsState.message).toBe('Rates unavailable')
    expect(validationMessages(result.current.vm)).toContain('Rates unavailable')
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })

  it('marks roller options unavailable when the fetch throws', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockRejectedValue(new Error('network down'))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('unavailable')
    })

    expect(result.current.vm.rollerOptionsState.message).toBe(
      'Roller and applicator options failed to load.'
    )
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })

  it('marks malformed rates payloads unavailable', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createResponse({ categories: null }))
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('unavailable')
    })

    expect(result.current.vm.rollerOptionsState.message).toBe(
      'Roller and applicator options could not be read from rates and flags.'
    )
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })

  it('marks an empty configured roller category explicitly', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(
      createResponse({
        categories: [{ key: 'supply_rates_roller_covers', rows: [] }],
      })
    )
    mockLoadedEstimate(fixture)

    const { result } = renderHook(() =>
      useEstimateV2DetailsPage({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
      })
    )

    await waitFor(() => {
      expect(result.current.vm.rollerOptionsState.status).toBe('empty')
    })

    expect(result.current.vm.rollerOptionsState.message).toBe(
      'No roller or applicator options are configured in rates and flags.'
    )
    expect(validationMessages(result.current.vm)).toContain(
      'Wall roller cover options are not configured'
    )
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })
})
