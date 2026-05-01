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

describe('useEstimateV2DetailsPage loading', () => {
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

  it('reduces roller option loading outcomes into stable page states', () => {
    const validPayload = createRollerRatesPayload()

    expect(
      reduceRollerOptionsLoadState(
        {
          status: 'unavailable',
          options: [],
          message: 'Prior failure',
        },
        { type: 'loading' }
      )
    ).toEqual(initialRollerOptionsState)

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'loaded',
        result: { ok: true, payload: validPayload },
      })
    ).toMatchObject({
      status: 'loaded',
      options: expect.arrayContaining([
        expect.objectContaining({ id: 'WALL_9' }),
        expect.objectContaining({ id: 'CEIL_14' }),
        expect.objectContaining({ id: 'TRIM_4' }),
      ]),
    })

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'loaded',
        result: { ok: false, message: 'Rates unavailable' },
      })
    ).toEqual({
      status: 'unavailable',
      options: [],
      message: 'Rates unavailable',
    })

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'failed',
      })
    ).toEqual({
      status: 'unavailable',
      options: [],
      message: 'Roller and applicator options failed to load.',
    })

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'loaded',
        result: { ok: true, payload: { categories: null } },
      })
    ).toMatchObject({
      status: 'unavailable',
      options: [],
    })

    expect(
      reduceRollerOptionsLoadState(initialRollerOptionsState, {
        type: 'loaded',
        result: {
          ok: true,
          payload: { categories: [{ key: 'supply_rates_roller_covers', rows: [] }] },
        },
      })
    ).toEqual({
      status: 'empty',
      options: [],
      message: 'No roller or applicator options are configured in rates and flags.',
    })
  })

  it('marks roller options unavailable on HTTP failure without required-select validation', async () => {
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

    expect(result.current.vm.rollerOptionsState.message).toBe('Rates unavailable')
    expect(validationMessages(result.current.vm)).toContain('Rates unavailable')
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })

  it('marks roller options unavailable when the fetch throws', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockRejectedValue(new Error('network down'))
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

    expect(result.current.vm.rollerOptionsState.message).toBe(
      'Roller and applicator options failed to load.'
    )
    expect(validationMessages(result.current.vm)).not.toContain('Warm White roller cover is required')
  })

  it('marks malformed rates payloads unavailable', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockResolvedValue(createResponse({ categories: null }))
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
    mockLoadedEstimate(fixture, mocks.useEstimateV2EditorLoader, mocks.initializedStores)

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
