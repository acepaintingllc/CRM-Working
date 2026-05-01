import { act, renderHook, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  estimateRouteFamily,
  quoteRouteFamily,
  type EstimateRouteFamily,
} from '../../../estimateRouteFamily'
import { createMixedEstimateV2Fixture } from '../../../../../../../lib/estimator/__tests__/estimateV2Fixtures.ts'
import type { EstimateV2Error } from '@/lib/estimator/errors'
import type {
  EstimateV2JobMeta,
  EstimateV2SummaryPageData,
} from '../../../../../../../types/estimator/v2'
import { useEstimateV2SummaryLoader } from '../useEstimateV2SummaryLoader'

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

function countEstimateLoads() {
  return authedFetch.mock.calls.filter(([input]) => String(input).includes('/api/estimates/'))
    .length
}

function countQuoteLoads() {
  return authedFetch.mock.calls.filter(([input]) => String(input).includes('/api/quotes/')).length
}

function countJobLoads() {
  return authedFetch.mock.calls.filter(([input]) => String(input).startsWith('/api/jobs/')).length
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useEstimateV2SummaryLoader', () => {
  beforeEach(() => {
    authedFetch.mockReset()
  })

  it('loads once for the current estimate and does not reload on state-driven rerenders', async () => {
    const fixture = createMixedEstimateV2Fixture()

    authedFetch.mockImplementation(async (input: string) => {
      if (input.startsWith('/api/jobs/')) {
        return createResponse(true, { data: fixture.job })
      }
      return createResponse(true, { data: fixture.summaryData })
    })

    const { result, rerender } = renderHook(
      ({ estimateId, routeFamily }: { estimateId: string; routeFamily: EstimateRouteFamily }) => {
        const [loading, setLoading] = useState(true)
        const [error, setError] = useState<EstimateV2Error | null>(null)
        const [data, setData] = useState<EstimateV2SummaryPageData | null>(null)
        const [job, setJob] = useState<Partial<EstimateV2JobMeta> | null>(null)
        const [laborDayEnabled, setLaborDayEnabled] = useState(false)
        const [dayhours, setDayhours] = useState(8)
        const [roundIncrement, setRoundIncrement] = useState(4)
        const [laborRate, setLaborRate] = useState(50)
        const [jobMinEnabled, setJobMinEnabled] = useState(false)
        const [jobMinAmount, setJobMinAmount] = useState(0)
        const [trimPaintProductId, setTrimPaintProductId] = useState('')
        const [trimPaintGallons, setTrimPaintGallons] = useState(0)
        const [trimPaintQuarts, setTrimPaintQuarts] = useState(0)

        useEstimateV2SummaryLoader(estimateId, routeFamily, {
          setLoading,
          setError,
          setData,
          setJob,
          setLaborDayEnabled,
          setDayhours,
          setRoundIncrement,
          setLaborRate,
          setJobMinEnabled,
          setJobMinAmount,
          setTrimPaintProductId,
          setTrimPaintGallons,
          setTrimPaintQuarts,
        })

        return {
          data,
          dayhours,
          error,
          job,
          jobMinAmount,
          jobMinEnabled,
          laborDayEnabled,
          laborRate,
          loading,
          roundIncrement,
          setLaborRate,
          trimPaintGallons,
          trimPaintProductId,
          trimPaintQuarts,
        }
      },
      {
        initialProps: {
          estimateId: fixture.estimate.id,
          routeFamily: estimateRouteFamily,
        },
      }
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(countEstimateLoads()).toBe(1)
    expect(countJobLoads()).toBe(1)
    expect(authedFetch).toHaveBeenCalledTimes(2)

    rerender({ estimateId: fixture.estimate.id, routeFamily: estimateRouteFamily })
    await flushEffects()

    expect(authedFetch).toHaveBeenCalledTimes(2)

    act(() => {
      result.current.setLaborRate(75)
    })
    await flushEffects()

    expect(result.current.laborRate).toBe(75)
    expect(countEstimateLoads()).toBe(1)
    expect(countJobLoads()).toBe(1)
    expect(authedFetch).toHaveBeenCalledTimes(2)

    rerender({ estimateId: fixture.estimate.id, routeFamily: quoteRouteFamily })

    await waitFor(() => {
      expect(countQuoteLoads()).toBe(1)
    })

    expect(countJobLoads()).toBe(2)
    expect(authedFetch).toHaveBeenCalledTimes(4)

    rerender({ estimateId: 'estimate-v2-next', routeFamily: quoteRouteFamily })

    await waitFor(() => {
      expect(countQuoteLoads()).toBe(2)
    })

    expect(countJobLoads()).toBe(3)
    expect(authedFetch).toHaveBeenCalledTimes(6)
  })
})
