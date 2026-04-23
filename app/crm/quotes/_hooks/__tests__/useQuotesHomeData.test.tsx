import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuotesHomeData } from '../useQuotesHomeData'

const { loadQuoteHomeBootstrap, loadQuoteHomeJobs, loadQuoteHomeSummary } = vi.hoisted(() => ({
  loadQuoteHomeBootstrap: vi.fn(),
  loadQuoteHomeJobs: vi.fn(),
  loadQuoteHomeSummary: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteHomeBootstrap,
  loadQuoteHomeJobs,
  loadQuoteHomeSummary,
}))

<<<<<<< Updated upstream
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

const firstPayload = {
=======
const bootstrapPayload = {
>>>>>>> Stashed changes
  summary: {
    total_versions: 1,
    draft_count: 1,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 500,
  },
<<<<<<< Updated upstream
  jobCounts: {
    items: [{ job_id: 'job-1', version_count: 1 }],
  },
  jobs: [
    {
      id: 'job-1',
      customer_id: 'customer-1',
      customer_name: 'Alice',
      customer_address: '123 Main',
      title: 'Kitchen',
      description: null,
      status: 'estimate_scheduled',
      estimate_date: null,
      estimate_sent_at: null,
      scheduled_date: null,
      completed_at: null,
    },
  ],
}

const secondPayload = {
  summary: {
    total_versions: 2,
    draft_count: 0,
    sent_or_awaiting_count: 1,
    live_count: 1,
    pipeline_total: 1300,
  },
  jobCounts: {
    items: [{ job_id: 'job-2', version_count: 2 }],
  },
  jobs: [
    {
      id: 'job-2',
      customer_id: 'customer-2',
      customer_name: 'Bob',
      customer_address: '456 Oak',
      title: 'Garage',
      description: null,
      status: 'estimate_sent',
      estimate_date: null,
      estimate_sent_at: null,
      scheduled_date: null,
      completed_at: null,
    },
  ],
=======
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
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        completed_at: null,
        version_count: 2,
      },
    ],
  },
  selected_job_id: 'job-1',
  selected_job_versions: null,
>>>>>>> Stashed changes
}

describe('useQuotesHomeData', () => {
  beforeEach(() => {
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeJobs.mockReset()
    loadQuoteHomeSummary.mockReset()
  })

  it('uses seeded bootstrap data without immediately refetching', async () => {
<<<<<<< Updated upstream
    const { result } = renderHook(() => useQuotesHomeData(firstPayload))

    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.summary.total_versions).toBe(1)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-1', version_count: 1 }])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1'])
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
      void result.current.refresh()
      void result.current.refresh()
    })

    latest.resolve(secondPayload)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-2', version_count: 2 }])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])

    initial.resolve(firstPayload)
    stale.resolve(firstPayload)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-2', version_count: 2 }])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.failures.bootstrap).toBeNull()
    expect(result.current.feedback).toBeNull()
  })

  it('keeps prior bootstrap data when refresh fails', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(firstPayload)
      .mockRejectedValueOnce(new Error('bootstrap failed'))
=======
    const { result } = renderHook(() => useQuotesHomeData(bootstrapPayload))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(result.current.summary.total_versions).toBe(3)
    expect(result.current.jobsPage.items.map((job) => job.id)).toEqual(['job-1'])
    expect(result.current.selectedJobId).toBe('job-1')
    expect(result.current.hasMoreJobs).toBe(true)
  })

  it('loads bootstrap data when no initial payload exists', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(bootstrapPayload)
>>>>>>> Stashed changes

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

<<<<<<< Updated upstream
=======
    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
    expect(result.current.summary.total_versions).toBe(3)
    expect(result.current.jobsPage.items[0]?.version_count).toBe(2)
  })

  it('refreshes summary and the current jobs page together', async () => {
    loadQuoteHomeSummary.mockResolvedValue({
      total_versions: 4,
      draft_count: 0,
      sent_or_awaiting_count: 2,
      live_count: 2,
      pipeline_total: 2400,
    })
    loadQuoteHomeJobs.mockResolvedValue({
      query: '',
      limit: 25,
      next_cursor: null,
      items: [
        {
          ...bootstrapPayload.jobs.items[0],
          version_count: 3,
        },
      ],
    })

    const { result } = renderHook(() => useQuotesHomeData(bootstrapPayload))

>>>>>>> Stashed changes
    await act(async () => {
      await result.current.refresh()
    })

<<<<<<< Updated upstream
    expect(result.current.failures.bootstrap).toEqual({
      source: 'bootstrap',
      message: 'bootstrap failed',
    })
    expect(result.current.feedback?.details).toEqual([
      'Quote home failed to load. bootstrap failed',
    ])
    expect(result.current.summary.total_versions).toBe(1)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-1', version_count: 1 }])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1'])
=======
    expect(loadQuoteHomeSummary).toHaveBeenCalledTimes(1)
    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({ query: '', limit: 25 })
    expect(result.current.summary.total_versions).toBe(4)
    expect(result.current.jobsPage.items[0]?.version_count).toBe(3)
>>>>>>> Stashed changes
  })

  it('loads the next jobs page and appends results', async () => {
    loadQuoteHomeJobs.mockResolvedValue({
      query: '',
      limit: 25,
      next_cursor: null,
      items: [
        {
          ...bootstrapPayload.jobs.items[0],
          id: 'job-2',
          title: 'Garage',
          customer_id: 'customer-2',
          customer_name: 'Bob',
          version_count: 1,
        },
      ],
    })

    const { result } = renderHook(() => useQuotesHomeData(bootstrapPayload))

    await act(async () => {
      await result.current.loadMoreJobs()
    })

<<<<<<< Updated upstream
    expect(result.current.summary.total_versions).toBe(0)
    expect(result.current.jobCounts.items).toEqual([])
    expect(result.current.jobs).toEqual([])
    expect(result.current.failures.bootstrap).toEqual({
      source: 'bootstrap',
      message: 'bootstrap failed',
    })
    expect(result.current.feedback?.title).toBe('Quote home bootstrap failed to load')
=======
    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({
      query: '',
      cursor: 'cursor-2',
      limit: 25,
    })
    expect(result.current.jobsPage.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
>>>>>>> Stashed changes
  })
})
