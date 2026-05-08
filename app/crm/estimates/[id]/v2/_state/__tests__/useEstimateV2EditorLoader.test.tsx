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

  it('hydrates saved job-level condition selections into job settings draft', async () => {
    const fixture = createMixedEstimateV2Fixture()
    const store = createEstimateV2Store()
    const estimatePayload = {
      ...fixture.summaryData,
      inputs: {
        ...fixture.summaryData.inputs,
        jobsettings: {
          ...fixture.summaryData.inputs.jobsettings,
          condition_selections: {
            room: { ROOM_FURNISHED: 'active' },
            wall: { WALL_TEXTURE: 'moderate' },
            ceiling: {},
            trim: { TRIM_OIL_BASED: 'active' },
          },
        },
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
      expect(store.getState().meta.loading).toBe(false)
    })

    expect(store.getState().meta.jobSettingsDraft.conditionSelections).toEqual({
      room: { ROOM_FURNISHED: 'active' },
      wall: { WALL_TEXTURE: 'moderate' },
      ceiling: {},
      trim: { TRIM_OIL_BASED: 'active' },
    })
    expect(store.getState().collections.rooms[0].conditionSelections).toMatchObject({
      ROOM_FURNISHED: 'active',
    })
    expect(store.getState().collections.scopes[0].conditionSelections).toMatchObject({
      WALL_TEXTURE: 'moderate',
    })
    expect(store.getState().collections.trimScopes[0].conditionSelections).toMatchObject({
      TRIM_OIL_BASED: 'active',
    })
  })

  it('logs sanitized diagnostics and surfaces a retryable error when estimate load fails', async () => {
    const fixture = createMixedEstimateV2Fixture()
    const store = createEstimateV2Store()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    authedFetch
      .mockResolvedValueOnce(createResponse(false, { error: 'Quote not found' }, 404))
      .mockResolvedValueOnce(createResponse(true, { data: { catalogs: fixture.catalogs } }))

    try {
      renderHook(() =>
        useEstimateV2EditorLoader({
          estimateId: fixture.estimate.id,
          routeFamily: estimateRouteFamily,
          store,
        })
      )

      await waitFor(() => {
        expect(store.getState().meta.loading).toBe(false)
      })

      expect(store.getState().meta.error?.message).toBe('Quote not found')
      expect(consoleError).toHaveBeenCalledWith(
        'Estimate V2 editor load failed',
        expect.stringContaining('loadEstimate GET /api/estimates/'),
        expect.objectContaining({
          operation: 'loadEstimate',
          method: 'GET',
          status: 404,
          message: 'Quote not found',
          responseEnvelope: 'error',
          errorShape: 'string',
        })
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('retries the editor load flow and recovers after an initial fatal load failure', async () => {
    const fixture = createMixedEstimateV2Fixture()
    const store = createEstimateV2Store()
    const estimatePayload = {
      ...fixture.summaryData,
      inputs: {
        ...fixture.summaryData.inputs,
        wall_segments: fixture.segments,
        ceiling_scope_segments: fixture.ceilingSegments,
      },
    }

    authedFetch
      .mockResolvedValueOnce(createResponse(false, { error: 'Quote not found' }, 404))
      .mockResolvedValueOnce(createResponse(true, { data: { catalogs: fixture.catalogs } }))
      .mockResolvedValueOnce(createResponse(true, { data: estimatePayload }))
      .mockResolvedValueOnce(createResponse(true, { data: { catalogs: fixture.catalogs } }))
      .mockResolvedValueOnce(createResponse(true, { data: fixture.job }))

    const { result } = renderHook(() =>
      useEstimateV2EditorLoader({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store,
      })
    )

    await waitFor(() => {
      expect(store.getState().meta.loading).toBe(false)
    })

    expect(store.getState().meta.error?.message).toBe('Quote not found')

    result.current.reloadWorkspace()

    await waitFor(() => {
      expect(store.getState().meta.loading).toBe(false)
      expect(store.getState().meta.error).toBeNull()
      expect(store.getState().meta.estimate?.id).toBe(fixture.estimate.id)
    })
  })

  it('retries catalog loading without discarding already-loaded editor state', async () => {
    const fixture = createMixedEstimateV2Fixture()
    const store = createEstimateV2Store()
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
      .mockResolvedValueOnce(createResponse(false, { error: 'Failed to load catalogs' }, 500))
      .mockResolvedValueOnce(createResponse(true, { data: fixture.job }))
      .mockResolvedValueOnce(createResponse(true, { data: { catalogs: fixture.catalogs } }))

    const { result } = renderHook(() =>
      useEstimateV2EditorLoader({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store,
      })
    )

    await waitFor(() => {
      expect(store.getState().meta.loading).toBe(false)
    })

    expect(store.getState().meta.estimate?.id).toBe(fixture.estimate.id)
    expect(store.getState().meta.error).toBeNull()
    expect(store.getState().meta.catalogsError?.message).toBe('Failed to load catalogs')

    store.getState().setRooms((rooms) =>
      rooms.map((room, index) =>
        index === 0 ? { ...room, roomName: 'Edited after partial load' } : room
      )
    )

    await result.current.reloadCatalogs()

    await waitFor(() => {
      expect(store.getState().meta.catalogsError).toBeNull()
      expect(store.getState().meta.catalogs.paint_products).toHaveLength(
        fixture.catalogs.paint_products.length
      )
    })

    expect(store.getState().meta.loading).toBe(false)
    expect(store.getState().collections.rooms[0]?.roomName).toBe('Edited after partial load')
  })

  it('keeps raw catalog failure details in state for retry and diagnostics', async () => {
    const fixture = createMixedEstimateV2Fixture()
    const store = createEstimateV2Store()
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
      .mockResolvedValueOnce(
        createResponse(false, { error: 'Rates service unavailable for org defaults' }, 503)
      )
      .mockResolvedValueOnce(createResponse(true, { data: fixture.job }))

    renderHook(() =>
      useEstimateV2EditorLoader({
        estimateId: fixture.estimate.id,
        routeFamily: estimateRouteFamily,
        store,
      })
    )

    await waitFor(() => {
      expect(store.getState().meta.loading).toBe(false)
    })

    expect(store.getState().meta.catalogsError?.message).toBe(
      'Rates service unavailable for org defaults'
    )
    expect(store.getState().meta.estimate?.id).toBe(fixture.estimate.id)
  })
})
