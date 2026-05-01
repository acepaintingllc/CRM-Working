import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { estimateRouteFamily } from '../../../estimateRouteFamily'
import { useEstimateV2SummaryData } from '../useEstimateV2SummaryData'

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

const estimatePayload = {
  estimate: {
    id: 'estimate-1',
    job_id: 'job-1',
    version_name: 'Version 1',
    version_state: 'draft',
  },
  inputs: {
    jobsettings: null,
    org_defaults: null,
  },
  trim_paint: null,
  pricing_summary: {
    final_total: 100,
  },
}

describe('useEstimateV2SummaryData', () => {
  beforeEach(() => {
    authedFetch.mockReset()
  })

  it('loads the summary once and does not refetch from its own state updates', async () => {
    authedFetch
      .mockResolvedValueOnce(createResponse(true, { data: estimatePayload }))
      .mockResolvedValueOnce(createResponse(true, { data: { id: 'job-1', customer_name: 'Ada' } }))

    const { result, rerender } = renderHook(() =>
      useEstimateV2SummaryData('estimate-1', estimateRouteFamily)
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(authedFetch).toHaveBeenCalledTimes(2)

    rerender()

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(authedFetch).toHaveBeenCalledTimes(2)
  })

  it('does not refetch when a wrapper recreates an equivalent route family object', async () => {
    authedFetch
      .mockResolvedValueOnce(createResponse(true, { data: estimatePayload }))
      .mockResolvedValueOnce(createResponse(true, { data: { id: 'job-1', customer_name: 'Ada' } }))

    const { result, rerender } = renderHook(
      ({ routeFamily }) => useEstimateV2SummaryData('estimate-1', routeFamily),
      {
        initialProps: {
          routeFamily: { ...estimateRouteFamily },
        },
      }
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(authedFetch).toHaveBeenCalledTimes(2)

    rerender({ routeFamily: { ...estimateRouteFamily } })

    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(authedFetch).toHaveBeenCalledTimes(2)
  })
})
