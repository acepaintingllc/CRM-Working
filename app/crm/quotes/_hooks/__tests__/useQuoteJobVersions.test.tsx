import { renderHook, waitFor } from '@testing-library/react'
import { act, StrictMode, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createJobVersionsCache,
  getCachedJobVersionsPage,
  hydrateJobVersionsCache,
  mergeJobVersionsPages,
  resolveInitialJobVersionsPage,
} from '../jobVersionsCache'
import { useQuoteJobVersions } from '../useQuoteJobVersions'
import type { QuoteJobVersionsPageReadModel } from '@/lib/quotes/collectionData'

const { loadQuoteJobVersions } = vi.hoisted(() => ({
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteJobVersions,
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

const versionPayload: QuoteJobVersionsPageReadModel = {
  job_id: 'job-1',
  total_versions: 2,
  limit: 25,
  next_cursor: null,
  items: [
    {
      estimate_id: 'estimate-1',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Version A',
      version_state: 'draft',
      version_kind: 'standard',
      version_sort_order: 1,
      job_title: 'Kitchen',
      customer_name: 'Alice',
      final_total: 500,
      updated_at: '2026-04-21T10:00:00.000Z',
      created_at: '2026-04-20T10:00:00.000Z',
      is_sent_estimate: false,
    },
    {
      estimate_id: 'estimate-2',
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_name: 'Version B',
      version_state: 'live',
      version_kind: 'revision',
      version_sort_order: 2,
      job_title: 'Kitchen',
      customer_name: 'Alice',
      final_total: 1300,
      updated_at: '2026-04-22T10:00:00.000Z',
      created_at: '2026-04-21T10:00:00.000Z',
      is_sent_estimate: true,
    },
  ],
}

describe('useQuoteJobVersions', () => {
  beforeEach(() => {
    loadQuoteJobVersions.mockReset()
  })

  it('loads fresh versions when no cache entry exists', async () => {
    loadQuoteJobVersions.mockResolvedValue(versionPayload)

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    expect(result.current.items).toEqual([])

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(1)
    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1')
    expect(result.current.hasResolved).toBe(true)
  })

  it('reports a failed initial fresh load and leaves an empty page', async () => {
    loadQuoteJobVersions.mockRejectedValue(new Error('versions unavailable'))

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.error).toBe('versions unavailable')
    })

    expect(result.current.data.job_id).toBe('job-1')
    expect(result.current.items).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.hasResolved).toBe(false)
  })

  it('appends the next versions page and keeps the authoritative total count', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce({
        ...versionPayload,
        total_versions: 30,
        next_cursor: 'cursor-2',
        items: Array.from({ length: 25 }, (_, index) => ({
          ...versionPayload.items[0],
          estimate_id: `estimate-${index + 1}`,
          version_name: `Version ${index + 1}`,
          version_sort_order: 30 - index,
        })),
      })
      .mockResolvedValueOnce({
        ...versionPayload,
        total_versions: 30,
        next_cursor: null,
        items: Array.from({ length: 5 }, (_, index) => ({
          ...versionPayload.items[0],
          estimate_id: `estimate-${index + 26}`,
          version_name: `Version ${index + 26}`,
          version_sort_order: 5 - index,
        })),
      })

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items).toHaveLength(25)
    })

    expect(result.current.pageData.total_versions).toBe(30)
    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(loadQuoteJobVersions).toHaveBeenNthCalledWith(1, 'job-1')
    expect(loadQuoteJobVersions).toHaveBeenNthCalledWith(2, 'job-1', {
      cursor: 'cursor-2',
    })
    expect(result.current.items).toHaveLength(30)
    expect(result.current.pageData.total_versions).toBe(30)
    expect(result.current.hasMore).toBe(false)
  })

  it('coalesces rapid duplicate loadMore calls into one cursor request', async () => {
    const nextPage = deferred<typeof versionPayload>()

    loadQuoteJobVersions
      .mockResolvedValueOnce({
        ...versionPayload,
        total_versions: 3,
        next_cursor: 'cursor-2',
        items: [versionPayload.items[0]],
      })
      .mockImplementationOnce(() => nextPage.promise)

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })

    let firstLoadMore!: Promise<boolean>
    let secondLoadMore!: Promise<boolean>

    await act(async () => {
      firstLoadMore = result.current.loadMore()
      secondLoadMore = result.current.loadMore()
      await Promise.resolve()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
    expect(loadQuoteJobVersions).toHaveBeenNthCalledWith(2, 'job-1', {
      cursor: 'cursor-2',
    })
    await expect(secondLoadMore).resolves.toBe(false)

    nextPage.resolve({
      ...versionPayload,
      total_versions: 3,
      next_cursor: null,
      items: [versionPayload.items[1]],
    })

    await act(async () => {
      await firstLoadMore
    })

    expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1', 'estimate-2'])
  })

  it('allows loadMore again after the previous cursor request settles', async () => {
    const firstNextPage = deferred<typeof versionPayload>()

    loadQuoteJobVersions
      .mockResolvedValueOnce({
        ...versionPayload,
        total_versions: 3,
        next_cursor: 'cursor-2',
        items: [versionPayload.items[0]],
      })
      .mockImplementationOnce(() => firstNextPage.promise)
      .mockResolvedValueOnce({
        ...versionPayload,
        total_versions: 3,
        next_cursor: null,
        items: [
          {
            ...versionPayload.items[0],
            estimate_id: 'estimate-3',
            version_name: 'Version C',
          },
        ],
      })

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })

    let firstLoadMore!: Promise<boolean>

    await act(async () => {
      firstLoadMore = result.current.loadMore()
      await Promise.resolve()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)

    firstNextPage.resolve({
      ...versionPayload,
      total_versions: 3,
      next_cursor: 'cursor-3',
      items: [versionPayload.items[1]],
    })

    await act(async () => {
      await firstLoadMore
    })

    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(3)
    expect(loadQuoteJobVersions).toHaveBeenNthCalledWith(3, 'job-1', {
      cursor: 'cursor-3',
    })
    expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1', 'estimate-2', 'estimate-3'])
    expect(result.current.hasMore).toBe(false)
  })

  it('keeps the current page and releases loadMore after a failed cursor request', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce({
        ...versionPayload,
        total_versions: 2,
        next_cursor: 'cursor-2',
        items: [versionPayload.items[0]],
      })
      .mockRejectedValueOnce(new Error('next page failed'))
      .mockResolvedValueOnce({
        ...versionPayload,
        total_versions: 2,
        next_cursor: null,
        items: [versionPayload.items[1]],
      })

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1'])
    })

    await act(async () => {
      await expect(result.current.loadMore()).resolves.toBe(false)
    })

    expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1'])
    expect(result.current.error).toBe('next page failed')
    expect(result.current.loadingMore).toBe(false)

    await act(async () => {
      await expect(result.current.loadMore()).resolves.toBe(true)
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(3)
    expect(loadQuoteJobVersions).toHaveBeenNthCalledWith(3, 'job-1', {
      cursor: 'cursor-2',
    })
    expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1', 'estimate-2'])
    expect(result.current.error).toBeNull()
  })

  it('uses cached data until a forced refresh is requested', async () => {
    loadQuoteJobVersions.mockResolvedValue(versionPayload)

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.refresh()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(3)
  })

  it('bypasses the cached versions page when refresh forces a reload', async () => {
    const refreshedPayload = {
      ...versionPayload,
      total_versions: 1,
      items: [
        {
          ...versionPayload.items[0],
          estimate_id: 'estimate-refreshed',
          version_name: 'Version Refreshed',
        },
      ],
    }

    loadQuoteJobVersions.mockResolvedValueOnce(versionPayload).mockResolvedValueOnce(refreshedPayload)

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1', 'estimate-2'])
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
    expect(loadQuoteJobVersions).toHaveBeenNthCalledWith(2, 'job-1')
    expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-refreshed'])
  })

  it('uses cached data when switching back to a previously loaded job', async () => {
    const jobTwoPayload = {
      ...versionPayload,
      job_id: 'job-2',
      items: [
        {
          ...versionPayload.items[0],
          estimate_id: 'estimate-job-2',
          job_id: 'job-2',
          job_title: 'Garage',
        },
      ],
    }

    loadQuoteJobVersions.mockResolvedValueOnce(versionPayload).mockResolvedValueOnce(jobTwoPayload)

    const { result, rerender } = renderHook(({ jobId }) => useQuoteJobVersions(jobId), {
      initialProps: { jobId: 'job-1' },
    })

    await waitFor(() => {
      expect(result.current.data.job_id).toBe('job-1')
    })

    rerender({ jobId: 'job-2' })

    await waitFor(() => {
      expect(result.current.data.job_id).toBe('job-2')
    })

    rerender({ jobId: 'job-1' })

    await waitFor(() => {
      expect(result.current.data.job_id).toBe('job-1')
    })

    expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1', 'estimate-2'])
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
  })

  it('prevents an older in-flight load from overwriting a cache hit', async () => {
    const jobTwo = deferred<typeof versionPayload>()
    const jobTwoPayload = {
      ...versionPayload,
      job_id: 'job-2',
      items: [
        {
          ...versionPayload.items[0],
          estimate_id: 'estimate-job-2',
          job_id: 'job-2',
          job_title: 'Garage',
        },
      ],
    }

    loadQuoteJobVersions.mockResolvedValueOnce(versionPayload).mockImplementationOnce(() => jobTwo.promise)

    const { result, rerender } = renderHook(({ jobId }) => useQuoteJobVersions(jobId), {
      initialProps: { jobId: 'job-1' },
    })

    await waitFor(() => {
      expect(result.current.data.job_id).toBe('job-1')
    })

    rerender({ jobId: 'job-2' })

    await waitFor(() => {
      expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
    })

    rerender({ jobId: 'job-1' })

    await waitFor(() => {
      expect(result.current.data.job_id).toBe('job-1')
      expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1', 'estimate-2'])
    })

    jobTwo.resolve(jobTwoPayload)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.data.job_id).toBe('job-1')
    expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1', 'estimate-2'])
  })

  it('initializes empty and does not fetch when disabled', async () => {
    const { result } = renderHook(() => useQuoteJobVersions('job-1', { enabled: false }))

    expect(result.current.data.job_id).toBe('')
    expect(result.current.items).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.loadingMore).toBe(false)
    expect(result.current.error).toBeNull()
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()

    await act(async () => {
      await expect(result.current.refresh()).resolves.toBe(false)
    })

    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
  })

  it('ignores stale responses when the selected job changes quickly', async () => {
    const first = deferred<typeof versionPayload>()
    const second = deferred<typeof versionPayload>()

    loadQuoteJobVersions
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() =>
        second.promise.then(() => ({
          ...versionPayload,
          job_id: 'job-2',
          items: versionPayload.items.map((item) => ({
            ...item,
            estimate_id: `${item.estimate_id}-job-2`,
            job_id: 'job-2',
            job_title: 'Garage',
          })),
        }))
      )

    const { result, rerender } = renderHook(({ jobId }) => useQuoteJobVersions(jobId), {
      initialProps: { jobId: 'job-1' },
    })

    rerender({ jobId: 'job-2' })

    second.resolve(versionPayload)

    await waitFor(() => {
      expect(result.current.data.job_id).toBe('job-2')
    })

    first.resolve(versionPayload)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.data.job_id).toBe('job-2')
    expect(result.current.items.every((item) => item.job_id === 'job-2')).toBe(true)
  })

  it('clears stale version items immediately when switching to a different uncached job', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce(versionPayload)
      .mockResolvedValueOnce({
        job_id: 'job-2',
        total_versions: 0,
        limit: 25,
        next_cursor: null,
        items: [],
      })

    const { result, rerender } = renderHook(({ jobId }) => useQuoteJobVersions(jobId), {
      initialProps: { jobId: 'job-1' },
    })

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
    })

    rerender({ jobId: 'job-2' })

    expect(result.current.data.job_id).toBe('job-2')
    expect(result.current.items).toEqual([])
  })

  it('keeps the last good version list when a forced refresh fails', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce(versionPayload)
      .mockRejectedValueOnce(new Error('refresh failed'))

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.error).toBe('refresh failed')
  })

  it('clears version data when a non-preserving refresh attempt fails', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce(versionPayload)
      .mockRejectedValueOnce(new Error('refresh failed'))

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
    })

    await act(async () => {
      await result.current.attemptRefresh({ preserveDataOnError: false })
    })

    expect(result.current.data.job_id).toBe('job-1')
    expect(result.current.items).toEqual([])
    expect(result.current.error).toBe('refresh failed')
  })

  it('uses seeded selected-job versions before issuing a fetch', async () => {
    const seededPayload = {
      ...versionPayload,
      items: [versionPayload.items[0]],
      total_versions: 1,
    }

    const { result } = renderHook(() =>
      useQuoteJobVersions('job-1', {
        initialData: seededPayload,
      })
    )

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })

    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
  })

  it('writes refreshed seed data to cache under Strict Mode effect replay', async () => {
    const firstSeed = {
      ...versionPayload,
      total_versions: 1,
      items: [versionPayload.items[0]],
    }
    const refreshedSeed = {
      ...versionPayload,
      total_versions: 1,
      items: [versionPayload.items[1]],
    }
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>

    const { result, rerender } = renderHook(
      ({ initialData }) =>
        useQuoteJobVersions('job-1', {
          initialData,
        }),
      {
        initialProps: {
          initialData: firstSeed,
        },
        wrapper,
      }
    )

    await waitFor(() => {
      expect(result.current.hasResolved).toBe(true)
      expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-1'])
    })

    rerender({ initialData: refreshedSeed })

    await waitFor(() => {
      expect(result.current.hasResolved).toBe(true)
      expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-2'])
    })

    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
  })

  it('lets refreshed seed data invalidate an older in-flight versions fetch', async () => {
    const stale = deferred<typeof versionPayload>()
    const seededPayload = {
      ...versionPayload,
      total_versions: 1,
      items: [versionPayload.items[1]],
    }

    loadQuoteJobVersions.mockImplementationOnce(() => stale.promise)

    const { result, rerender } = renderHook(
      ({ initialData }) =>
        useQuoteJobVersions('job-1', {
          initialData,
        }),
      {
        initialProps: {
          initialData: null as typeof seededPayload | null,
        },
      }
    )

    rerender({ initialData: seededPayload })

    await waitFor(() => {
      expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-2'])
    })

    stale.resolve(versionPayload)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.items.map((item) => item.estimate_id)).toEqual(['estimate-2'])
    expect(result.current.pageData.total_versions).toBe(1)
  })
})

