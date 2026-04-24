import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makePagedQuoteHomeVersions,
  makeQuoteHomeSearchResult,
  quoteHomeBootstrap,
  quoteHomeEmptyBootstrap,
  quoteHomeJob1Versions,
  quoteHomeJob2Versions,
  quoteHomeJobs,
  quoteHomeJobThree,
  quoteHomeSummary,
} from '@/test-support/quoteHomeFixtures'
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
  loadQuoteJobVersions,
} = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  deleteQuoteVersion: vi.fn(),
  loadQuoteHomeBootstrap: vi.fn(),
  loadQuoteHomeJobs: vi.fn(),
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
  loadQuoteHomeJobs,
  loadQuoteHomeSearch,
  loadQuoteJobVersions,
}))

const refreshedQuoteHomeBootstrap = {
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
        ...quoteHomeJobs[0],
        version_count: 201,
      },
      quoteHomeJobs[1],
    ],
  },
  selected_job_id: 'job-1',
  selected_job_versions: {
    job_id: 'job-1',
    total_versions: 1,
    limit: 25,
    next_cursor: null,
    items: [quoteHomeJob1Versions.items[0]],
  },
}

const refreshedQuoteHomeJob1Versions = {
  job_id: 'job-1',
  total_versions: 1,
  limit: 25,
  next_cursor: null,
  items: [quoteHomeJob1Versions.items[0]],
}

const pagedQuoteHomeJob1Versions = makePagedQuoteHomeVersions({
  count: 25,
  totalVersions: 30,
  nextCursor: 'cursor-2',
})

