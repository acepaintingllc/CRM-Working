import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makePagedQuoteHomeVersions,
  makeQuoteHomeVersion,
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
    items: [{ ...quoteHomeJobs[0], version_count: 201 }, quoteHomeJobs[1]],
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

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })

  return { promise, resolve, reject }
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
    loadQuoteJobVersions.mockReset()
    loadQuoteHomeSearch.mockResolvedValue({ query: '', items: [] })
  })

  it('hydrates the first load from SSR bootstrap data without client bootstrap work', () => {
    const { result } = renderHook(() => useQuotesHomePage(quoteHomeBootstrap))

    expect(result.current.loading).toBe(false)
    expect(result.current.header.heroSummaryText).toBe(
      '3 total versions · 1 drafts · 1 sent/awaiting · 1 live'
    )
    expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')
    expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
      'estimate-2',
      'estimate-1',
    ])
    expect(loadQuoteHomeBootstrap).not.toHaveBeenCalled()
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
  })

  it('fetches bootstrap data on first load when SSR data is unavailable', async () => {
    const bootstrap = deferred<typeof quoteHomeBootstrap>()
    loadQuoteHomeBootstrap.mockReturnValueOnce(bootstrap.promise)

    const { result } = renderHook(() => useQuotesHomePage())

    expect(result.current.loading).toBe(true)
    expect(result.current.jobList.loading).toBe(true)
    expect(result.current.create.canCreate).toBe(false)
    expect(result.current.summaryCards.map((card) => card.displayValue)).toEqual([
      '...',
      '...',
      '...',
      '...',
    ])

    bootstrap.resolve(quoteHomeBootstrap)

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

  it('uses the bootstrap-selected job on first client load even when it is not first', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue({
      ...quoteHomeBootstrap,
      selected_job_id: 'job-2',
      selected_job_versions: quoteHomeJob2Versions,
    })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.jobList.selectedJobId).toBe('job-2')
    })

    expect(result.current.selectedJob.title).toBe('Garage')
    expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
      'estimate-3',
    ])
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
  })

  it('keeps the selected job stable when a jobs query changes the visible jobs', async () => {
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

    act(() => {
      result.current.actions.setJobQuery('')
    })

    await waitFor(() => {
      expect(result.current.jobList.items.map((job) => job.id)).toEqual(['job-1', 'job-2'])
    })

    expect(result.current.jobList.selectedJobId).toBe('job-1')
    expect(result.current.selectedJob.title).toBe('Kitchen')
  })

  it('selects a job, resets the create form, and loads that job versions', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)
    loadQuoteJobVersions.mockResolvedValue(quoteHomeJob2Versions)

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    act(() => {
      result.current.actions.setVersionName('  Kitchen Revision  ')
      result.current.actions.setVersionKind('revision')
      result.current.actions.setSelectedJobId('job-2')
    })

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-3',
      ])
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-2')
    expect(result.current.selectedJob.title).toBe('Garage')
    expect(result.current.create.versionName).toBe('')
    expect(result.current.create.versionKind).toBe('standard')
    expect(result.current.versionList.heading).toBe('1 version under this job')
  })

  it('surfaces a version load failure separately and retries the selected job versions', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue({
      ...quoteHomeBootstrap,
      selected_job_versions: null,
    })
    loadQuoteJobVersions
      .mockRejectedValueOnce(new Error('versions failed'))
      .mockResolvedValueOnce(quoteHomeJob1Versions)

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.errorMessage).toBe('versions failed')
    })

    expect(result.current.feedback).toBeNull()
    expect(result.current.versionList.canRetry).toBe(true)
    expect(result.current.versionList.items).toEqual([])

    await act(async () => {
      const ok = await result.current.actions.retryVersions()
      expect(ok).toBe(true)
    })

    await waitFor(() => {
      expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
        'estimate-2',
        'estimate-1',
      ])
    })

    expect(result.current.versionList.errorMessage).toBeNull()
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
    expect(loadQuoteJobVersions).toHaveBeenLastCalledWith('job-1')
  })

  it('loads additional selected-job version pages and preserves the current page when pagination fails', async () => {
    const firstPage = makePagedQuoteHomeVersions({
      count: 25,
      totalVersions: 30,
      nextCursor: 'cursor-2',
    })
    loadQuoteHomeBootstrap.mockResolvedValue({
      ...quoteHomeBootstrap,
      selected_job_versions: firstPage,
    })
    loadQuoteJobVersions
      .mockRejectedValueOnce(new Error('next page failed'))
      .mockResolvedValueOnce({
        ...firstPage,
        next_cursor: null,
        items: Array.from({ length: 5 }, (_, index) =>
          makeQuoteHomeVersion(`estimate-${index + 26}`, {
            version_name: `Version ${index + 26}`,
            version_sort_order: 5 - index,
          })
        ),
      })

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.versionList.items).toHaveLength(25)
    })

    await act(async () => {
      const ok = await result.current.actions.loadMoreVersions()
      expect(ok).toBe(false)
    })

    expect(result.current.versionList.items).toHaveLength(25)
    expect(result.current.versionList.errorMessage).toBe('next page failed')
    expect(result.current.versionList.canRetry).toBe(true)
    expect(result.current.versionList.hasMore).toBe(true)

    await act(async () => {
      const ok = await result.current.actions.loadMoreVersions()
      expect(ok).toBe(true)
    })

    expect(loadQuoteJobVersions).toHaveBeenLastCalledWith('job-1', {
      cursor: 'cursor-2',
    })
    expect(result.current.versionList.items).toHaveLength(30)
    expect(result.current.versionList.errorMessage).toBeNull()
  })

  it('deletes a version, refreshes home resources, and refreshes active versions', async () => {
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
      const ok = await result.current.actions.confirmDelete()
      expect(ok).toBe(true)
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(2)
    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1')
    expect(result.current.dialogs.delete.estimateId).toBeNull()
    expect(result.current.versionList.items.map((estimate) => estimate.id)).toEqual([
      'estimate-2',
    ])
    expect(result.current.header.heroSummaryText).toBe(
      '202 total versions · 0 drafts · 1 sent/awaiting · 1 live'
    )
  })

  it('surfaces delete failures without closing the dialog or refreshing home data', async () => {
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
      const ok = await result.current.actions.confirmDelete()
      expect(ok).toBe(false)
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(loadQuoteHomeBootstrap).toHaveBeenCalledTimes(1)
    expect(result.current.dialogs.delete.estimateId).toBe('estimate-1')
    expect(result.current.feedback).toMatchObject({
      title: 'Quote action failed',
      details: ['delete failed'],
    })
  })

  it('keeps delete success explicit when follow-up refresh partially fails', async () => {
    loadQuoteHomeBootstrap
      .mockResolvedValueOnce(quoteHomeBootstrap)
      .mockRejectedValueOnce(new Error('bootstrap refresh failed'))
    loadQuoteJobVersions.mockRejectedValueOnce(new Error('versions refresh failed'))
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
      const ok = await result.current.actions.confirmDelete()
      expect(ok).toBe(true)
    })

    expect(result.current.dialogs.delete.estimateId).toBeNull()
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

  it('preserves create form input when version creation fails', async () => {
    loadQuoteHomeBootstrap.mockResolvedValue(quoteHomeBootstrap)
    createQuoteVersion.mockRejectedValueOnce(new Error('create failed'))

    const { result } = renderHook(() => useQuotesHomePage())

    await waitFor(() => {
      expect(result.current.create.canCreate).toBe(true)
    })

    act(() => {
      result.current.actions.setVersionName('  Custom Revision  ')
      result.current.actions.setVersionKind('revision')
    })

    await act(async () => {
      const created = await result.current.actions.create()
      expect(created).toBeNull()
    })

    expect(createQuoteVersion).toHaveBeenCalledWith({
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'revision',
      version_name: 'Custom Revision',
    })
    expect(push).not.toHaveBeenCalled()
    expect(result.current.create.versionName).toBe('  Custom Revision  ')
    expect(result.current.create.versionKind).toBe('revision')
    expect(result.current.feedback).toMatchObject({
      title: 'Quote action failed',
      details: ['create failed'],
    })
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
})
