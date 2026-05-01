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

describe('useEstimateV2DetailsPage save', () => {
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

  it('writes roller changes into the canonical persisted editor collection', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.rollers = [
      ...fixture.rollers,
      {
        id: 'applicator-trim',
        scope: 'Trim',
        wallColorId: '',
        selectedOptionId: 'TRIM_4',
        rollerSizeIn: '4',
        coversQty: '1',
        notes: 'Trim applicator',
        position: fixture.rollers.length,
      },
    ]
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
      ])
    )
    expect(body.rollers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'Trim',
          wall_color_id: null,
          selected_option_id: 'TRIM_4',
          roller_size_in: 4,
          covers_qty: 1,
        }),
      ])
    )
  })

  it('saves a trim-only draft without active wall or ceiling scopes', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes = fixture.scopes.map((scope) => ({ ...scope, include: 'N' as const }))
    fixture.ceilingScopes = fixture.ceilingScopes.map((scope) => ({
      ...scope,
      include: 'N' as const,
    }))
    fixture.trimScopes = fixture.trimScopes.map((scope, index) => ({
      ...scope,
      include: index === 0 ? ('Y' as const) : ('N' as const),
    }))
    fixture.rollers = [
      {
        id: 'applicator-trim',
        scope: 'Trim',
        wallColorId: '',
        selectedOptionId: 'TRIM_4',
        rollerSizeIn: '4',
        coversQty: '1',
        notes: 'Trim applicator',
        position: 0,
      },
    ]
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse(createRollerRatesPayload())
    })
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

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    const saveRequest = findSaveRequest(fixture.estimate.id)
    expect(saveRequest).toBeTruthy()
    const body = JSON.parse((saveRequest?.[1] as { body: string }).body) as SavedDetailsContractPayload

    expect(body.room_wall_scopes.some((scope) => scope.include === 'Y')).toBe(false)
    expect(body.room_ceiling_scopes.some((scope) => scope.include === 'Y')).toBe(false)
    expect(body.room_trim_scopes.some((scope) => scope.include === 'Y')).toBe(true)
    expect(body.rollers.some((roller) => roller.scope === 'Wall' || roller.scope === 'Ceiling')).toBe(
      false
    )
  })

  it('exposes failed manual save status without navigating', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createErrorResponse('Manual save failed', 500)
      }
      return createResponse(createRollerRatesPayload())
    })
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

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Dirty roller edit',
      })
    })

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(false)
    })

    expect(hasSaveRequest(fixture.estimate.id)).toBe(true)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(result.current.error?.message).toBe('Manual save failed')
    expect(result.current.saveStatus).toBe('error')
  })

  it('disables the browser unload guard after a dirty details edit saves successfully', async () => {
    const fixture = createMixedEstimateV2Fixture()
    mocks.authedFetch.mockImplementation(async (url, init) => {
      const method =
        typeof init === 'object' && init != null ? (init as { method?: string }).method : undefined
      if (url === estimateRouteFamily.estimateApiHref(fixture.estimate.id) && method === 'PUT') {
        return createResponse({})
      }
      return createResponse(createRollerRatesPayload())
    })
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

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Saved roller edit',
      })
    })

    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)

    await act(async () => {
      await expect(result.current.actions.saveDraft()).resolves.toBe(true)
    })

    expect(result.current.dirty).toBe(false)
    await waitFor(() => {
      expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    })
  })

  it('keeps grouped material override no-ops clean without queuing an autosave', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.scopes = fixture.scopes.map((scope) => {
      if (scope.id === 'wall-r001-main') return { ...scope, overridePaintGallons: '6' }
      if (scope.colorId === 'COLOR1') return { ...scope, overridePaintGallons: '' }
      return scope
    })
    fixture.ceilingScopes = fixture.ceilingScopes.map((scope) =>
      scope.id === 'ceiling-r001-main'
        ? { ...scope, overridePaintGallons: '3' }
        : { ...scope, overridePaintGallons: '' }
    )
    fixture.trimScopes = fixture.trimScopes.map((scope) =>
      scope.id === 'trim-r001-main'
        ? { ...scope, overrideGallons: '2' }
        : { ...scope, overrideGallons: '' }
    )
    resetFixtureSavedSnapshot(fixture)
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
    expect(result.current.dirty).toBe(false)
    mocks.authedFetch.mockClear()
    vi.useFakeTimers()

    act(() => {
      result.current.actions.setWallOverride('COLOR1', '6')
      result.current.actions.setCeilingOverride('3')
      result.current.actions.setTrimOverride('2')
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(result.current.dirty).toBe(false)
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

  it('keeps roller row no-ops clean without queuing an autosave', async () => {
    const fixture = createMixedEstimateV2Fixture()
    fixture.rollers[0] = {
      ...fixture.rollers[0],
      selectedOptionId: 'WALL_9',
      rollerSizeIn: '9',
      coversQty: '2',
      notes: 'Main wall roller',
    }
    resetFixtureSavedSnapshot(fixture)
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
    expect(result.current.vm.wallRollerRows[0]).toMatchObject({
      coverId: 'WALL_9',
      quantity: '2',
      notes: 'Main wall roller',
    })
    expect(result.current.dirty).toBe(false)
    mocks.authedFetch.mockClear()
    vi.useFakeTimers()

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_9',
        quantity: ' 2 ',
        notes: 'Main wall roller',
      })
    })
    await act(async () => {
      vi.advanceTimersByTime(1000)
      await Promise.resolve()
    })

    expect(result.current.dirty).toBe(false)
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
    expect(hasSaveRequest(fixture.estimate.id)).toBe(false)
  })

})
