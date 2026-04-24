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
  loadQuoteHomeSearch,
  loadQuoteJobVersions,
} = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  deleteQuoteVersion: vi.fn(),
  loadQuoteHomeBootstrap: vi.fn(),
  loadQuoteHomeSearch: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  deleteQuoteVersion,
  loadQuoteHomeBootstrap,
  loadQuoteHomeSearch,
  loadQuoteJobVersions,
}))

const summaryPayload = {
  total_versions: 3,
  draft_count: 1,
  sent_or_awaiting_count: 1,
  live_count: 1,
  pipeline_total: 1800,
}

const bootstrapJobs = [
  {
    id: 'job-1',
    customer_id: 'customer-1',
    customer_name: 'Alice',
    customer_address: '123 Main',
    title: 'Kitchen',
    description: null,
    status: 'estimate_pending',
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
]

const job1VersionsPayload = {
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
}

const job2VersionsPayload = {
  job_id: 'job-2',
  total_versions: 1,
  limit: 25,
  next_cursor: null,
  items: [
    {
      estimate_id: 'estimate-3',
      job_id: 'job-2',
      customer_id: 'customer-2',
      version_name: 'Garage Alt',
      version_state: 'archived',
      version_kind: 'alternate',
      version_sort_order: 1,
      job_title: 'Garage',
      customer_name: 'Bob',
      final_total: 800,
      updated_at: '2026-04-18T10:00:00.000Z',
      created_at: '2026-04-17T10:00:00.000Z',
      is_sent_estimate: true,
    },
  ],
}

const bootstrapPayload = {
  summary: summaryPayload,
  jobs: {
    query: '',
    limit: 25,
    next_cursor: 'cursor-2',
    items: bootstrapJobs,
  },
  selected_job_id: 'job-1',
  selected_job_versions: job1VersionsPayload,
}

const refreshedBootstrapPayload = {
  summary: {
    total_versions: 202,
    draft_count: 0,
    sent_or_awaiting_count: 1,
    live_count: 1,
    pipeline_total: 1300,
  },
  jobs: {
    query: '',
    limit: 25,
    next_cursor: 'cursor-2',
    items: [
      {
        ...bootstrapJobs[0],
        version_count: 201,
      },
      bootstrapJobs[1],
    ],
  },
  selected_job_id: 'job-1',
  selected_job_versions: null,
}

const refreshedJob1VersionsPayload = {
  job_id: 'job-1',
  total_versions: 1,
  limit: 25,
  next_cursor: null,
  items: [job1VersionsPayload.items[0]],
}

describe('useQuotesHomePage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    push.mockReset()
    createQuoteVersion.mockReset()
    deleteQuoteVersion.mockReset()
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeSearch.mockReset()
    loadQuoteJobVersions.mockReset()
    loadQuoteHomeSearch.mockResolvedValue({
      query: '',
      items: [],
    })
  })

  it('uses bootstrap-selected versions without an immediate duplicate fetch and keeps search separate', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(bootstrapPayload)
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'revision',
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

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')

    act(() => {
      result.current.actions.setSearchQuery('revision')
      result.current.actions.setJobQuery('garage')
    })

    await waitFor(
      () => {
        expect(result.current.header.searchResults.map((estimate) => estimate.id)).toEqual([
          'estimate-2',
        ])
      },
      { timeout: 1500 }
    )

    expect(loadQuoteHomeSearch).toHaveBeenCalledWith('revision')
    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-2'])
  })

  it('loads versions for a newly selected job and creates a version', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(bootstrapPayload)
    loadQuoteJobVersions.mockResolvedValue(job2VersionsPayload)
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    act(() => {
      result.current.actions.setVersionName('  Custom Revision  ')
      result.current.actions.setVersionKind('revision')
      result.current.actions.setSelectedJobId('job-2')
    })

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-3',
      ])
    })

    expect(result.current.create.versionName).toBe('')
    expect(result.current.create.versionKind).toBe('standard')

    act(() => {
      result.current.actions.setVersionName('  Garage Custom  ')
      result.current.actions.setVersionKind('split')
    })

    await act(async () => {
      await result.current.actions.create()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-2')
    expect(createQuoteVersion).toHaveBeenCalledWith({
      job_id: 'job-2',
      customer_id: 'customer-2',
      version_kind: 'split',
      version_name: 'Garage Custom',
    })
    expect(push).toHaveBeenCalledWith('/crm/quotes/estimate-99')
  })

  it('surfaces an error when creating without a selected job', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue({
      summary: summaryPayload,
      jobs: {
        query: '',
        limit: 25,
        next_cursor: null,
        items: [],
      },
      selected_job_id: null,
      selected_job_versions: null,
    })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.actions.create()
    })

    expect(createQuoteVersion).not.toHaveBeenCalled()
    expect(result.current.feedback).toMatchObject({
      title: 'Quote action failed',
      details: ['Select a job before creating a version.'],
    })
  })

  it('refreshes bootstrap data and selected-job versions after delete', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(bootstrapPayload)
      .mockResolvedValueOnce(refreshedBootstrapPayload)
    loadQuoteJobVersions.mockResolvedValue(refreshedJob1VersionsPayload)
    deleteQuoteVersion.mockResolvedValue({ data: { ok: true } })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    await act(async () => {
      await result.current.actions.confirmDelete()
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(2)
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(1)
    expect(result.current.dialogs.delete.estimateId).toBeNull()
    expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
      'estimate-2',
    ])
    expect(result.current.summaryCards[0].value).toBe('0')
    expect(result.current.summaryCards[1].value).toBe('1')
    expect(result.current.summaryCards[2].value).toBe('1')
    expect(result.current.summaryCards[3].value).toBe('$1,300')
    expect(result.current.header.heroSummaryText).toBe(
      '202 total versions · 0 drafts · 1 sent/awaiting · 1 live'
    )
    expect(result.current.selectedJob.stats).toEqual([
      { label: 'Customer', value: 'Alice' },
      { label: 'Job Status', value: 'Estimate Pending' },
      { label: 'Versions', value: '201' },
    ])
  })

  it('keeps delete success explicit when follow-up refresh fails without local shadow mutation', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(bootstrapPayload)
      .mockRejectedValueOnce(new Error('bootstrap refresh failed'))
    loadQuoteJobVersions.mockRejectedValue(new Error('versions refresh failed'))
    deleteQuoteVersion.mockResolvedValue({ data: { ok: true } })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    await act(async () => {
      await result.current.actions.confirmDelete()
    })

    expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
      'estimate-2',
      'estimate-1',
    ])
    expect(result.current.feedback).toMatchObject({
      title: 'Quote action completed with refresh errors',
      details: [
        'Quote deleted, but follow-up refresh failed. Reload the page if the quote still appears. Home refresh failed. bootstrap refresh failed Versions refresh failed. versions refresh failed',
      ],
    })
  })

  it('surfaces search errors separately from bootstrap data and retries search independently', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(bootstrapPayload)
    loadQuoteHomeSearch
      .mockRejectedValueOnce(new Error('search failed'))
      .mockResolvedValueOnce({
        query: 'revision',
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

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    act(() => {
      result.current.actions.setSearchQuery('revision')
    })

    await waitFor(
      () => {
        expect(result.current.header.searchErrorMessage).toBe('search failed')
      },
      { timeout: 1500 }
    )

    await act(async () => {
      result.current.actions.retrySearch()
    })

    await waitFor(
      () => {
        expect(result.current.header.searchResults.map((estimate) => estimate.id)).toEqual([
          'estimate-2',
        ])
      },
      { timeout: 1500 }
    )

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
    expect(loadQuoteHomeSearch).toHaveBeenCalledTimes(2)
    expect(result.current.header.searchErrorMessage).toBeNull()
  })

  it('keeps version-load failures separate from bootstrap failures', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue({
      ...bootstrapPayload,
      selected_job_versions: null,
    })
    loadQuoteJobVersions.mockRejectedValue(new Error('versions failed'))

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.feedback).toMatchObject({
      title: 'Quote home loaded with errors',
    })
    expect(result.current.feedback?.details).toContain('Job versions failed to load. versions failed')
    expect(result.current.header.searchErrorMessage).toBeNull()
  })

  it('surfaces bootstrap failures from the page feedback layer', async () => {
    loadQuoteHomeBootstrap.mockRejectedValue(new Error('bootstrap failed'))

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.feedback).toMatchObject({
      title: 'Quote home bootstrap failed to load',
      details: ['Quote home failed to load. bootstrap failed'],
    })
    expect(result.current.jobList.emptyState).toBe('no_jobs')
  })

  it('page refresh retries bootstrap and versions without rerunning search', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(bootstrapPayload)
      .mockResolvedValueOnce(refreshedBootstrapPayload)
    loadQuoteJobVersions.mockResolvedValue(refreshedJob1VersionsPayload)
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'revision',
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

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    act(() => {
      result.current.actions.setSearchQuery('revision')
    })

    await waitFor(
      () => {
        expect(result.current.header.searchResults).toHaveLength(1)
      },
      { timeout: 1500 }
    )

    await act(async () => {
      await result.current.actions.refresh()
    })

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(2)
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(1)
    expect(loadQuoteHomeSearch).toHaveBeenCalledTimes(1)
  })

  it('preserves empty states when there are no eligible jobs or quote versions', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue({
      summary: {
        total_versions: 0,
        draft_count: 0,
        sent_or_awaiting_count: 0,
        live_count: 0,
        pipeline_total: 0,
      },
      jobs: {
        query: '',
        limit: 25,
        next_cursor: null,
        items: [],
      },
      selected_job_id: null,
      selected_job_versions: null,
    })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.feedback).toBeNull()
    expect(result.current.jobList.emptyState).toBe('no_jobs')
    expect(result.current.selectedJob.title).toBeNull()
    expect(result.current.versionList.items).toEqual([])
    expect(result.current.create.canCreate).toBe(false)
  })
})
