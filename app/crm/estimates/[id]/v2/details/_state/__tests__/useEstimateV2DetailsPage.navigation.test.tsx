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

describe('useEstimateV2DetailsPage navigation', () => {
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

  it('guards browser unload while details edits are dirty', async () => {
    const fixture = createMixedEstimateV2Fixture()
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
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Dirty roller edit',
      })
    })

    expect(result.current.dirty).toBe(true)
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
  })

  it('guards internal return-to-editor navigation while details edits are dirty', async () => {
    const fixture = createMixedEstimateV2Fixture()
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

    act(() => {
      result.current.actions.setRollerRow('wall:COLOR1', {
        coverId: 'WALL_12',
        quantity: '3',
        notes: 'Dirty roller edit',
      })
    })

    act(() => {
      expect(result.current.actions.returnToEditor()).toBe(false)
    })

    expect(result.current.discardVm).toMatchObject({
      isOpen: true,
      intent: 'returnToEditor',
      intentType: 'returnToEditor',
    })
    expect(mocks.push).not.toHaveBeenCalled()
    expect(result.current.dirty).toBe(true)

    act(() => {
      result.current.actions.cancelDiscard()
    })

    expect(result.current.discardVm.isOpen).toBe(false)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(result.current.dirty).toBe(true)

    act(() => {
      expect(result.current.actions.returnToEditor()).toBe(false)
    })

    act(() => {
      expect(result.current.actions.confirmReturnToEditor()).toBe(true)
    })

    expect(mocks.push).toHaveBeenCalledWith(estimateRouteFamily.editorHref(fixture.estimate.id))
  })

  it('allows internal return-to-editor navigation without confirmation when details are clean', async () => {
    const fixture = createMixedEstimateV2Fixture()
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

    act(() => {
      expect(result.current.actions.returnToEditor()).toBe(true)
    })

    expect(result.current.discardVm.isOpen).toBe(false)
    expect(mocks.push).toHaveBeenCalledWith(estimateRouteFamily.editorHref(fixture.estimate.id))
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
    })

    expect(result.current.vm.canContinueToSummary).toBe(true)

    await act(async () => {
      await expect(result.current.actions.continueToSummary()).resolves.toBe(true)
    })

    expect(hasSaveRequest(fixture.estimate.id)).toBe(true)
    expect(result.current.discardVm.isOpen).toBe(false)
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

})
