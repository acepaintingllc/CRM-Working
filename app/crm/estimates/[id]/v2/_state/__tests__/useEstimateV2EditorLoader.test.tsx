import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEstimateV2Store } from '@/lib/estimates/v2/store/estimateV2Store'
import { estimateRouteFamily } from '../../../estimateRouteFamily'
import { useEstimateV2EditorLoader } from '../useEstimateV2EditorLoader'
import * as sanitizerModule from '../useEstimateV2Sanitizer'
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

describe('useEstimateV2EditorLoader', () => {
  beforeEach(() => {
    authedFetch.mockReset()
  })

  it('sanitizes estimate data before writing collections into the store', async () => {
    const fixture = createMixedEstimateV2Fixture()
    const store = createEstimateV2Store()
    const sanitizeSpy = vi.spyOn(sanitizerModule, 'sanitizeEstimateV2EditorLoad')
    const setCollectionsSpy = vi.spyOn(store.getState(), 'setCollections')
    const estimatePayload = {
      ...fixture.summaryData,
      inputs: {
        ...fixture.summaryData.inputs,
        wall_segments: fixture.segments,
        ceiling_scope_segments: fixture.ceilingSegments,
      },
    }

    authedFetch
      .mockResolvedValueOnce(createResponse(true, { data: estimatePayload }))
      .mockResolvedValueOnce(createResponse(true, { data: { catalogs: fixture.catalogs } }))
      .mockResolvedValueOnce(createResponse(true, { data: fixture.job }))

    renderHook(() =>
      useEstimateV2EditorLoader({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store,
      })
    )

    await waitFor(() => {
      expect(setCollectionsSpy).toHaveBeenCalled()
    })

    expect(sanitizeSpy).toHaveBeenCalled()
    expect(sanitizeSpy.mock.invocationCallOrder[0]).toBeLessThan(
      setCollectionsSpy.mock.invocationCallOrder[0]
    )
  })
})
