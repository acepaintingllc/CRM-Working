import { describe, expect, it, vi } from 'vitest'
import {
  cancelQuoteHomeAsyncRequests,
  runQuoteHomeAsyncRequest,
  startQuoteHomeAsyncRequest,
  type QuoteHomeAsyncLifecycle,
  type QuoteHomeAsyncRequest,
} from '../quoteHomeAsyncLifecycle'
import {
  beginQuotePagedAsyncLoadMoreKey,
  beginQuotePagedAsyncLoadMoreRequest,
  cancelQuotePagedAsyncRequests,
  canStartQuotePagedAsyncLoadMoreRequest,
  finishQuotePagedAsyncLoadMoreKey,
  finishQuotePagedAsyncLoadMoreRequest,
  runQuotePagedAsyncLoadMoreKey,
  runQuotePagedAsyncLoadMoreRequest,
  type QuotePagedAsyncLifecycle,
} from '../quotePagedAsyncLifecycle'

type TestRequest = QuoteHomeAsyncRequest<{
  scope: 'jobs' | 'versions'
}>

function createLifecycle(): QuoteHomeAsyncLifecycle<TestRequest> {
  return {
    currentRequestRef: { current: 0 },
    activeRequestRef: { current: null },
  }
}

function createPagedLifecycle(): QuotePagedAsyncLifecycle<TestRequest> {
  return {
    currentRequestRef: { current: 0 },
    activeRequestRef: { current: null },
    activeLoadMoreRequestRef: { current: null },
  }
}

