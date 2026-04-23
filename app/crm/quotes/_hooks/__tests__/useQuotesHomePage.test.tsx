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

const jobCountsPayload = {
  items: [
    { job_id: 'job-1', version_count: 2 },
    { job_id: 'job-2', version_count: 1 },
  ],
}

const bootstrapPayload = {
  summary: summaryPayload,
  jobCounts: jobCountsPayload,
  jobs: [
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
  ],
}

const job1VersionsPayload = {
  job_id: 'job-1',
  total_versions: 2,
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

const refreshedSummaryPayload = {
  total_versions: 202,
  draft_count: 0,
  sent_or_awaiting_count: 1,
  live_count: 1,
  pipeline_total: 1300,
}

const refreshedJobCountsPayload = {
  items: [
    { job_id: 'job-1', version_count: 201 },
    { job_id: 'job-2', version_count: 1 },
  ],
}

const refreshedBootstrapPayload = {
  summary: refreshedSummaryPayload,
  jobCounts: refreshedJobCountsPayload,
  jobs: bootstrapPayload.jobs,
}

const refreshedJob1VersionsPayload = {
  job_id: 'job-1',
  total_versions: 1,
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

  it('loads bootstrap home data, selected-job versions, and server-driven search state', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(bootstrapPayload)
    loadQuoteJobVersions.mockResolvedValue(job1VersionsPayload)
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

    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')

    act(() => {
      result.current.actions.setSearchQuery('revision')
      result.current.actions.setJobQuery('garage')
    })

    await waitFor(
      () => {
        expect(
          result.current.header.searchResults.map((estimate) => estimate.id)
        ).toEqual(['estimate-2'])
      },
      { timeout: 1500 }
    )

    expect(loadQuoteHomeSearch).toHaveBeenCalledWith('revision')
    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-2'])
  })

  it('resets version fields when the selected job changes and creates a version', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(bootstrapPayload)
    loadQuoteJobVersions
      .mockResolvedValueOnce(job1VersionsPayload)
      .mockResolvedValueOnce(job2VersionsPayload)
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

    expect(result.current.create.versionName).toBe('')
    expect(result.current.create.versionKind).toBe('standard')

    act(() => {
      result.current.actions.setVersionName('  Garage Custom  ')
      result.current.actions.setVersionKind('split')
    })

    await act(async () => {
      await result.current.actions.create()
    })

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
      jobCounts: jobCountsPayload,
      jobs: [],
    })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    await act(async () => {
      await result.current.actions.create()
    })

    expect(createQuoteVersion).not.toHaveBeenCalled()
    expect(result.current.feedback.title).toBe('Quote action failed')
    expect(result.current.feedback.details).toEqual([
      'Select a job before creating a version.',
    ])
  })

  it('refreshes bootstrap data and selected-job versions after delete', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(bootstrapPayload)
      .mockResolvedValueOnce(refreshedBootstrapPayload)
    loadQuoteJobVersions
      .mockResolvedValueOnce(job1VersionsPayload)
      .mockResolvedValueOnce(refreshedJob1VersionsPayload)
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
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
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

  it('keeps selected-job browsing independent from capped search results', async () => {
    const largeJobVersionsPayload = {
      job_id: 'job-1',
      total_versions: 201,
      items: Array.from({ length: 201 }, (_, index) => ({
        estimate_id: `estimate-${index + 1}`,
        job_id: 'job-1',
        customer_id: 'customer-1',
        version_name: `Version ${index + 1}`,
        version_state: index < 100 ? 'draft' : 'live',
        version_kind: 'standard',
        version_sort_order: index + 1,
        job_title: 'Kitchen',
        customer_name: 'Alice',
        final_total: 1000 + index,
        updated_at: `2026-04-21T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
        created_at: `2026-04-20T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
        is_sent_estimate: true,
      })),
    }

    loadQuoteHomeBootstrap.mockResolvedValue(refreshedBootstrapPayload)
    loadQuoteJobVersions.mockResolvedValue(largeJobVersionsPayload)
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'version',
      items: largeJobVersionsPayload.items.slice(0, 8).map((item) => ({
        estimate_id: item.estimate_id,
        job_id: item.job_id,
        customer_id: item.customer_id,
        version_name: item.version_name,
        version_state: item.version_state,
        version_kind: item.version_kind,
        job_title: item.job_title,
        customer_name: item.customer_name,
        updated_at: item.updated_at,
        final_total: item.final_total,
        is_sent_estimate: item.is_sent_estimate,
      })),
    })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items).toHaveLength(201)
    })

    act(() => {
      result.current.actions.setSearchQuery('version')
    })

    await waitFor(
      () => {
        expect(result.current.header.searchResults).toHaveLength(8)
      },
      { timeout: 1500 }
    )

    expect(result.current.versionList.items).toHaveLength(201)
    expect(result.current.selectedJob.stats).toEqual([
      { label: 'Customer', value: 'Alice' },
      { label: 'Job Status', value: 'Estimate Pending' },
      { label: 'Versions', value: '201' },
    ])
  })

  it('surfaces search errors separately from bootstrap data and retries search independently', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(bootstrapPayload)
    loadQuoteJobVersions.mockResolvedValue(job1VersionsPayload)
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
        expect(
          result.current.header.searchResults.map((estimate) => estimate.id)
        ).toEqual(['estimate-2'])
      },
      { timeout: 1500 }
    )

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
    expect(loadQuoteHomeSearch).toHaveBeenCalledTimes(2)
    expect(result.current.header.searchErrorMessage).toBeNull()
  })

  it('keeps version-load failures separate from bootstrap failures', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(bootstrapPayload)
    loadQuoteJobVersions.mockRejectedValue(new Error('versions failed'))

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    expect(result.current.feedback.title).toBe('Quote home loaded with errors')
    expect(result.current.feedback.details).toContain(
      'Job versions failed to load. versions failed'
    )
    expect(result.current.header.searchErrorMessage).toBeNull()
  })

  it('surfaces bootstrap failures from the page feedback layer', async () => {
    loadQuoteHomeBootstrap.mockRejectedValue(new Error('bootstrap failed'))

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    expect(result.current.feedback.title).toBe('Quote home bootstrap failed to load')
    expect(result.current.feedback.details).toEqual([
      'Quote home failed to load. bootstrap failed',
    ])
    expect(result.current.jobList.emptyState).toBe('no_jobs')
  })

  it('page refresh retries bootstrap and versions without rerunning search', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(bootstrapPayload)
      .mockResolvedValueOnce(refreshedBootstrapPayload)
    loadQuoteJobVersions
      .mockResolvedValueOnce(job1VersionsPayload)
      .mockResolvedValueOnce(refreshedJob1VersionsPayload)
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
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
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
      jobCounts: { items: [] },
      jobs: [],
    })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    expect(result.current.jobList.emptyState).toBe('no_jobs')
    expect(result.current.selectedJob.title).toBeNull()
    expect(result.current.versionList.items).toEqual([])
    expect(result.current.create.canCreate).toBe(false)
  })
})
