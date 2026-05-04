import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobsPageReadModel,
} from '@/lib/quotes/quoteHomeTypes'
import { lastOpenedQuoteStorageKey } from '@/lib/quotes/lastOpenedQuote'
import {
  useQuotesHomeBootstrap,
  useQuotesHomeData,
  useQuotesHomeJobs,
} from '../useQuotesHomeData'

const { loadQuoteHomeBootstrap, loadQuoteHomeJobs } = vi.hoisted(() => ({
  loadQuoteHomeBootstrap: vi.fn(),
  loadQuoteHomeJobs: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteHomeBootstrap,
  loadQuoteHomeJobs,
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

const seededPayload = {
  summary: {
    total_versions: 3,
    draft_count: 1,
    sent_or_awaiting_count: 1,
    live_count: 1,
    pipeline_total: 1800,
  },
  jobs: {
    query: '',
    limit: 25,
    next_cursor: 'cursor-2',
    items: [
      {
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        title: 'Kitchen',
        description: null,
        status: 'estimate_scheduled',
        created_at: '2026-04-21T10:00:00.000Z',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        scheduled_end_date: null,
        scheduled_email_sent_at: null,
        completed_at: null,
        completed_email_sent_at: null,
        closeout_notes: null,
        linked_estimate_id: null,
        version_count: 2,
      },
      {
        id: 'job-2',
        customer_id: 'customer-2',
        customer_name: 'Bob',
        customer_address: '456 Oak',
        title: 'Garage',
        description: null,
        status: 'estimate_sent',
        created_at: '2026-04-20T10:00:00.000Z',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        scheduled_end_date: null,
        scheduled_email_sent_at: null,
        completed_at: null,
        completed_email_sent_at: null,
        closeout_notes: null,
        linked_estimate_id: null,
        version_count: 1,
      },
    ],
  },
  selected_job_id: 'job-1',
  selected_job_versions: {
    job_id: 'job-1',
    total_versions: 2,
    limit: 25,
    next_cursor: null,
    items: [],
  },
  latest_version: {
    estimate_id: 'estimate-home-1',
    org_id: 'org-1',
    job_id: 'job-1',
    customer_id: 'customer-1',
    version_name: 'Estimate Version 1',
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
}

const firstPayload = {
  summary: {
    total_versions: 1,
    draft_count: 1,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 500,
  },
  jobs: {
    query: '',
    limit: 25,
    next_cursor: null,
    items: [seededPayload.jobs.items[0]],
  },
  selected_job_id: 'job-1',
  selected_job_versions: {
    job_id: 'job-1',
    total_versions: 1,
    limit: 25,
    next_cursor: null,
    items: [],
  },
  latest_version: null,
}

const secondPayload = {
  summary: {
    total_versions: 2,
    draft_count: 0,
    sent_or_awaiting_count: 1,
    live_count: 1,
    pipeline_total: 1300,
  },
  jobs: {
    query: '',
    limit: 10,
    next_cursor: 'cursor-3',
    items: [seededPayload.jobs.items[1]],
  },
  selected_job_id: 'job-2',
  selected_job_versions: {
    job_id: 'job-2',
    total_versions: 2,
    limit: 10,
    next_cursor: 'cursor-4',
    items: [],
  },
  latest_version: null,
}

describe('useQuotesHomeData', () => {
  beforeEach(() => {
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeJobs.mockReset()
    window.localStorage.clear()
  })

  it('uses seeded bootstrap data without immediately refetching', async () => {
    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(result.current.summary.total_versions).toBe(3)
    expect(result.current.jobsPage.next_cursor).toBe('cursor-2')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.initialSelectedJobId).toBe('job-1')
    expect(result.current.initialSelectedJobVersions).toEqual(seededPayload.selected_job_versions)
  })

  it('ignores a stored last-opened quote from a different org', async () => {
    window.localStorage.setItem(
      lastOpenedQuoteStorageKey,
      JSON.stringify({
        estimate_id: 'estimate-other-org',
        org_id: 'org-2',
        job_id: 'job-other',
        customer_id: 'customer-other',
        version_name: 'Other Org Version',
        version_state: 'draft',
        version_kind: 'standard',
        version_sort_order: 1,
        job_title: 'Other Job',
        customer_name: 'Other Customer',
        final_total: null,
        updated_at: null,
        created_at: null,
        is_sent_estimate: false,
        opened_at: '2026-04-28T12:00:00.000Z',
      })
    )

    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() =>
      expect(result.current.latestVersion?.estimate_id).toBe('estimate-home-1')
    )

    expect(result.current.latestVersion?.job_title).toBe('Kitchen')
  })

  it('loads initial bootstrap data when no initial data is provided', async () => {
    loadQuoteHomeBootstrap.mockResolvedValueOnce(firstPayload)

    const { result } = renderHook(() => useQuotesHomeData())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
    expect(loadQuoteHomeJobs).not.toHaveBeenCalled()
    expect(result.current.summary.total_versions).toBe(1)
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1'])
    expect(result.current.bootstrapError).toBeNull()
    expect(result.current.jobsError).toBeNull()
  })

  it('ignores stale responses from older refresh calls and keeps the latest final state', async () => {
    const initial = deferred<typeof firstPayload>()
    const stale = deferred<typeof firstPayload>()
    const latest = deferred<typeof secondPayload>()

    loadQuoteHomeBootstrap
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => stale.promise)
      .mockImplementationOnce(() => latest.promise)

    const { result } = renderHook(() => useQuotesHomeData())

    await act(async () => {
      void result.current.attemptRefresh()
      void result.current.attemptRefresh()
    })

    latest.resolve(secondPayload)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobsPage.query).toBe('')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.initialSelectedJobId).toBe('job-2')
    expect(result.current.bootstrapError).toBeNull()
    expect(result.current.jobsError).toBeNull()

    initial.resolve(firstPayload)
    stale.resolve(firstPayload)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobsPage.query).toBe('')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.bootstrapError).toBeNull()
    expect(result.current.jobsError).toBeNull()
  })

  it('keeps prior bootstrap data when refresh fails', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(firstPayload)
      .mockRejectedValueOnce(new Error('bootstrap failed'))

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    let refreshed: Awaited<ReturnType<typeof result.current.attemptRefresh>> | null = null
    await act(async () => {
      refreshed = await result.current.attemptRefresh()
    })

    expect(result.current.bootstrapError).toBe('bootstrap failed')
    expect(result.current.jobsError).toBeNull()
    expect(result.current.summary.total_versions).toBe(1)
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1'])
    expect(refreshed).toEqual({
      ok: false,
      error: 'bootstrap failed',
      data: null,
    })
  })

  it('returns the successful attempt result after a refreshed bootstrap reload', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(firstPayload)
      .mockResolvedValueOnce(secondPayload)

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    let refreshed: Awaited<ReturnType<typeof result.current.attemptRefresh>> | null = null
    await act(async () => {
      refreshed = await result.current.attemptRefresh()
    })

    expect(refreshed).toEqual({
      ok: true,
      error: null,
      data: secondPayload,
    })
    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobsPage.next_cursor).toBe('cursor-3')
    expect(result.current.initialSelectedJobId).toBe('job-2')
    expect(result.current.bootstrapError).toBeNull()
    expect(result.current.jobsError).toBeNull()
  })

  it('ignores stale jobs-page responses after a newer query wins', async () => {
    const staleGarage = deferred<QuoteHomeJobsPageReadModel>()
    const latestKitchen = deferred<QuoteHomeJobsPageReadModel>()
    loadQuoteHomeJobs
      .mockImplementationOnce(() => staleGarage.promise)
      .mockImplementationOnce(() => latestKitchen.promise)

    const { result, rerender } = renderHook(
      ({ jobQuery }) => useQuotesHomeData(seededPayload, { jobQuery }),
      {
        initialProps: {
          jobQuery: '',
        },
      }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ jobQuery: 'garage' })
    await waitFor(() => expect(loadQuoteHomeJobs).toHaveBeenCalledTimes(1))

    rerender({ jobQuery: 'kitchen' })
    await waitFor(() => expect(loadQuoteHomeJobs).toHaveBeenCalledTimes(2))

    await act(async () => {
      latestKitchen.resolve({
        query: 'kitchen',
        limit: 25,
        next_cursor: null,
        items: [seededPayload.jobs.items[0]],
      })
    })

    await waitFor(() => expect(result.current.jobsPage.query).toBe('kitchen'))
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1'])

    await act(async () => {
      staleGarage.resolve({
        query: 'garage',
        limit: 25,
        next_cursor: null,
        items: [seededPayload.jobs.items[1]],
      })
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.jobsPage.query).toBe('kitchen')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1'])
    expect(result.current.jobsError).toBeNull()
  })

  it('lets a query change supersede an in-flight loadMore page', async () => {
    const staleNextPage = deferred<QuoteHomeJobsPageReadModel>()
    const latestGarage = deferred<QuoteHomeJobsPageReadModel>()
    loadQuoteHomeJobs
      .mockImplementationOnce(() => staleNextPage.promise)
      .mockImplementationOnce(() => latestGarage.promise)

    const { result, rerender } = renderHook(
      ({ jobQuery }) => useQuotesHomeData(seededPayload, { jobQuery }),
      {
        initialProps: {
          jobQuery: '',
        },
      }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    let loadMorePromise: Promise<void> = Promise.resolve()
    await act(async () => {
      loadMorePromise = result.current.loadMore()
      await Promise.resolve()
    })

    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({
      query: '',
      limit: 25,
      cursor: 'cursor-2',
    })

    rerender({ jobQuery: 'garage' })
    await waitFor(() => expect(loadQuoteHomeJobs).toHaveBeenCalledTimes(2))

    await act(async () => {
      latestGarage.resolve({
        query: 'garage',
        limit: 25,
        next_cursor: null,
        items: [seededPayload.jobs.items[1]],
      })
    })

    await waitFor(() => expect(result.current.jobsPage.query).toBe('garage'))
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])

    await act(async () => {
      staleNextPage.resolve({
        query: '',
        limit: 25,
        next_cursor: null,
        items: [
          {
            ...seededPayload.jobs.items[1],
            id: 'job-3',
            customer_id: 'customer-3',
            customer_name: 'Charlie',
            customer_address: '789 Pine',
            title: 'Bath',
          },
        ],
      })
      await loadMorePromise
    })

    expect(result.current.jobsPage.query).toBe('garage')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.jobsError).toBeNull()
  })

  it('appends another jobs page when loadMore runs', async () => {
    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.hasMore).toBe(true)

    loadQuoteHomeJobs.mockResolvedValue({
      query: '',
      limit: 25,
      next_cursor: null,
      items: [
        {
          ...seededPayload.jobs.items[1],
          id: 'job-3',
          customer_id: 'customer-3',
          customer_name: 'Charlie',
          customer_address: '789 Pine',
          title: 'Bath',
        },
      ],
    })

    await act(async () => {
      await result.current.loadMore()
    })

    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({
      query: '',
      limit: 25,
      cursor: 'cursor-2',
    })
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2', 'job-3'])
    expect(result.current.jobsPage.next_cursor).toBeNull()
    expect(result.current.hasMore).toBe(false)
  })

  it('keeps the existing jobs page and releases loadMore after a failed page load', async () => {
    loadQuoteHomeJobs
      .mockRejectedValueOnce(new Error('jobs page failed'))
      .mockResolvedValueOnce({
        query: '',
        limit: 25,
        next_cursor: null,
        items: [
          {
            ...seededPayload.jobs.items[1],
            id: 'job-3',
            customer_id: 'customer-3',
            customer_name: 'Charlie',
            customer_address: '789 Pine',
            title: 'Bath',
          },
        ],
      })

    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.jobsError).toBe('jobs page failed')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(loadQuoteHomeJobs).toHaveBeenCalledTimes(2)
    expect(result.current.jobsError).toBeNull()
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2', 'job-3'])
    expect(result.current.hasMore).toBe(false)
  })

  it('issues one jobs-page request for rapid duplicate loadMore calls', async () => {
    const nextPage = deferred<QuoteHomeJobsPageReadModel>()
    loadQuoteHomeJobs.mockImplementationOnce(() => nextPage.promise)

    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    await waitFor(() => expect(result.current.loading).toBe(false))

    let firstLoadMore: Promise<void> = Promise.resolve()
    let secondLoadMore: Promise<void> = Promise.resolve()
    await act(async () => {
      firstLoadMore = result.current.loadMore()
      secondLoadMore = result.current.loadMore()
      await Promise.resolve()
    })

    expect(loadQuoteHomeJobs).toHaveBeenCalledTimes(1)
    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({
      query: '',
      limit: 25,
      cursor: 'cursor-2',
    })

    await act(async () => {
      nextPage.resolve({
        query: '',
        limit: 25,
        next_cursor: null,
        items: [
          {
            ...seededPayload.jobs.items[1],
            id: 'job-3',
            customer_id: 'customer-3',
            customer_name: 'Charlie',
            customer_address: '789 Pine',
            title: 'Bath',
          },
        ],
      })
      await firstLoadMore
      await secondLoadMore
    })

    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2', 'job-3'])
    expect(result.current.hasMore).toBe(false)
  })

  it('allows loadMore to run again after the prior jobs-page request settles', async () => {
    loadQuoteHomeJobs
      .mockResolvedValueOnce({
        query: '',
        limit: 25,
        next_cursor: 'cursor-3',
        items: [
          {
            ...seededPayload.jobs.items[1],
            id: 'job-3',
            customer_id: 'customer-3',
            customer_name: 'Charlie',
            customer_address: '789 Pine',
            title: 'Bath',
          },
        ],
      })
      .mockResolvedValueOnce({
        query: '',
        limit: 25,
        next_cursor: null,
        items: [
          {
            ...seededPayload.jobs.items[1],
            id: 'job-4',
            customer_id: 'customer-4',
            customer_name: 'Dana',
            customer_address: '321 Cedar',
            title: 'Exterior',
          },
        ],
      })

    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loadMore()
    })

    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(1, {
      query: '',
      limit: 25,
      cursor: 'cursor-2',
    })
    expect(result.current.jobsPage.next_cursor).toBe('cursor-3')

    await act(async () => {
      await result.current.loadMore()
    })

    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(2, {
      query: '',
      limit: 25,
      cursor: 'cursor-3',
    })
    expect(result.current.jobs.map((job) => job.id)).toEqual([
      'job-1',
      'job-2',
      'job-3',
      'job-4',
    ])
    expect(result.current.hasMore).toBe(false)
  })

  it('reloads jobs from the server when the job query changes and paginates inside that query', async () => {
    loadQuoteHomeJobs
      .mockResolvedValueOnce({
        query: 'garage',
        limit: 25,
        next_cursor: 'cursor-3',
        items: [seededPayload.jobs.items[1]],
      })
      .mockResolvedValueOnce({
        query: 'garage',
        limit: 25,
        next_cursor: null,
        items: [
          {
            ...seededPayload.jobs.items[1],
            id: 'job-3',
            customer_id: 'customer-3',
            customer_name: 'Charlie',
            customer_address: '789 Pine',
            title: 'Garage Addition',
          },
        ],
      })

    const { result, rerender } = renderHook(
      ({ jobQuery }) => useQuotesHomeData(seededPayload, { jobQuery }),
      {
        initialProps: {
          jobQuery: '',
        },
      }
    )

    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender({ jobQuery: ' garage ' })

    await waitFor(() => expect(result.current.jobsPage.query).toBe('garage'))

    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(1, {
      query: 'garage',
      limit: 25,
      cursor: undefined,
    })
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(2, {
      query: 'garage',
      limit: 25,
      cursor: 'cursor-3',
    })
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2', 'job-3'])
    expect(result.current.hasMore).toBe(false)
  })

  it('refreshes bootstrap and then reloads active filtered jobs when queries differ', async () => {
    const refreshedBootstrap = {
      ...secondPayload,
      jobs: {
        query: '',
        limit: 10,
        next_cursor: null,
        items: [seededPayload.jobs.items[0]],
      },
    }

    loadQuoteHomeBootstrap.mockResolvedValueOnce(refreshedBootstrap)
    loadQuoteHomeJobs
      .mockResolvedValueOnce({
        query: 'garage',
        limit: 25,
        next_cursor: null,
        items: [seededPayload.jobs.items[1]],
      })
      .mockResolvedValueOnce({
        query: 'garage',
        limit: 25,
        next_cursor: null,
        items: [seededPayload.jobs.items[1]],
      })

    const { result } = renderHook(() =>
      useQuotesHomeData(seededPayload, { jobQuery: ' garage ' })
    )

    await waitFor(() => expect(result.current.jobsPage.query).toBe('garage'))

    let refreshed: Awaited<ReturnType<typeof result.current.attemptRefresh>> | null = null
    await act(async () => {
      refreshed = await result.current.attemptRefresh()
    })

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
    expect(loadQuoteHomeJobs).toHaveBeenCalledTimes(2)
    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(2, {
      query: 'garage',
      limit: 25,
      cursor: undefined,
    })
    expect(refreshed).toEqual({
      ok: true,
      error: null,
      data: refreshedBootstrap,
    })
    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobsPage.query).toBe('garage')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.jobsError).toBeNull()
  })

  it('keeps empty fallback data when the first bootstrap load fails', async () => {
    loadQuoteHomeBootstrap.mockRejectedValue(new Error('bootstrap failed'))

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.summary.total_versions).toBe(0)
    expect(result.current.jobsPage.items).toEqual([])
    expect(result.current.initialSelectedJobId).toBeNull()
    expect(result.current.bootstrapError).toBe('bootstrap failed')
    expect(result.current.jobsError).toBeNull()
  })

  it('exposes jobs-page errors separately from bootstrap errors and retries only jobs', async () => {
    loadQuoteHomeJobs
      .mockRejectedValueOnce(new Error('jobs failed'))
      .mockResolvedValueOnce({
        query: 'garage',
        limit: 25,
        next_cursor: null,
        items: [seededPayload.jobs.items[1]],
      })

    const { result, rerender } = renderHook(
      ({ jobQuery }) => useQuotesHomeData(seededPayload, { jobQuery }),
      {
        initialProps: {
          jobQuery: '',
        },
      }
    )

    rerender({ jobQuery: 'garage' })

    await waitFor(() => expect(result.current.jobsError).toBe('jobs failed'))

    expect(result.current.bootstrapError).toBeNull()
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])

    await act(async () => {
      await expect(result.current.retryJobs()).resolves.toBe(true)
    })

    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(loadQuoteHomeJobs).toHaveBeenCalledTimes(2)
    expect(result.current.jobsError).toBeNull()
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
  })
})

