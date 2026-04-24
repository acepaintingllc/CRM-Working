import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuotesHomeSearch } from '../useQuotesHomeSearch'

const { loadQuoteHomeSearch } = vi.hoisted(() => ({
  loadQuoteHomeSearch: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteHomeSearch,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

async function sleep(ms: number) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms))
  })
}

describe('useQuotesHomeSearch', () => {
  beforeEach(() => {
    vi.useRealTimers()
    loadQuoteHomeSearch.mockReset()
  })

  it('debounces queries and resets when the query becomes empty', async () => {
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'revision',
      items: [{ estimate_id: 'estimate-1' }],
    })

    const { result, rerender } = renderHook(({ query }) => useQuotesHomeSearch(query), {
      initialProps: { query: '' },
    })

    rerender({ query: ' revision ' })
    await sleep(170)

    await waitFor(() => {
      expect(result.current.results).toEqual([{ estimate_id: 'estimate-1' }])
    })
    expect(loadQuoteHomeSearch).toHaveBeenCalledWith('revision')

    rerender({ query: '   ' })
    await sleep(170)

    expect(result.current.query).toBe('')
    expect(result.current.results).toEqual([])
    expect(result.current.error).toBeNull()
    expect(result.current.emptyMessage).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('cleans up the pending debounce timeout on unmount', () => {
    vi.useFakeTimers()
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'revision',
      items: [{ estimate_id: 'estimate-1' }],
    })

    const { unmount } = renderHook(() => useQuotesHomeSearch('revision'))

    unmount()

    act(() => {
      vi.advanceTimersByTime(170)
    })

    expect(loadQuoteHomeSearch).not.toHaveBeenCalled()
  })

  it('keeps only the latest response when queries change quickly', async () => {
    const slow = deferred<{ query: string; items: Array<{ estimate_id: string }> }>()
    const fast = deferred<{ query: string; items: Array<{ estimate_id: string }> }>()

    loadQuoteHomeSearch
      .mockImplementationOnce(() => slow.promise)
      .mockImplementationOnce(() => fast.promise)

    const { result, rerender } = renderHook(({ query }) => useQuotesHomeSearch(query), {
      initialProps: { query: 'first' },
    })

    await sleep(170)

    rerender({ query: 'second' })
    await sleep(170)

    fast.resolve({
      query: 'second',
      items: [{ estimate_id: 'estimate-2' }],
    })

    await waitFor(() => {
      expect(result.current.results).toEqual([{ estimate_id: 'estimate-2' }])
    })

    slow.resolve({
      query: 'first',
      items: [{ estimate_id: 'estimate-1' }],
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.query).toBe('second')
    expect(result.current.results).toEqual([{ estimate_id: 'estimate-2' }])
  })

  it('surfaces load errors without leaving stale results behind', async () => {
    loadQuoteHomeSearch.mockRejectedValue(new Error('search failed'))

    const { result } = renderHook(() => useQuotesHomeSearch('broken'))

    await sleep(170)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.query).toBe('broken')
    expect(result.current.results).toEqual([])
    expect(result.current.error).toBe('search failed')
    expect(result.current.emptyMessage).toBeNull()
    expect(result.current.canRetry).toBe(true)
  })

  it('retries the current query after a search failure', async () => {
    loadQuoteHomeSearch
      .mockRejectedValueOnce(new Error('search failed'))
      .mockResolvedValueOnce({
        query: 'broken',
        items: [{ estimate_id: 'estimate-9' }],
      })

    const { result } = renderHook(() => useQuotesHomeSearch('broken'))

    await sleep(170)
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(result.current.results).toEqual([{ estimate_id: 'estimate-9' }])
    })

    expect(loadQuoteHomeSearch).toHaveBeenCalledTimes(2)
    expect(loadQuoteHomeSearch).toHaveBeenNthCalledWith(2, 'broken')
    expect(result.current.error).toBeNull()
  })

  it('distinguishes empty search results from a failed search', async () => {
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'missing',
      items: [],
    })

    const { result } = renderHook(() => useQuotesHomeSearch('missing'))

    await sleep(170)
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBeNull()
    expect(result.current.emptyMessage).toBe('No quote versions match "missing".')
  })
})
