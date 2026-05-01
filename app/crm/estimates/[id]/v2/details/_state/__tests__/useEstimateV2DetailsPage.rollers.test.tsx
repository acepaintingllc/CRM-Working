import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMixedEstimateV2Fixture } from '../../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import { estimateRouteFamily } from '../../../../estimateRouteFamily'
import { useEstimateV2DetailsPage } from '../useEstimateV2DetailsPage'
import {
  createErrorResponse,
  createResponse,
  createRollerRatesPayload,
  dispatchBeforeUnload,
  mockLoadedEstimate,
  resetFixtureSavedSnapshot,
  validationMessages,
} from './useEstimateV2DetailsPage.testUtils'
import {
  initialRollerOptionsState,
  reduceRollerOptionsLoadState,
} from '../useEstimateV2DetailsRollerOptions'
import {
  buildRoomAlertsByRoom,
  buildRoomFlagCountMap,
  buildRoomScopeRows,
  buildSummaryAlerts,
  normalizeSummaryScopeRows,
} from '../../../summary/_lib/estimateV2SummaryDerived'

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

function hasSaveRequest(estimateId: string) {
  return mocks.authedFetch.mock.calls.some(
    ([url, init]) =>
      url === estimateRouteFamily.estimateApiHref(estimateId) &&
      typeof init === 'object' &&
      init != null &&
      (init as { method?: string }).method === 'PUT'
  )
}

function findSaveRequest(estimateId: string) {
  return mocks.authedFetch.mock.calls.find(
    ([url, init]) =>
      url === estimateRouteFamily.estimateApiHref(estimateId) &&
      typeof init === 'object' &&
      init != null &&
      (init as { method?: string }).method === 'PUT'
  )
}

type SavedDetailsContractPayload = {
  room_wall_scopes: Array<{
    id: string
    room_id: string
    include: string | null
    override_paint_gallons: number | null
  }>
  room_ceiling_scopes: Array<{
    id: string
    room_id: string
    include: string | null
    override_paint_gallons: number | null
  }>
  room_trim_scopes: Array<{
    id: string
    room_id: string
    include: string | null
    override_gallons: number | null
  }>
  rollers: Array<{
    scope: string
    wall_color_id: string | null
    selected_option_id: string | null
    roller_size_in: number | null
    covers_qty: number | null
    notes: string | null
  }>
}

describe('useEstimateV2DetailsPage rollers', () => {
  beforeEach(() => {
    mocks.push.mockReset()
    mocks.authedFetch.mockReset()
    mocks.useEstimateV2EditorLoader.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
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
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

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
    fixture.rollers[0] = {
      ...fixture.rollers[0],
      rollerSizeIn: '9',
      coversQty: '2',
      notes: 'Main wall roller',
    }
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
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

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
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

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
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

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

})