describe('useQuotesHomeBootstrap', () => {
  beforeEach(() => {
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeJobs.mockReset()
  })

  it('uses seeded bootstrap data without pagination dependencies', async () => {
    const { result } = renderHook(() => useQuotesHomeBootstrap(seededPayload))

    await waitFor(() => expect(result.current.bootstrapLoading).toBe(false))

    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(loadQuoteHomeJobs).not.toHaveBeenCalled()
    expect(result.current.bootstrapData).toEqual(seededPayload)
    expect(result.current.bootstrapError).toBeNull()
  })

  it('loads bootstrap data and exposes bootstrap-specific errors', async () => {
    loadQuoteHomeBootstrap.mockRejectedValue(new Error('bootstrap failed'))

    const { result } = renderHook(() => useQuotesHomeBootstrap())

    await waitFor(() => expect(result.current.bootstrapLoading).toBe(false))

    expect(result.current.bootstrapData.summary.total_versions).toBe(0)
    expect(result.current.bootstrapData.jobs.items).toEqual([])
    expect(result.current.bootstrapError).toBe('bootstrap failed')
    expect(loadQuoteHomeJobs).not.toHaveBeenCalled()
  })
})

describe('useQuotesHomeJobs', () => {
  beforeEach(() => {
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeJobs.mockReset()
  })

  it('seeds jobs from bootstrap data without loading bootstrap', async () => {
    const { result } = renderHook(() => useQuotesHomeJobs(seededPayload, ''))

    await waitFor(() => expect(result.current.jobsLoading).toBe(false))

    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(loadQuoteHomeJobs).not.toHaveBeenCalled()
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.hasMoreJobs).toBe(true)
    expect(result.current.jobsError).toBeNull()
  })

  it('loads query-specific pages and reports jobs errors independently', async () => {
    loadQuoteHomeJobs.mockRejectedValueOnce(new Error('jobs failed')).mockResolvedValueOnce({
      query: 'garage',
      limit: 25,
      next_cursor: null,
      items: [seededPayload.jobs.items[1]],
    })

    const { result, rerender } = renderHook(
      ({ jobQuery }) => useQuotesHomeJobs(seededPayload, jobQuery),
      {
        initialProps: {
          jobQuery: '',
        },
      }
    )

    rerender({ jobQuery: ' garage ' })

    await waitFor(() => expect(result.current.jobsError).toBe('jobs failed'))

    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])

    await act(async () => {
      const refreshed = await result.current.refreshJobs()
      expect(refreshed).toEqual({ ok: true, error: null })
    })

    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(1, {
      query: 'garage',
      limit: 25,
      cursor: undefined,
    })
    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(2, {
      query: 'garage',
      limit: 25,
      cursor: undefined,
    })
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.jobsError).toBeNull()
  })

  it('keeps active query jobs when a refreshed bootstrap page has the default query', async () => {
    loadQuoteHomeJobs.mockResolvedValueOnce({
      query: 'garage',
      limit: 25,
      next_cursor: null,
      items: [seededPayload.jobs.items[1]],
    })

    const refreshedBootstrap: QuoteHomeBootstrapReadModel = {
      ...seededPayload,
      jobs: {
        query: '',
        limit: 25,
        next_cursor: null,
        items: [seededPayload.jobs.items[0]],
      },
    }

    const { result, rerender } = renderHook(
      ({
        bootstrap,
        jobQuery,
      }: {
        bootstrap: QuoteHomeBootstrapReadModel
        jobQuery: string
      }) => useQuotesHomeJobs(bootstrap, jobQuery),
      {
        initialProps: {
          bootstrap: seededPayload as QuoteHomeBootstrapReadModel,
          jobQuery: '',
        },
      }
    )

    rerender({
      bootstrap: seededPayload as QuoteHomeBootstrapReadModel,
      jobQuery: 'garage',
    })

    await waitFor(() => expect(result.current.jobsPage.query).toBe('garage'))

    rerender({ bootstrap: refreshedBootstrap, jobQuery: 'garage' })

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.jobsPage.query).toBe('garage')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(loadQuoteHomeJobs).toHaveBeenCalledTimes(1)
  })
})
