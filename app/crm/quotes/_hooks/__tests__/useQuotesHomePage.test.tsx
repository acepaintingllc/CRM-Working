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
  loadQuoteHome,
} = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  deleteQuoteVersion: vi.fn(),
  loadQuoteHome: vi.fn(),
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
  loadQuoteHome,
}))

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList,
}))

const homePayload = {
  summary: {
    draft_count: 1,
    sent_or_awaiting_count: 1,
    live_count: 1,
    pipeline_total: 1800,
  },
  total_versions: 3,
  version_counts_by_job: {
    'job-1': 2,
    'job-2': 1,
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
    total_versions: 3,
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

const refreshedHomePayload = {
  summary: {
    draft_count: 0,
    sent_or_awaiting_count: 1,
    live_count: 1,
    pipeline_total: 1300,
  },
  total_versions: 202,
  version_counts_by_job: {
    'job-1': 201,
    'job-2': 1,
  },
  recent_estimates: [
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
  ],
  snapshot: {
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
    total_versions: 202,
  },
  search_estimates: [
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
  ],
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
    push.mockReset()
    createQuoteVersion.mockReset()
    deleteQuoteVersion.mockReset()
    loadQuoteHome.mockReset()
    fetchJobList.mockReset()
  })

  it('loads home data, filters eligible jobs, and derives search and selection state', async () => {
    loadQuoteHome.mockResolvedValue(homePayload)
    fetchJobList.mockResolvedValue(jobsPayload)

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedbackVm.loading).toBe(false)
    })

    expect(result.current.jobListVm.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.jobListVm.selectedJobId).toBe('job-1')
    expect(result.current.selectedJobVm.title).toBe('Kitchen')
    expect(result.current.versionListVm.items.map((estimate) => estimate.id)).toEqual([
      'estimate-2',
      'estimate-1',
    ])

    act(() => {
      result.current.actions.setSearchQuery('revision')
      result.current.actions.setJobQuery('garage')
    })

    expect(result.current.headerVm.searchResults.map((estimate) => estimate.id)).toEqual(['estimate-2'])
    expect(result.current.jobListVm.items.map((job) => job.id)).toEqual(['job-2'])
  })

  it('resets version fields when the selected job changes and creates a version', async () => {
    loadQuoteHome.mockResolvedValue(homePayload)
    fetchJobList.mockResolvedValue(jobsPayload)
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedbackVm.loading).toBe(false)
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
    loadQuoteHome.mockResolvedValue(homePayload)
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

  it('optimistically removes a deleted version and recomputes summary data', async () => {
    loadQuoteHome.mockResolvedValueOnce(homePayload).mockResolvedValueOnce(refreshedHomePayload)
    fetchJobList.mockResolvedValue(jobsPayload)
    deleteQuoteVersion.mockResolvedValue({ data: { ok: true } })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.feedbackVm.loading).toBe(false)
    })

    act(() => {
      result.current.actions.requestDeleteVersion(homePayload.search_estimates[0])
    })

    await act(async () => {
      await result.current.actions.confirmDeleteVersion()
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(loadQuoteHome).toHaveBeenCalledTimes(2)
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
})
