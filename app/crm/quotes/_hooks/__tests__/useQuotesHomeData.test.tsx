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

const bootstrapPayload = {
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
}

describe('useQuotesHomeData', () => {
  beforeEach(() => {
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeJobs.mockReset()
    loadQuoteHomeSummary.mockReset()
  })

  it('uses seeded bootstrap data without immediately refetching', async () => {
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

    const { result } = renderHook(() => useQuotesHomeData())

    await waitFor(() => expect(result.current.loading).toBe(false))

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

    await act(async () => {
      await result.current.refresh()
    })

    expect(loadQuoteHomeSummary).toHaveBeenCalledTimes(1)
    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({ query: '', limit: 25 })
    expect(result.current.summary.total_versions).toBe(4)
    expect(result.current.jobsPage.items[0]?.version_count).toBe(3)
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

    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({
      query: '',
      cursor: 'cursor-2',
      limit: 25,
    })
    expect(result.current.jobsPage.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
  })
})
