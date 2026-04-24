import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuoteHomePageController } from '../quoteHomePageController'

const versionItem = {
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
} as const

const bootstrapWithActiveVersions = {
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
    next_cursor: null,
    items: [],
  },
  selected_job_id: 'job-1',
  selected_job_versions: {
    job_id: 'job-1',
    total_versions: 1,
    limit: 25,
    next_cursor: null,
    items: [versionItem],
  },
}

function buildController() {
  const homeAttemptRefresh = vi.fn<
    (options?: {
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => Promise<{ ok: boolean; error: string | null; data: typeof bootstrapWithActiveVersions | null }>
  >(async () => ({ ok: true, error: null, data: bootstrapWithActiveVersions }))
  const versionsAttemptRefresh = vi.fn<
    (options?: {
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => Promise<{ ok: boolean; error: string | null }>
  >(async () => ({ ok: true, error: null }))
  const homeResource = {
    attemptRefresh: homeAttemptRefresh,
  }
  const versions = {
    pageData: bootstrapWithActiveVersions.selected_job_versions,
    items: [versionItem],
    refresh: vi.fn(async () => true),
    attemptRefresh: versionsAttemptRefresh,
  }
  const deleteController = {
    requestDeleteVersion: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDeleteVersion: vi.fn(async () => true),
  }
  const stateActions = {
    setSearchQuery: vi.fn(),
    setSearchFocused: vi.fn(),
    setJobQuery: vi.fn(),
    setSelectedJobId: vi.fn(),
  }
  const loadMoreJobs = vi.fn(async () => undefined)
  const workflowActions = {
    setVersionName: vi.fn(),
    setVersionKind: vi.fn(),
    create: vi.fn(async () => ({ id: 'estimate-created' })),
    loadMoreVersions: vi.fn(async () => true),
  }
  const retrySearch = vi.fn()

  const hook = renderHook(() =>
    useQuoteHomePageController({
      homeResource,
      versions,
      deleteController,
      stateActions,
      loadMoreJobs,
      workflowActions,
      retrySearch,
    })
  )

  return {
    ...hook,
    homeResource,
    versions,
    deleteController,
    stateActions,
    loadMoreJobs,
    workflowActions,
    retrySearch,
  }
}

describe('useQuoteHomePageController', () => {
  it('keeps action references stable when dependencies are unchanged', () => {
    const { result, rerender } = buildController()
    const actions = result.current.actions

    rerender()

    expect(result.current.actions).toBe(actions)
    expect(result.current.actions.refresh).toBe(actions.refresh)
    expect(result.current.actions.requestDelete).toBe(actions.requestDelete)
    expect(result.current.actions.cancelDelete).toBe(actions.cancelDelete)
    expect(result.current.actions.confirmDelete).toBe(actions.confirmDelete)
  })

  it('wires public page actions to their owning hook actions', async () => {
    const {
      result,
      stateActions,
      loadMoreJobs,
      workflowActions,
      retrySearch,
      deleteController,
    } = buildController()

    act(() => {
      result.current.actions.setSearchQuery('revision')
      result.current.actions.setSearchFocused(true)
      result.current.actions.setJobQuery('garage')
      result.current.actions.setSelectedJobId('job-2')
      result.current.actions.setVersionName('Custom')
      result.current.actions.setVersionKind('revision')
      result.current.actions.retrySearch()
      result.current.actions.cancelDelete()
    })

    await act(async () => {
      await result.current.actions.loadMore()
      await result.current.actions.create()
      await result.current.actions.loadMoreVersions()
    })

    expect(stateActions.setSearchQuery).toHaveBeenCalledWith('revision')
    expect(stateActions.setSearchFocused).toHaveBeenCalledWith(true)
    expect(stateActions.setJobQuery).toHaveBeenCalledWith('garage')
    expect(stateActions.setSelectedJobId).toHaveBeenCalledWith('job-2')
    expect(loadMoreJobs).toHaveBeenCalledTimes(1)
    expect(workflowActions.setVersionName).toHaveBeenCalledWith('Custom')
    expect(workflowActions.setVersionKind).toHaveBeenCalledWith('revision')
    expect(workflowActions.create).toHaveBeenCalledTimes(1)
    expect(workflowActions.loadMoreVersions).toHaveBeenCalledTimes(1)
    expect(retrySearch).toHaveBeenCalledTimes(1)
    expect(deleteController.cancelDelete).toHaveBeenCalledTimes(1)
  })

  it('requests delete for the matching version item', () => {
    const { result, deleteController } = buildController()

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    expect(deleteController.requestDeleteVersion).toHaveBeenCalledWith(versionItem)
    expect(result.current.actionWarning).toBeNull()
  })

  it('does not refresh when delete confirmation fails', async () => {
    const { result, deleteController, homeResource, versions } = buildController()
    deleteController.confirmDeleteVersion.mockResolvedValue(false)

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(false)
    })

    expect(homeResource.attemptRefresh).not.toHaveBeenCalled()
    expect(versions.attemptRefresh).not.toHaveBeenCalled()
    expect(result.current.actionWarning).toBeNull()
  })

  it('skips manual versions refresh when bootstrap includes the active job versions', async () => {
    const { result, homeResource, versions } = buildController()

    await act(async () => {
      expect(await result.current.actions.refresh()).toBe(true)
    })

    expect(homeResource.attemptRefresh).toHaveBeenCalledTimes(1)
    expect(versions.refresh).not.toHaveBeenCalled()
  })

  it('does not trigger versions refresh when manual bootstrap refresh fails', async () => {
    const { result, homeResource, versions } = buildController()
    homeResource.attemptRefresh.mockResolvedValue({
      ok: false,
      error: 'bootstrap refresh failed',
      data: null,
    })

    await act(async () => {
      expect(await result.current.actions.refresh()).toBe(false)
    })

    expect(homeResource.attemptRefresh).toHaveBeenCalledTimes(1)
    expect(versions.refresh).not.toHaveBeenCalled()
  })

  it('skips delete follow-up versions refresh when bootstrap includes the active job versions', async () => {
    const { result, homeResource, versions } = buildController()
    homeResource.attemptRefresh.mockResolvedValue({
      ok: true,
      error: null,
      data: bootstrapWithActiveVersions,
    })

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(true)
    })

    expect(homeResource.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(versions.attemptRefresh).not.toHaveBeenCalled()
    expect(result.current.actionWarning).toBeNull()
  })

  it('keeps delete success explicit when follow-up refresh fails', async () => {
    const { result, homeResource, versions } = buildController()
    homeResource.attemptRefresh.mockResolvedValue({
      ok: false,
      error: 'bootstrap refresh failed',
      data: null,
    })
    versions.attemptRefresh.mockResolvedValue({
      ok: false,
      error: 'versions refresh failed',
    })

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(true)
    })

    expect(homeResource.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(versions.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(result.current.actionWarning).toEqual({
      source: 'delete',
      message:
        'Quote deleted, but follow-up refresh failed. Reload the page if the quote still appears. Home refresh failed. bootstrap refresh failed Versions refresh failed. versions refresh failed',
    })
  })

  it('clears prior warnings when running a manual refresh', async () => {
    const { result, homeResource, versions } = buildController()
    homeResource.attemptRefresh.mockResolvedValueOnce({
      ok: false,
      error: 'bootstrap refresh failed',
      data: null,
    }).mockResolvedValue({
      ok: true,
      error: null,
      data: bootstrapWithActiveVersions,
    })

    await act(async () => {
      await result.current.actions.confirmDelete()
    })

    expect(result.current.actionWarning).toBeTruthy()

    await act(async () => {
      expect(await result.current.actions.refresh()).toBe(true)
    })

    expect(homeResource.attemptRefresh).toHaveBeenCalledTimes(2)
    expect(versions.refresh).not.toHaveBeenCalled()
    expect(result.current.actionWarning).toBeNull()
  })
})