describe('quoteHomeAsyncLifecycle', () => {
  it('runs start, success, and finish for the active request', async () => {
    const lifecycle = createLifecycle()
    const onStart = vi.fn()
    const onSuccess = vi.fn()
    const onFinish = vi.fn()

    const request = startQuoteHomeAsyncRequest(
      lifecycle,
      { scope: 'jobs' },
      onStart,
    )
    const result = await runQuoteHomeAsyncRequest(lifecycle, request, {
      load: async () => 'loaded',
      getErrorMessage: () => 'failed',
      onSuccess,
      onFinish,
    })

    expect(result).toEqual({
      ok: true,
      data: 'loaded',
      error: null,
      stale: false,
    })
    expect(onStart).toHaveBeenCalledWith(request)
    expect(onSuccess).toHaveBeenCalledWith(request, 'loaded')
    expect(onFinish).toHaveBeenCalledWith(request)
    expect(lifecycle.activeRequestRef?.current).toBeNull()
  })

  it('reports failures through the shared failure path and then finishes', async () => {
    const lifecycle = createLifecycle()
    const onFailure = vi.fn()
    const onFinish = vi.fn()
    const loadError = new Error('network down')
    const request = startQuoteHomeAsyncRequest(lifecycle, {
      scope: 'versions',
    })

    const result = await runQuoteHomeAsyncRequest(lifecycle, request, {
      load: async () => {
        throw loadError
      },
      getErrorMessage: (error) =>
        error instanceof Error ? error.message : 'failed',
      onFailure,
      onFinish,
    })

    expect(result).toEqual({
      ok: false,
      data: null,
      error: 'network down',
      stale: false,
    })
    expect(onFailure).toHaveBeenCalledWith(request, 'network down', loadError)
    expect(onFinish).toHaveBeenCalledWith(request)
    expect(lifecycle.activeRequestRef?.current).toBeNull()
  })

  it('ignores stale results after cancellation without firing success or finish', async () => {
    const lifecycle = createLifecycle()
    const onSuccess = vi.fn()
    const onFinish = vi.fn()
    const request = startQuoteHomeAsyncRequest(lifecycle, { scope: 'jobs' })

    cancelQuoteHomeAsyncRequests(lifecycle)

    const result = await runQuoteHomeAsyncRequest(lifecycle, request, {
      load: async () => 'stale data',
      getErrorMessage: () => 'failed',
      onSuccess,
      onFinish,
    })

    expect(result).toEqual({
      ok: false,
      data: null,
      error: null,
      stale: true,
    })
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFinish).not.toHaveBeenCalled()
    expect(lifecycle.activeRequestRef?.current).toBeNull()
  })

  it('tracks and releases a load-more request separately from the active request', () => {
    const lifecycle = createPagedLifecycle()

    expect(canStartQuotePagedAsyncLoadMoreRequest(lifecycle, 'cursor-2')).toBe(
      true,
    )

    const request = beginQuotePagedAsyncLoadMoreRequest(
      lifecycle,
      { scope: 'versions' },
      'cursor-2',
    )

    if (request === null) {
      throw new Error('Expected load-more request to start')
    }

    expect(lifecycle.activeRequestRef?.current).toBe(request)
    expect(lifecycle.activeLoadMoreRequestRef?.current).toBe(request)
    expect(canStartQuotePagedAsyncLoadMoreRequest(lifecycle, 'cursor-2')).toBe(
      false,
    )

    finishQuotePagedAsyncLoadMoreRequest(lifecycle, request)

    expect(lifecycle.activeLoadMoreRequestRef?.current).toBeNull()
  })

  it('cancels active load-more tracking with the rest of the lifecycle', () => {
    const lifecycle = createPagedLifecycle()

    beginQuotePagedAsyncLoadMoreRequest(
      lifecycle,
      { scope: 'jobs' },
      'cursor-2',
    )

    cancelQuotePagedAsyncRequests(lifecycle)

    expect(lifecycle.activeRequestRef?.current).toBeNull()
    expect(lifecycle.activeLoadMoreRequestRef?.current).toBeNull()
    expect(lifecycle.currentRequestRef.current).toBe(2)
  })

  it('coalesces duplicate load-more keys until the key is finished', () => {
    const activeKeysRef = { current: new Set<string>() }

    expect(
      beginQuotePagedAsyncLoadMoreKey(activeKeysRef, '["", "cursor-2"]'),
    ).toBe(true)
    expect(
      beginQuotePagedAsyncLoadMoreKey(activeKeysRef, '["", "cursor-2"]'),
    ).toBe(false)

    finishQuotePagedAsyncLoadMoreKey(activeKeysRef, '["", "cursor-2"]')

    expect(
      beginQuotePagedAsyncLoadMoreKey(activeKeysRef, '["", "cursor-2"]'),
    ).toBe(true)
  })

  it('gates and runs a load-more request through the shared runner', async () => {
    const lifecycle = createPagedLifecycle()
    const onStart = vi.fn()
    const onSuccess = vi.fn()

    const result = await runQuotePagedAsyncLoadMoreRequest(
      lifecycle,
      { scope: 'versions' },
      'cursor-2',
      {
        onStart,
        load: async () => 'next page',
        getErrorMessage: () => 'failed',
        onSuccess,
      },
    )

    expect(result).toEqual({
      ok: true,
      data: 'next page',
      error: null,
      stale: false,
    })
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(lifecycle.activeRequestRef?.current).toBeNull()
    expect(lifecycle.activeLoadMoreRequestRef?.current).toBeNull()
  })

  it('wraps keyed load-more work and releases the key after settle', async () => {
    const activeKeysRef = { current: new Set<string>() }
    const deferredWork = new Promise<string>((resolve) => {
      setTimeout(() => resolve('loaded'), 0)
    })

    const firstRun = runQuotePagedAsyncLoadMoreKey(
      activeKeysRef,
      '["", "cursor-2"]',
      () => deferredWork,
    )
    const duplicateRun = runQuotePagedAsyncLoadMoreKey(
      activeKeysRef,
      '["", "cursor-2"]',
      async () => 'duplicate',
    )

    await expect(duplicateRun).resolves.toBeNull()
    await expect(firstRun).resolves.toBe('loaded')

    await expect(
      runQuotePagedAsyncLoadMoreKey(
        activeKeysRef,
        '["", "cursor-2"]',
        async () => 'loaded again',
      ),
    ).resolves.toBe('loaded again')
  })
})
