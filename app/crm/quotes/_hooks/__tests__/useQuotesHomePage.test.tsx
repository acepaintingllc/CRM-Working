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
  loadQuoteHomeJobCounts,
  loadQuoteHomeSearch,
  loadQuoteHomeSummary,
  loadQuoteJobVersions,
} = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  deleteQuoteVersion: vi.fn(),
  loadQuoteHomeJobCounts: vi.fn(),
  loadQuoteHomeSearch: vi.fn(),
  loadQuoteHomeSummary: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
}))

const { fetchJobList } = vi.hoisted(() => ({
  fetchJobList: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  deleteQuoteVersion,
  loadQuoteHomeJobCounts,
  loadQuoteHomeSearch,
  loadQuoteHomeSummary,
  loadQuoteJobVersions,
}))

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList,
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

const refreshedJob1VersionsPayload = {
  job_id: 'job-1',
  total_versions: 1,
  items: [job1VersionsPayload.items[0]],
}

const jobsPayload = [
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

describe('useQuotesHomePage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    push.mockReset()
    createQuoteVersion.mockReset()
    deleteQuoteVersion.mockReset()
    loadQuoteHomeJobCounts.mockReset()
    loadQuoteHomeSearch.mockReset()
    loadQuoteHomeSummary.mockReset()
    loadQuoteJobVersions.mockReset()
    fetchJobList.mockReset()
    loadQuoteHomeSearch.mockResolvedValue({
      query: '',
      items: [],
    })
  })

  it('loads split home data, selected-job versions, and server-driven search state', async () => {
    loadQuoteHomeSummary.mockResolvedValue(summaryPayload)
    loadQuoteHomeJobCounts.mockResolvedValue(jobCountsPayload)
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
    fetchJobList.mockResolvedValue(jobsPayload)

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionListVm.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    expect(result.current.jobListVm.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.jobListVm.selectedJobId).toBe('job-1')
    expect(result.current.selectedJobVm.title).toBe('Kitchen')

    act(() => {
      result.current.actions.setSearchQuery('revision')
      result.current.actions.setJobQuery('garage')
    })

    await waitFor(
      () => {
        expect(result.current.headerVm.searchResults.map((estimate) => estimate.id)).toEqual([
          'estimate-2',
        ])
      },
      { timeout: 1500 }
    )

    expect(loadQuoteHomeSearch).toHaveBeenCalledWith('revision')
    expect(result.current.jobListVm.items.map((job) => job.id)).toEqual(['job-2'])
  })

  it('resets version fields when the selected job changes and creates a version', async () => {
    loadQuoteHomeSummary.mockResolvedValue(summaryPayload)
    loadQuoteHomeJobCounts.mockResolvedValue(jobCountsPayload)
    loadQuoteJobVersions
      .mockResolvedValueOnce(job1VersionsPayload)
      .mockResolvedValueOnce(job2VersionsPayload)
    fetchJobList.mockResolvedValue(jobsPayload)
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionListVm.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    act(() => {
      result.current.actions.setVersionName('  Custom Revision  ')
      result.current.actions.setVersionKind('revision')
      result.current.actions.setSelectedJobId('job-2')
    })

    expect(result.current.createVm.versionName).toBe('')
    expect(result.current.createVm.versionKind).toBe('standard')

    act(() => {
      result.current.actions.setVersionName('  Garage Custom  ')
      result.current.actions.setVersionKind('split')
    })

    await act(async () => {
      await result.current.actions.createVersion()
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
    loadQuoteHomeSummary.mockResolvedValue(summaryPayload)
    loadQuoteHomeJobCounts.mockResolvedValue(jobCountsPayload)
    fetchJobList.mockResolvedValue([
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
    ])

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedbackVm.loading).toBe(false)
    })

    await act(async () => {
      await result.current.actions.createVersion()
    })

    expect(createQuoteVersion).not.toHaveBeenCalled()
    expect(result.current.feedbackVm.error).toBe('Select a job before creating a version.')
  })

  it('refreshes summary, counts, and selected-job versions after delete', async () => {
    loadQuoteHomeSummary
      .mockResolvedValueOnce(summaryPayload)
      .mockResolvedValueOnce(refreshedSummaryPayload)
    loadQuoteHomeJobCounts
      .mockResolvedValueOnce(jobCountsPayload)
      .mockResolvedValueOnce(refreshedJobCountsPayload)
    loadQuoteJobVersions
      .mockResolvedValueOnce(job1VersionsPayload)
      .mockResolvedValueOnce(refreshedJob1VersionsPayload)
    fetchJobList.mockResolvedValue(jobsPayload)
    deleteQuoteVersion.mockResolvedValue({ data: { ok: true } })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionListVm.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    act(() => {
      result.current.actions.requestDeleteVersion('estimate-1')
    })

    await act(async () => {
      await result.current.actions.confirmDeleteVersion()
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(loadQuoteHomeSummary).toHaveBeenCalledTimes(2)
    expect(loadQuoteHomeJobCounts).toHaveBeenCalledTimes(2)
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
    expect(result.current.deleteDialogVm.estimateId).toBeNull()
    expect(result.current.versionListVm.items.map((estimate) => estimate.id)).toEqual(['estimate-2'])
    expect(result.current.summaryCards[0].value).toBe('0')
    expect(result.current.summaryCards[1].value).toBe('1')
    expect(result.current.summaryCards[2].value).toBe('1')
    expect(result.current.summaryCards[3].value).toBe('$1,300')
    expect(result.current.headerVm.heroSummaryText).toBe(
      '202 total versions · 0 drafts · 1 sent/awaiting · 1 live'
    )
    expect(result.current.selectedJobVm.stats).toEqual([
      { label: 'Customer', value: 'Alice' },
      { label: 'Job Status', value: 'Estimate Pending' },
      { label: 'Versions', value: '201' },
    ])
  })

  it('keeps selected-job browsing independent from the capped search results and recent activity', async () => {
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

    loadQuoteHomeSummary.mockResolvedValue(refreshedSummaryPayload)
    loadQuoteHomeJobCounts.mockResolvedValue(refreshedJobCountsPayload)
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
    fetchJobList.mockResolvedValue(jobsPayload)

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionListVm.items).toHaveLength(201)
    })

    act(() => {
      result.current.actions.setSearchQuery('version')
    })

    await waitFor(
      () => {
        expect(result.current.headerVm.searchResults).toHaveLength(8)
      },
      { timeout: 1500 }
    )

    expect(result.current.versionListVm.items).toHaveLength(201)
    expect(result.current.selectedJobVm.stats).toEqual([
      { label: 'Customer', value: 'Alice' },
      { label: 'Job Status', value: 'Estimate Pending' },
      { label: 'Versions', value: '201' },
    ])
  })

  it('keeps home usable when job counts fail but summary and jobs load', async () => {
    loadQuoteHomeSummary.mockResolvedValue(summaryPayload)
    loadQuoteHomeJobCounts.mockRejectedValue(new Error('counts failed'))
    loadQuoteJobVersions.mockResolvedValue(job1VersionsPayload)
    fetchJobList.mockResolvedValue(jobsPayload)

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionListVm.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    expect(result.current.summaryCards[0].value).toBe('1')
    expect(result.current.feedbackVm.error).toBe('counts failed')
    expect(result.current.jobListVm.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
  })

  it('preserves empty states when there are no eligible jobs or quote versions', async () => {
    loadQuoteHomeSummary.mockResolvedValue({
      total_versions: 0,
      draft_count: 0,
      sent_or_awaiting_count: 0,
      live_count: 0,
      pipeline_total: 0,
    })
    loadQuoteHomeJobCounts.mockResolvedValue({ items: [] })
    fetchJobList.mockResolvedValue([
      {
        id: 'job-x',
        customer_id: null,
        customer_name: null,
        customer_address: null,
        title: 'Lead only',
        description: null,
        status: 'lead',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        completed_at: null,
      },
    ])

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedbackVm.loading).toBe(false)
    })

    expect(result.current.jobListVm.emptyState).toBe('no_jobs')
    expect(result.current.selectedJobVm.title).toBeNull()
    expect(result.current.versionListVm.items).toEqual([])
    expect(result.current.createVm.canCreate).toBe(false)
  })
})
