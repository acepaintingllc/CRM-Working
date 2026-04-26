import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { estimateRouteFamily } from '../../../estimateRouteFamily'
import {
  type SummaryPolicyDraft,
  useEstimateV2SummaryPolicyController,
} from '../useEstimateV2SummaryPolicyController'
import {
  type SummaryTrimPaintDraft,
  useEstimateV2TrimPaintController,
} from '../useEstimateV2TrimPaintController'

const authedFetch = vi.fn()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
}))

function createResponse(ok: boolean, payload: unknown, status = ok ? 200 : 500) {
  return new Response(JSON.stringify(payload), {
    status,
    statusText: ok ? 'OK' : 'Server Error',
  })
}

const policyDraft: SummaryPolicyDraft = {
  laborDayEnabled: true,
  dayhours: 8,
  roundIncrement: 4,
  laborRate: 65,
  jobMinEnabled: true,
  jobMinAmount: 1200,
}

const trimPaintDraft: SummaryTrimPaintDraft = {
  trimPaintProductId: 'paint-1',
  trimPaintGallons: 2,
  trimPaintQuarts: 1,
}

describe('summary save controllers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    authedFetch.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes pricing after a successful policy save and clears saving state', async () => {
    const refreshPricing = vi.fn(async () => undefined)
    const setError = vi.fn()
    const setPolicySaving = vi.fn()
    authedFetch.mockResolvedValue(createResponse(true, { data: {} }))

    const { result } = renderHook(() =>
      useEstimateV2SummaryPolicyController({
        estimateId: 'estimate-1',
        routeFamily: estimateRouteFamily,
        refreshPricing,
        setError,
        setPolicySaving,
      })
    )

    act(() => result.current.savePolicyDebounced(policyDraft))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(authedFetch).toHaveBeenCalledWith('/api/estimates/estimate-1', expect.any(Object))
    expect(setError).toHaveBeenCalledWith(null)
    expect(refreshPricing).toHaveBeenCalledTimes(1)
    expect(setPolicySaving).toHaveBeenNthCalledWith(1, true)
    expect(setPolicySaving).toHaveBeenLastCalledWith(false)
  })

  it('surfaces failed policy saves and skips pricing refresh', async () => {
    const refreshPricing = vi.fn(async () => undefined)
    const setError = vi.fn()
    const setPolicySaving = vi.fn()
    authedFetch.mockResolvedValue(createResponse(false, { error: 'Policy write failed' }))

    const { result } = renderHook(() =>
      useEstimateV2SummaryPolicyController({
        estimateId: 'estimate-1',
        routeFamily: estimateRouteFamily,
        refreshPricing,
        setError,
        setPolicySaving,
      })
    )

    act(() => result.current.savePolicyDebounced(policyDraft))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(setError).toHaveBeenCalledWith({
      message: 'Policy write failed',
      retryable: true,
    })
    expect(refreshPricing).not.toHaveBeenCalled()
    expect(setPolicySaving).toHaveBeenNthCalledWith(1, true)
    expect(setPolicySaving).toHaveBeenLastCalledWith(false)
  })

  it('refreshes pricing after a successful trim paint save and clears saving state', async () => {
    const refreshPricing = vi.fn(async () => undefined)
    const setError = vi.fn()
    const setPolicySaving = vi.fn()
    authedFetch.mockResolvedValue(createResponse(true, { data: {} }))

    const { result } = renderHook(() =>
      useEstimateV2TrimPaintController({
        estimateId: 'estimate-1',
        routeFamily: estimateRouteFamily,
        refreshPricing,
        setError,
        setPolicySaving,
      })
    )

    act(() => result.current.saveTrimPaintDebounced(trimPaintDraft))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(authedFetch).toHaveBeenCalledWith('/api/estimates/estimate-1', expect.any(Object))
    expect(setError).toHaveBeenCalledWith(null)
    expect(refreshPricing).toHaveBeenCalledTimes(1)
    expect(setPolicySaving).toHaveBeenNthCalledWith(1, true)
    expect(setPolicySaving).toHaveBeenLastCalledWith(false)
  })

  it('surfaces failed trim paint saves and skips pricing refresh', async () => {
    const refreshPricing = vi.fn(async () => undefined)
    const setError = vi.fn()
    const setPolicySaving = vi.fn()
    authedFetch.mockResolvedValue(createResponse(false, { error: 'Trim paint write failed' }))

    const { result } = renderHook(() =>
      useEstimateV2TrimPaintController({
        estimateId: 'estimate-1',
        routeFamily: estimateRouteFamily,
        refreshPricing,
        setError,
        setPolicySaving,
      })
    )

    act(() => result.current.saveTrimPaintDebounced(trimPaintDraft))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(setError).toHaveBeenCalledWith({
      message: 'Trim paint write failed',
      retryable: true,
    })
    expect(refreshPricing).not.toHaveBeenCalled()
    expect(setPolicySaving).toHaveBeenNthCalledWith(1, true)
    expect(setPolicySaving).toHaveBeenLastCalledWith(false)
  })
})
