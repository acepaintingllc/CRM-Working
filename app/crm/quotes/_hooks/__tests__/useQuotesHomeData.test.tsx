import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuotesHomeData } from '../useQuotesHomeData'

const { loadQuoteHome } = vi.hoisted(() => ({
  loadQuoteHome: vi.fn(),
}))

const { fetchJobList } = vi.hoisted(() => ({
  fetchJobList: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteHome,
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

const firstHomePayload = {
  summary: {
    draft_count: 1,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 500,
  },
  total_versions: 1,
  version_counts_by_job: {
    'job-1': 1,
  },
  recent_estimates: [
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
      updated_at: '2026-04-20T10:00:00.000Z',
      created_at: '2026-04-19T10:00:00.000Z',
      is_sent_estimate: false,
    },
  ],
  snapshot: {
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
    updated_at: '2026-04-20T10:00:00.000Z',
    created_at: '2026-04-19T10:00:00.000Z',
    is_sent_estimate: false,
    total_versions: 1,
  },
  search_estimates: [
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
      updated_at: '2026-04-20T10:00:00.000Z',
      created_at: '2026-04-19T10:00:00.000Z',
      is_sent_estimate: false,
    },
  ],
}

const secondHomePayload = {
  summary: {
    draft_count: 0,
    sent_or_awaiting_count: 1,
    live_count: 1,
    pipeline_total: 1300,
  },
  total_versions: 2,
  version_counts_by_job: {
    'job-2': 2,
  },
  recent_estimates: [
    {
      estimate_id: 'estimate-2',
      job_id: 'job-2',
      customer_id: 'customer-2',
      version_name: 'Version B',
      version_state: 'live',
      version_kind: 'revision',
      version_sort_order: 2,
      job_title: 'Garage',
      customer_name: 'Bob',
      final_total: 1300,
      updated_at: '2026-04-21T10:00:00.000Z',
      created_at: '2026-04-20T10:00:00.000Z',
      is_sent_estimate: true,
    },
  ],
  snapshot: {
    estimate_id: 'estimate-2',
    job_id: 'job-2',
    customer_id: 'customer-2',
    version_name: 'Version B',
    version_state: 'live',
    version_kind: 'revision',
    version_sort_order: 2,
    job_title: 'Garage',
    customer_name: 'Bob',
    final_total: 1300,
    updated_at: '2026-04-21T10:00:00.000Z',
    created_at: '2026-04-20T10:00:00.000Z',
    is_sent_estimate: true,
    total_versions: 2,
  },
  search_estimates: [
    {
      estimate_id: 'estimate-2',
      job_id: 'job-2',
      customer_id: 'customer-2',
      version_name: 'Version B',
      version_state: 'live',
      version_kind: 'revision',
      version_sort_order: 2,
      job_title: 'Garage',
      customer_name: 'Bob',
      final_total: 1300,
      updated_at: '2026-04-21T10:00:00.000Z',
      created_at: '2026-04-20T10:00:00.000Z',
      is_sent_estimate: true,
    },
  ],
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
    loadQuoteHome.mockReset()
    fetchJobList.mockReset()
  })

  it('ignores stale responses from older refresh calls and keeps the latest final state', async () => {
    const initialHome = deferred<typeof firstHomePayload>()
    const initialJobs = deferred<typeof mixedJobsPayload>()
    const staleHome = deferred<typeof firstHomePayload>()
    const staleJobs = deferred<typeof mixedJobsPayload>()
    const latestHome = deferred<typeof secondHomePayload>()
    const latestJobs = deferred<typeof eligibleJobsPayload>()

    loadQuoteHome
      .mockImplementationOnce(() => initialHome.promise)
      .mockImplementationOnce(() => staleHome.promise)
      .mockImplementationOnce(() => latestHome.promise)
    fetchJobList
      .mockImplementationOnce(() => initialJobs.promise)
      .mockImplementationOnce(() => staleJobs.promise)
      .mockImplementationOnce(() => latestJobs.promise)

    const { result } = renderHook(() => useQuotesHomeData())

    await act(async () => {
      void result.current.refresh()
      void result.current.refresh()
    })

    latestHome.resolve(secondHomePayload)
    latestJobs.resolve(eligibleJobsPayload)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.snapshot?.estimate_id).toBe('estimate-2')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])

    initialHome.resolve(firstHomePayload)
    initialJobs.resolve(mixedJobsPayload)
    staleHome.resolve(firstHomePayload)
    staleJobs.resolve(mixedJobsPayload)

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.data?.snapshot?.estimate_id).toBe('estimate-2')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.error).toBeNull()
  })

  it('surfaces refresh errors, resets to empty state, and recovers on the next success', async () => {
    loadQuoteHome.mockResolvedValueOnce(firstHomePayload).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(secondHomePayload)
    fetchJobList.mockResolvedValueOnce(mixedJobsPayload).mockResolvedValueOnce(mixedJobsPayload).mockResolvedValueOnce(eligibleJobsPayload)

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.snapshot?.estimate_id).toBe('estimate-1')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('boom')
    expect(result.current.data).toBeNull()
    expect(result.current.jobs).toEqual([])

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.data?.snapshot?.estimate_id).toBe('estimate-2')
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
  })

  it('updates only the quote-home payload when setData is used', async () => {
    loadQuoteHome.mockResolvedValue(firstHomePayload)
    fetchJobList.mockResolvedValue(mixedJobsPayload)

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setData((current) =>
        current
          ? {
              ...current,
              total_versions: 99,
            }
          : current
      )
    })

    expect(result.current.data?.total_versions).toBe(99)
    expect(result.current.jobs.map((job) => job.id)).toEqual(['job-1', 'job-2'])
  })
})
