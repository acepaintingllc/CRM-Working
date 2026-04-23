import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuotesHomeData } from '../useQuotesHomeData'

const { loadQuoteHomeBootstrap } = vi.hoisted(() => ({
  loadQuoteHomeBootstrap: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteHomeBootstrap,
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
  jobCounts: {
    items: [
      { job_id: 'job-1', version_count: 2 },
      { job_id: 'job-2', version_count: 1 },
    ],
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
}

const firstPayload = {
  summary: {
    total_versions: 1,
    draft_count: 1,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 500,
  },
  jobCounts: {
    items: [{ job_id: 'job-1', version_count: 1 }],
  },
  jobs: [seededPayload.jobs[0]],
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
  jobs: [seededPayload.jobs[1]],
}

describe('useQuotesHomeData', () => {
  beforeEach(() => {
    loadQuoteHomeBootstrap.mockReset()
  })

  it('uses seeded bootstrap data without immediately refetching and derives selection state', async () => {
    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    await waitFor(() => {
      expect(result.current.selectedJobId).toBe('job-1')
    })

    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.summary.total_versions).toBe(3)
    expect(result.current.jobCounts.items).toEqual([
      { job_id: 'job-1', version_count: 2 },
      { job_id: 'job-2', version_count: 1 },
    ])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.selectedJob?.id).toBe('job-1')
    expect(result.current.versionCountByJob).toEqual({
      'job-1': 2,
      'job-2': 1,
    })
  })

  it('filters jobs using the local job query', async () => {
    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    act(() => {
      result.current.setJobQuery('garage')
    })

    expect(result.current.filteredJobs.map((job) => job.id)).toEqual(['job-2'])
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
    expect(result.current.bootstrapError).toBeNull()

    initial.resolve(firstPayload)
    stale.resolve(firstPayload)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-2', version_count: 2 }])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.bootstrapError).toBeNull()
  })

  it('keeps prior bootstrap data when refresh fails', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(firstPayload)
      .mockRejectedValueOnce(new Error('bootstrap failed'))

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.bootstrapError).toBe('bootstrap failed')
    expect(result.current.summary.total_versions).toBe(1)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-1', version_count: 1 }])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1'])
  })

  it('keeps empty fallback data when the first bootstrap load fails', async () => {
    loadQuoteHomeBootstrap.mockRejectedValue(new Error('bootstrap failed'))

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.summary.total_versions).toBe(0)
    expect(result.current.jobCounts.items).toEqual([])
    expect(result.current.jobs).toEqual([])
    expect(result.current.bootstrapError).toBe('bootstrap failed')
    expect(result.current.selectedJobId).toBe('')
    expect(result.current.selectedJob).toBeNull()
  })

  it('reconciles the selected job when refreshed jobs remove the current selection', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(firstPayload)

    const { result } = renderHook(() => useQuotesHomeData(seededPayload))

    await waitFor(() => {
      expect(result.current.selectedJobId).toBe('job-1')
    })

    act(() => {
      result.current.setSelectedJobId('job-2')
    })

    expect(result.current.selectedJobId).toBe('job-2')

    await act(async () => {
      await result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.selectedJobId).toBe('job-1')
    })
    expect(result.current.selectedJob?.id).toBe('job-1')
  })
})
