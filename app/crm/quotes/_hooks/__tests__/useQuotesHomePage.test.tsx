import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuotesHomePage } from '../useQuotesHomePage'

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}))

const {
  createQuoteVersion,
  deleteQuoteVersion,
  loadQuoteHomeBootstrap,
  loadQuoteHomeJobs,
  loadQuoteHomeSearch,
  loadQuoteHomeSummary,
  loadQuoteJobVersions,
} = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  deleteQuoteVersion: vi.fn(),
  loadQuoteHomeBootstrap: vi.fn(),
  loadQuoteHomeJobs: vi.fn(),
  loadQuoteHomeSearch: vi.fn(),
  loadQuoteHomeSummary: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  deleteQuoteVersion,
  loadQuoteHomeBootstrap,
  loadQuoteHomeJobs,
  loadQuoteHomeSearch,
  loadQuoteHomeSummary,
  loadQuoteJobVersions,
}))

const bootstrapPayload = {
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
        status: 'estimate_pending',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        completed_at: null,
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
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        completed_at: null,
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
    items: [
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
        updated_at: '2026-04-21T10:00:00.000Z',
        created_at: '2026-04-20T10:00:00.000Z',
        is_sent_estimate: true,
      },
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
  },
}

describe('useQuotesHomePage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    push.mockReset()
    createQuoteVersion.mockReset()
    deleteQuoteVersion.mockReset()
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeJobs.mockReset()
    loadQuoteHomeSearch.mockReset()
    loadQuoteHomeSummary.mockReset()
    loadQuoteJobVersions.mockReset()
    loadQuoteHomeSearch.mockResolvedValue({
      query: '',
      limit: 8,
      items: [],
    })
  })

  it('builds the page state from the bounded bootstrap payload', async () => {
    const { result } = renderHook(() => useQuotesHomePage(bootstrapPayload))

    await waitFor(() => expect(result.current.feedback.loading).toBe(false))

    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.jobList.hasMore).toBe(true)
    expect(result.current.selectedJob.title).toBe('Kitchen')
    expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
      'estimate-2',
      'estimate-1',
    ])
    expect(result.current.header.heroSummaryText).toBe(
      '3 total versions · 1 drafts · 1 sent/awaiting · 1 live'
    )
  })

  it('loads more jobs from the paged jobs endpoint', async () => {
    loadQuoteHomeJobs.mockResolvedValue({
      query: '',
      limit: 25,
      next_cursor: null,
      items: [
        {
          ...bootstrapPayload.jobs.items[0],
          id: 'job-3',
          title: 'Exterior',
          customer_id: 'customer-3',
          customer_name: 'Casey',
          version_count: 4,
        },
      ],
    })

    const { result } = renderHook(() => useQuotesHomePage(bootstrapPayload))

    await act(async () => {
      await result.current.actions.loadMoreJobs()
    })

    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2', 'job-3'])
  })

  it('creates a version under the selected job', async () => {
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })

    const { result } = renderHook(() => useQuotesHomePage(bootstrapPayload))

    act(() => {
      result.current.actions.setVersionName('  Kitchen Custom  ')
      result.current.actions.setVersionKind('revision')
    })

    await act(async () => {
      await result.current.actions.createVersion()
    })

    expect(createQuoteVersion).toHaveBeenCalledWith({
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'revision',
      version_name: 'Kitchen Custom',
    })
    expect(push).toHaveBeenCalledWith('/crm/quotes/estimate-99')
  })

  it('searches versions independently from the paged job rail', async () => {
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'revision',
      limit: 8,
      items: [
        {
          estimate_id: 'estimate-2',
          job_id: 'job-1',
          customer_id: 'customer-1',
          version_name: 'Version B',
          version_state: 'live',
          version_kind: 'revision',
          job_title: 'Kitchen',
          customer_name: 'Alice',
          updated_at: '2026-04-21T10:00:00.000Z',
          final_total: 1300,
          is_sent_estimate: true,
        },
      ],
    })

    const { result } = renderHook(() => useQuotesHomePage(bootstrapPayload))

    act(() => {
      result.current.actions.setSearchQuery('revision')
    })

    await waitFor(() => expect(result.current.header.searchResults).toHaveLength(1), {
      timeout: 1500,
    })

    expect(result.current.header.searchResults[0]?.id).toBe('estimate-2')
    expect(result.current.jobList.items).toHaveLength(2)
  })
})