describe('createJobVersionsCache', () => {
  it('stores, reads, checks, and overwrites pages by job id', () => {
    const cache = createJobVersionsCache()
    const replacementPayload = {
      ...versionPayload,
      total_versions: 1,
      items: [versionPayload.items[1]],
    }

    expect(cache.has('job-1')).toBe(false)
    expect(cache.get('job-1')).toBeNull()

    cache.set('job-1', versionPayload)

    expect(cache.has('job-1')).toBe(true)
    expect(cache.get('job-1')).toBe(versionPayload)

    cache.set('job-1', replacementPayload)

    expect(cache.get('job-1')).toBe(replacementPayload)
  })
})

describe('job versions cache policy', () => {
  it('hydrates valid initial data into the cache and skips null pages', () => {
    const cache = createJobVersionsCache()

    expect(hydrateJobVersionsCache(cache, null)).toBe(false)
    expect(cache.has('job-1')).toBe(false)

    expect(hydrateJobVersionsCache(cache, versionPayload)).toBe(true)
    expect(cache.get('job-1')).toBe(versionPayload)
  })

  it('resolves initial hook data only when enabled and matched to the selected job', () => {
    const jobTwoPayload = {
      ...versionPayload,
      job_id: 'job-2',
    }

    expect(
      resolveInitialJobVersionsPage({
        jobId: 'job-1',
        enabled: true,
        initialData: versionPayload,
      })
    ).toBe(versionPayload)

    expect(
      resolveInitialJobVersionsPage({
        jobId: 'job-1',
        enabled: true,
        initialData: jobTwoPayload,
      })
    ).toEqual({
      job_id: 'job-1',
      total_versions: 0,
      limit: 25,
      next_cursor: null,
      items: [],
    })

    expect(
      resolveInitialJobVersionsPage({
        jobId: 'job-1',
        enabled: false,
        initialData: versionPayload,
      }).job_id
    ).toBe('')
  })

  it('returns cached pages unless a fresh load is forced', () => {
    const cache = createJobVersionsCache()

    cache.set('job-1', versionPayload)

    expect(getCachedJobVersionsPage(cache, 'job-1')).toBe(versionPayload)
    expect(getCachedJobVersionsPage(cache, 'job-1', { force: true })).toBeNull()
    expect(getCachedJobVersionsPage(cache, 'job-2')).toBeNull()
  })
})

describe('mergeJobVersionsPages', () => {
  it('merges pages without duplicating estimate ids', () => {
    const currentPage = {
      ...versionPayload,
      total_versions: 3,
      next_cursor: 'cursor-2',
    }
    const nextPage = {
      ...versionPayload,
      total_versions: 3,
      next_cursor: null,
      items: [
        versionPayload.items[1],
        {
          ...versionPayload.items[0],
          estimate_id: 'estimate-3',
          version_name: 'Version C',
        },
      ],
    }

    expect(mergeJobVersionsPages(currentPage, nextPage).items.map((item) => item.estimate_id)).toEqual([
      'estimate-1',
      'estimate-2',
      'estimate-3',
    ])
  })
})
