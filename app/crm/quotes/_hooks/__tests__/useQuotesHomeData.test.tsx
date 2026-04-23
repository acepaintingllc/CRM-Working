import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuotesHomeData } from '../useQuotesHomeData'

const { loadQuoteHomeJobCounts, loadQuoteHomeSummary } = vi.hoisted(
  () => ({
    loadQuoteHomeJobCounts: vi.fn(),
    loadQuoteHomeSummary: vi.fn(),
  })
)

const { fetchJobList } = vi.hoisted(() => ({
  fetchJobList: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteHomeJobCounts,
  loadQuoteHomeSummary,
}))

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList,
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
}

const eligibleJobsPayload = [
  {
    id: 'job-1',
    customer_id: 'customer-1',
    customer_name: 'Alice',
    customer_address: '123 Main',
    title: 'Kitchen',
    description: null,
    status: 'estimate_pending',
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
]

const mixedJobsPayload = [
  {
    id: 'job-x',
    customer_id: null,
    customer_name: null,
    customer_address: null,
    title: 'Ignore me',
    description: null,
    status: 'lead',
    estimate_date: null,
    estimate_sent_at: null,
    scheduled_date: null,
    completed_at: null,
  },
  ...eligibleJobsPayload,
]

describe('useQuotesHomeData', () => {
  beforeEach(() => {
    loadQuoteHomeJobCounts.mockReset()
    loadQuoteHomeSummary.mockReset()
    fetchJobList.mockReset()
  })

  it('ignores stale responses from older refresh calls and keeps the latest final state', async () => {
    const initial = {
      summary: deferred<typeof firstPayload.summary>(),
      jobCounts: deferred<typeof firstPayload.jobCounts>(),
      jobs: deferred<typeof mixedJobsPayload>(),
    }
    const stale = {
      summary: deferred<typeof firstPayload.summary>(),
      jobCounts: deferred<typeof firstPayload.jobCounts>(),
      jobs: deferred<typeof mixedJobsPayload>(),
    }
    const latest = {
      summary: deferred<typeof secondPayload.summary>(),
      jobCounts: deferred<typeof secondPayload.jobCounts>(),
      jobs: deferred<typeof eligibleJobsPayload>(),
    }

    loadQuoteHomeSummary
      .mockImplementationOnce(() => initial.summary.promise)
      .mockImplementationOnce(() => stale.summary.promise)
      .mockImplementationOnce(() => latest.summary.promise)
    loadQuoteHomeJobCounts
      .mockImplementationOnce(() => initial.jobCounts.promise)
      .mockImplementationOnce(() => stale.jobCounts.promise)
      .mockImplementationOnce(() => latest.jobCounts.promise)
    fetchJobList
      .mockImplementationOnce(() => initial.jobs.promise)
      .mockImplementationOnce(() => stale.jobs.promise)
      .mockImplementationOnce(() => latest.jobs.promise)

    const { result } = renderHook(() => useQuotesHomeData())

    await act(async () => {
      void result.current.refresh()
      void result.current.refresh()
    })

    latest.summary.resolve(secondPayload.summary)
    latest.jobCounts.resolve(secondPayload.jobCounts)
    latest.jobs.resolve(eligibleJobsPayload)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-2', version_count: 2 }])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])

    initial.summary.resolve(firstPayload.summary)
    initial.jobCounts.resolve(firstPayload.jobCounts)
    initial.jobs.resolve(mixedJobsPayload)
    stale.summary.resolve(firstPayload.summary)
    stale.jobCounts.resolve(firstPayload.jobCounts)
    stale.jobs.resolve(mixedJobsPayload)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-2', version_count: 2 }])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.failures.summary).toBeNull()
    expect(result.current.failures.jobCounts).toBeNull()
    expect(result.current.failures.jobs).toBeNull()
    expect(result.current.feedback).toBeNull()
  })

  it('keeps prior summary when only summary reload fails', async () => {
    loadQuoteHomeSummary
      .mockResolvedValueOnce(firstPayload.summary)
      .mockRejectedValueOnce(new Error('summary failed'))
    loadQuoteHomeJobCounts
      .mockResolvedValueOnce(firstPayload.jobCounts)
      .mockResolvedValueOnce(secondPayload.jobCounts)
    fetchJobList.mockResolvedValue(mixedJobsPayload)

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.failures.summary).toEqual({
      source: 'summary',
      message: 'summary failed',
    })
    expect(result.current.failures.jobCounts).toBeNull()
    expect(result.current.failures.jobs).toBeNull()
    expect(result.current.feedback?.details).toEqual(['Quote summary failed to load. summary failed'])
    expect(result.current.summary.total_versions).toBe(1)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-2', version_count: 2 }])
  })

  it('keeps prior job counts when only job counts reload fails', async () => {
    loadQuoteHomeSummary
      .mockResolvedValueOnce(firstPayload.summary)
      .mockResolvedValueOnce(secondPayload.summary)
    loadQuoteHomeJobCounts
      .mockResolvedValueOnce(firstPayload.jobCounts)
      .mockRejectedValueOnce(new Error('counts failed'))
    fetchJobList.mockResolvedValue(mixedJobsPayload)

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.failures.summary).toBeNull()
    expect(result.current.failures.jobCounts).toEqual({
      source: 'jobCounts',
      message: 'counts failed',
    })
    expect(result.current.failures.jobs).toBeNull()
    expect(result.current.feedback?.details).toEqual(['Job counts failed to load. counts failed'])
    expect(result.current.summary.total_versions).toBe(2)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-1', version_count: 1 }])
  })

  it('keeps partial data when only job counts fail on first load', async () => {
    loadQuoteHomeSummary.mockResolvedValue(firstPayload.summary)
    loadQuoteHomeJobCounts.mockRejectedValue(new Error('counts failed'))
    fetchJobList.mockResolvedValue(mixedJobsPayload)

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.summary.total_versions).toBe(1)
    expect(result.current.jobCounts.items).toEqual([])
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.failures.jobCounts).toEqual({
      source: 'jobCounts',
      message: 'counts failed',
    })
    expect(result.current.feedback?.title).toBe('Quote home job counts failed to load')
  })

  it('keeps partial data when eligible jobs fail on first load', async () => {
    loadQuoteHomeSummary.mockResolvedValue(firstPayload.summary)
    loadQuoteHomeJobCounts.mockResolvedValue(firstPayload.jobCounts)
    fetchJobList.mockRejectedValue(new Error('jobs failed'))

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.summary.total_versions).toBe(1)
    expect(result.current.jobCounts.items).toEqual([{ job_id: 'job-1', version_count: 1 }])
    expect(result.current.jobs).toEqual([])
    expect(result.current.failures.jobs).toEqual({
      source: 'jobs',
      message: 'jobs failed',
    })
    expect(result.current.feedback?.details).toEqual(['Eligible jobs failed to load. jobs failed'])
  })
})