describe('useQuotesHomePage', () => {
  beforeEach(() => {
    vi.useRealTimers()
    push.mockReset()
    createQuoteVersion.mockReset()
    deleteQuoteVersion.mockReset()
    loadQuoteHomeBootstrap.mockReset()
    loadQuoteHomeJobs.mockReset()
    loadQuoteHomeSearch.mockReset()
    loadQuoteJobVersions.mockReset()
    loadQuoteHomeSearch.mockResolvedValue({
      query: '',
      items: [],
    })
  })

  it('hydrates the first load from SSR bootstrap data without client bootstrap work', async () => {
    const { result } = renderHook(() => useQuotesHomePage(quoteHomeBootstrap))

    expect(result.current.loading).toBe(false)
    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
      'estimate-2',
      'estimate-1',
    ])
    expect(result.current.header.heroSummaryText).toBe(
      '3 total versions \u00B7 1 drafts \u00B7 1 sent/awaiting \u00B7 1 live'
    )
    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
  })

  it('keeps the public facade wired to state, resource, workflow, search, delete, and controller actions', () => {
    loadQuoteHomeJobs.mockResolvedValue({
      query: 'garage',
      limit: 25,
      next_cursor: null,
      items: [quoteHomeJobs[1]],
    })

    const { result } = renderHook(() => useQuotesHomePage(quoteHomeBootstrap))

    expect(Object.keys(result.current.actions).sort()).toEqual([
      'cancelDelete',
      'confirmDelete',
      'create',
      'loadMore',
      'loadMoreVersions',
      'refresh',
      'requestDelete',
      'retryJobs',
      'retrySearch',
      'retryVersions',
      'setJobQuery',
      'setSearchFocused',
      'setSearchQuery',
      'setSelectedJobId',
      'setVersionKind',
      'setVersionName',
    ])

    act(() => {
      result.current.actions.setSearchQuery('revision')
      result.current.actions.setSearchFocused(true)
      result.current.actions.setJobQuery('garage')
      result.current.actions.setVersionName('Revision A')
      result.current.actions.setVersionKind('revision')
      result.current.actions.requestDelete('estimate-1')
    })

    expect(result.current.header.searchQuery).toBe('revision')
    expect(result.current.header.searchFocused).toBe(true)
    expect(result.current.jobList.searchQuery).toBe('garage')
    expect(result.current.create.versionName).toBe('Revision A')
    expect(result.current.create.versionKind).toBe('revision')
    expect(result.current.dialogs.delete.estimateId).toBe('estimate-1')
  })

  it('fetches bootstrap data on first load when SSR data is unavailable', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)

    const { result } = renderHook(() => useQuotesHomePage())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
    expect(result.current.jobList.selectedJobId).toBe('job-1')
  })

  it('uses bootstrap-selected versions without an immediate duplicate fetch and keeps search separate', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })
    loadQuoteHomeJobs.mockResolvedValue({
      query: 'garage',
      limit: 25,
      next_cursor: null,
      items: [quoteHomeJobs[1]],
    })
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'revision',
      items: [makeQuoteHomeSearchResult('estimate-2')],
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
      result.current.actions.setVersionName('  Kitchen Revision  ')
      result.current.actions.setVersionKind('revision')
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
    expect(loadQuoteHomeJobs).toHaveBeenCalledWith({
      query: 'garage',
      limit: 25,
      cursor: undefined,
    })
    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-2'])
    expect(result.current.jobList.items.some((job) => job.isSelected)).toBe(false)
    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')
    expect(result.current.create.versionName).toBe('  Kitchen Revision  ')
    expect(result.current.create.versionKind).toBe('revision')

    await act(async () => {
      await result.current.actions.create()
    })

    expect(createQuoteVersion).toHaveBeenCalledWith({
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'revision',
      version_name: 'Kitchen Revision',
    })
  })

  it('loads additional selected-job version pages beyond the first 25 records', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue({
      ...quoteHomeBootstrap,
      selected_job_versions: pagedQuoteHomeJob1Versions,
    })
    loadQuoteJobVersions.mockResolvedValue({
      ...pagedQuoteHomeJob1Versions,
      next_cursor: null,
      items: Array.from({ length: 5 }, (_, index) => ({
        ...quoteHomeJob1Versions.items[0],
        estimate_id: `estimate-${index + 26}`,
        version_name: `Version ${index + 26}`,
        version_sort_order: 5 - index,
      })),
    })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items).toHaveLength(25)
    })

    expect(result.current.selectedJob.stats).toContainEqual({
      label: 'Versions',
      value: '30',
    })
    expect(result.current.versionList.heading).toBe('30 versions under this job')

    await act(async () => {
      await result.current.actions.loadMoreVersions()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1', {
      cursor: 'cursor-2',
    })
    await waitFor(() => {
      expect(result.current.versionList.items).toHaveLength(30)
    })
    expect(result.current.versionList.heading).toBe('30 versions under this job')
  })

  it('keeps pagination inside the active server query and preserves selected job when filters hide it', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)
    loadQuoteHomeJobs
      .mockResolvedValueOnce({
        query: 'garage',
        limit: 25,
        next_cursor: 'cursor-3',
        items: [quoteHomeJobs[1]],
      })
      .mockResolvedValueOnce({
        query: 'garage',
        limit: 25,
        next_cursor: null,
        items: [quoteHomeJobThree],
      })
      .mockResolvedValueOnce({
        query: 'ga',
        limit: 25,
        next_cursor: null,
        items: [quoteHomeJobs[1], quoteHomeJobThree],
      })
      .mockResolvedValueOnce({
        query: '',
        limit: 25,
        next_cursor: 'cursor-2',
        items: quoteHomeJobs,
      })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    })

    act(() => {
      result.current.actions.setJobQuery('garage')
    })

    await waitFor(() => {
      expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-2'])
    })

    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')
    expect(result.current.jobList.items.some((job) => job.isSelected)).toBe(false)
    expect(result.current.jobList.hasMore).toBe(true)

    await act(async () => {
      await result.current.actions.loadMore()
    })

    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(2, {
      query: 'garage',
      limit: 25,
      cursor: 'cursor-3',
    })
    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-2', 'job-3'])
    expect(result.current.jobList.hasMore).toBe(false)

    act(() => {
      result.current.actions.setJobQuery('ga')
    })

    await waitFor(() => {
      expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-2', 'job-3'])
    })

    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(3, {
      query: 'ga',
      limit: 25,
      cursor: undefined,
    })
    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')
    expect(result.current.jobList.items.some((job) => job.isSelected)).toBe(false)

    act(() => {
      result.current.actions.setJobQuery('')
    })

    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')

    await waitFor(() => {
      expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    })

    expect(loadQuoteHomeJobs).toHaveBeenNthCalledWith(4, {
      query: '',
      limit: 25,
      cursor: undefined,
    })
    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')
  })

  it('loads versions for a newly selected job and creates a version', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)
    loadQuoteJobVersions.mockResolvedValue(quoteHomeJob2Versions)
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
      ...quoteHomeEmptyBootstrap,
      summary: quoteHomeSummary,
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

  it('refreshes active job versions after delete even when bootstrap includes selected versions', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(quoteHomeBootstrap)
      .mockResolvedValueOnce(refreshedQuoteHomeBootstrap)
    loadQuoteJobVersions.mockResolvedValue(refreshedQuoteHomeJob1Versions)
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
    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1')
    expect(result.current.dialogs.delete.estimateId).toBeNull()
    expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
      'estimate-2',
    ])
    expect(result.current.summaryCards[0].value).toBe('0')
    expect(result.current.summaryCards[1].value).toBe('1')
    expect(result.current.summaryCards[2].value).toBe('1')
    expect(result.current.summaryCards[3].value).toBe('$1,300')
    expect(result.current.header.heroSummaryText).toBe(
      '202 total versions \u00B7 0 drafts \u00B7 1 sent/awaiting \u00B7 1 live'
    )
    expect(result.current.selectedJob.stats).toEqual([
      { label: 'Customer', value: 'Alice' },
      { label: 'Job Status', value: 'Estimate Pending' },
      { label: 'Versions', value: '1' },
    ])
    expect(result.current.versionList.heading).toBe('1 version under this job')
  })

  it('surfaces delete failures without refreshing home data', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)
    deleteQuoteVersion.mockRejectedValueOnce(new Error('delete failed'))

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
    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
    expect(result.current.dialogs.delete.estimateId).toBe('estimate-1')
    expect(result.current.feedback).toMatchObject({
      title: 'Quote action failed',
      details: ['delete failed'],
    })
  })

  it('keeps delete success explicit when follow-up refresh fails without local shadow mutation', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(quoteHomeBootstrap)
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
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)
    loadQuoteHomeSearch
      .mockRejectedValueOnce(new Error('search failed'))
      .mockResolvedValueOnce({
        query: 'revision',
        items: [makeQuoteHomeSearchResult('estimate-2')],
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

  it('surfaces empty quote search results without disturbing selected job state', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)
    loadQuoteHomeSearch.mockResolvedValueOnce({
      query: 'missing',
      items: [],
    })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.selectedJob.title).toBe('Kitchen')
    })

    act(() => {
      result.current.actions.setSearchQuery('missing')
    })

    await waitFor(
      () => {
        expect(result.current.header.searchEmptyMessage).toBe(
          'No quote versions match "missing".'
        )
      },
      { timeout: 1500 }
    )

    expect(result.current.header.searchResults).toEqual([])
    expect(result.current.header.searchErrorMessage).toBeNull()
    expect(result.current.selectedJob.title).toBe('Kitchen')
  })

  it('keeps version-load failures separate from bootstrap failures', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue({
      ...quoteHomeBootstrap,
      selected_job_versions: null,
    })
    loadQuoteJobVersions.mockRejectedValue(new Error('versions failed'))

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.feedback).toBeNull()
    expect(result.current.versionList.errorMessage).toBe('versions failed')
    expect(result.current.versionList.canRetry).toBe(true)
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
    expect(result.current.jobList.emptyState).toBe('none')
    expect(result.current.jobList.errorMessage).toBe('bootstrap failed')
    expect(result.current.jobList.canRetry).toBe(true)
  })

  it('page refresh reuses bootstrap-selected versions without rerunning search or duplicate version fetches', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(quoteHomeBootstrap)
      .mockResolvedValueOnce(refreshedQuoteHomeBootstrap)
    loadQuoteJobVersions.mockResolvedValue(refreshedQuoteHomeJob1Versions)
    loadQuoteHomeSearch.mockResolvedValue({
      query: 'revision',
      items: [makeQuoteHomeSearchResult('estimate-2')],
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
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
    expect(loadQuoteHomeSearch).toHaveBeenCalledTimes(1)
  })

  it('preserves empty states when there are no eligible jobs or quote versions', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeEmptyBootstrap)

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.feedback).toBeNull()
    expect(result.current.jobList.emptyState).toBe('no_jobs')
    expect(result.current.jobList.errorMessage).toBeNull()
    expect(result.current.jobList.canRetry).toBe(false)
    expect(result.current.jobList.hasMore).toBe(false)
    expect(result.current.selectedJob.title).toBeNull()
    expect(result.current.versionList.items).toEqual([])
    expect(result.current.create.canCreate).toBe(false)
  })
})

