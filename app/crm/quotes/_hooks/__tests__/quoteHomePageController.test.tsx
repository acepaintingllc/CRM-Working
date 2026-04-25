import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobVersionItemReadModel,
  QuoteJobVersionsPageReadModel,
} from '@/lib/quotes/collectionData'
import { useQuoteHomePageController } from '../quoteHomePageController'

const { deleteQuoteVersion } = vi.hoisted(() => ({
  deleteQuoteVersion: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  deleteQuoteVersion,
}))

function makeVersionItem(
  estimateId: string,
  jobId: string,
  overrides: Partial<QuoteHomeJobVersionItemReadModel> = {}
): QuoteHomeJobVersionItemReadModel {
  return {
    estimate_id: estimateId,
    job_id: jobId,
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
    ...overrides,
  }
}

function makeVersionsPage(
  jobId: string,
  items: QuoteHomeJobVersionItemReadModel[]
): QuoteJobVersionsPageReadModel {
  return {
    job_id: jobId,
    total_versions: items.length,
    limit: 25,
    next_cursor: null,
    items,
  }
}

const versionItem = makeVersionItem('estimate-1', 'job-1')
const nonBootstrapVersionItem = makeVersionItem('estimate-2', 'job-2', {
  customer_id: 'customer-2',
  job_title: 'Garage',
  customer_name: 'Bob',
  version_name: 'Version B',
  version_sort_order: 1,
})

const bootstrapWithActiveVersions: QuoteHomeBootstrapReadModel = {
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
  selected_job_versions: makeVersionsPage('job-1', [versionItem]),
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

function buildController(
  overrides: {
    bootstrapData?: QuoteHomeBootstrapReadModel
    versionsPageData?: QuoteJobVersionsPageReadModel
    versionItems?: QuoteHomeJobVersionItemReadModel[]
  } = {}
) {
  const bootstrapData = overrides.bootstrapData ?? bootstrapWithActiveVersions
  const versionsPageData =
    overrides.versionsPageData ?? bootstrapWithActiveVersions.selected_job_versions!
  const versionItems = overrides.versionItems ?? versionsPageData.items
  const homeAttemptRefresh = vi.fn<
    (options?: {
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => Promise<{ ok: boolean; error: string | null; data: QuoteHomeBootstrapReadModel | null }>
  >(async () => ({ ok: true, error: null, data: bootstrapData }))
  const versionsAttemptRefresh = vi.fn<
    (options?: {
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => Promise<{ ok: boolean; error: string | null }>
  >(async () => ({ ok: true, error: null }))
  const homeResource = {
    attemptRefresh: homeAttemptRefresh,
    retryJobs: vi.fn(async () => true),
    loadMore: vi.fn(async () => undefined),
  }
  const versions = {
    pageData: versionsPageData,
    items: versionItems,
    loadMore: vi.fn(async () => true),
    refresh: vi.fn(async () => true),
    attemptRefresh: versionsAttemptRefresh,
  }
  const stateActions = {
    setSearchQuery: vi.fn(),
    setSearchFocused: vi.fn(),
    setJobQuery: vi.fn(),
    setSelectedJobId: vi.fn(),
  }
  const create = {
    setVersionName: vi.fn(),
    setVersionKind: vi.fn(),
    createVersion: vi.fn(async () => ({ id: 'estimate-created' })),
  }
  const search = {
    retry: vi.fn(),
  }

  const hook = renderHook(() =>
    useQuoteHomePageController({
      homeResource,
      versions,
      create,
      search,
      stateActions,
    })
  )

  return {
    ...hook,
    homeResource,
    versions,
    create,
    stateActions,
    search,
  }
}

describe('useQuoteHomePageController', () => {
  beforeEach(() => {
    deleteQuoteVersion.mockReset()
    deleteQuoteVersion.mockResolvedValue({ data: { ok: true } })
  })

  it('keeps action references stable when dependencies are unchanged', () => {
    const { result, rerender } = buildController()
    const actions = result.current.actions

    rerender()

    expect(result.current.actions).toBe(actions)
    expect(result.current.actions.refresh).toBe(actions.refresh)
    expect(result.current.actions.requestDelete).toBe(actions.requestDelete)
    expect(result.current.actions.cancelDelete).toBe(actions.cancelDelete)
    expect(result.current.actions.confirmDelete).toBe(actions.confirmDelete)
    expect(result.current.actions.retryJobs).toBe(actions.retryJobs)
    expect(result.current.actions.retryVersions).toBe(actions.retryVersions)
  })

  it('wires public page actions to their owning hook actions', async () => {
    const {
      result,
      stateActions,
      homeResource,
      versions,
      create,
      search,
    } = buildController()

    act(() => {
      result.current.actions.setSearchQuery('revision')
      result.current.actions.setSearchFocused(true)
      result.current.actions.setJobQuery('garage')
      result.current.actions.setSelectedJobId('job-2')
      result.current.actions.setVersionName('Custom')
      result.current.actions.setVersionKind('revision')
      result.current.actions.retrySearch()
      result.current.actions.requestDelete('estimate-1')
      result.current.actions.cancelDelete()
    })

    await act(async () => {
      await result.current.actions.loadMore()
      await result.current.actions.create()
      await result.current.actions.loadMoreVersions()
      await result.current.actions.retryJobs()
      await result.current.actions.retryVersions()
    })

    expect(stateActions.setSearchQuery).toHaveBeenCalledWith('revision')
    expect(stateActions.setSearchFocused).toHaveBeenCalledWith(true)
    expect(stateActions.setJobQuery).toHaveBeenCalledWith('garage')
    expect(stateActions.setSelectedJobId).toHaveBeenCalledWith('job-2')
    expect(homeResource.loadMore).toHaveBeenCalledTimes(1)
    expect(create.setVersionName).toHaveBeenCalledWith('Custom')
    expect(create.setVersionKind).toHaveBeenCalledWith('revision')
    expect(create.createVersion).toHaveBeenCalledTimes(1)
    expect(versions.loadMore).toHaveBeenCalledTimes(1)
    expect(homeResource.retryJobs).toHaveBeenCalledTimes(1)
    expect(versions.refresh).toHaveBeenCalledTimes(1)
    expect(search.retry).toHaveBeenCalledTimes(1)
    expect(result.current.deleteState.status).toBe('idle')
  })

  it('requests delete for the matching version item', () => {
    const { result } = buildController()

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    expect(result.current.deleteState).toMatchObject({
      status: 'confirming',
      confirmingDelete: versionItem,
      deletingId: null,
      error: null,
      canCancel: true,
      canConfirm: true,
    })
    expect(result.current.actionWarning).toBeNull()
  })

  it('keeps jobs and versions retry actions scoped to their failed resources', async () => {
    const { result, homeResource, versions, search } = buildController()

    await act(async () => {
      await result.current.actions.retryJobs()
      await result.current.actions.retryVersions()
    })

    expect(homeResource.retryJobs).toHaveBeenCalledTimes(1)
    expect(versions.refresh).toHaveBeenCalledTimes(1)
    expect(homeResource.attemptRefresh).not.toHaveBeenCalled()
    expect(versions.attemptRefresh).not.toHaveBeenCalled()
    expect(search.retry).not.toHaveBeenCalled()
  })

  it('does not refresh when there is no confirmed delete target', async () => {
    const { result, homeResource, versions } = buildController()

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(false)
    })

    expect(deleteQuoteVersion).not.toHaveBeenCalled()
    expect(homeResource.attemptRefresh).not.toHaveBeenCalled()
    expect(versions.attemptRefresh).not.toHaveBeenCalled()
    expect(result.current.actionWarning).toBeNull()
  })

  it('surfaces delete mutation failures without refreshing', async () => {
    const { result, homeResource, versions } = buildController()
    deleteQuoteVersion.mockRejectedValueOnce(new Error('delete failed'))

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(false)
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(homeResource.attemptRefresh).not.toHaveBeenCalled()
    expect(versions.attemptRefresh).not.toHaveBeenCalled()
    expect(result.current.deleteState).toMatchObject({
      status: 'failed',
      confirmingDelete: versionItem,
      deletingId: null,
      error: 'delete failed',
      canCancel: true,
      canConfirm: true,
    })
    expect(result.current.actionWarning).toBeNull()
  })

  it('retries a failed delete from the preserved confirmation dialog', async () => {
    const { result, homeResource, versions } = buildController()
    deleteQuoteVersion
      .mockRejectedValueOnce(new Error('delete failed'))
      .mockResolvedValueOnce({ data: { ok: true } })

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(false)
    })

    expect(result.current.deleteState.status).toBe('failed')

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(true)
    })

    expect(deleteQuoteVersion).toHaveBeenCalledTimes(2)
    expect(deleteQuoteVersion).toHaveBeenNthCalledWith(2, 'estimate-1')
    expect(homeResource.attemptRefresh).toHaveBeenCalledTimes(1)
    expect(versions.attemptRefresh).toHaveBeenCalledTimes(1)
    expect(result.current.deleteState.status).toBe('idle')
  })

  it('does not confirm the same delete twice while the mutation is in flight', async () => {
    const pendingDelete = deferred<{ data: { ok: boolean } }>()
    const { result } = buildController()
    deleteQuoteVersion.mockReturnValueOnce(pendingDelete.promise)

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    let firstConfirm!: Promise<boolean>
    let secondConfirm!: Promise<boolean>
    await act(async () => {
      firstConfirm = result.current.actions.confirmDelete()
      secondConfirm = result.current.actions.confirmDelete()
      await Promise.resolve()
    })

    expect(deleteQuoteVersion).toHaveBeenCalledTimes(1)
    expect(result.current.deleteState).toMatchObject({
      status: 'deleting',
      deletingId: 'estimate-1',
      canCancel: false,
      canConfirm: false,
    })
    await expect(secondConfirm).resolves.toBe(false)

    pendingDelete.resolve({ data: { ok: true } })

    await act(async () => {
      await firstConfirm
    })

    await expect(firstConfirm).resolves.toBe(true)
    expect(result.current.deleteState.status).toBe('idle')
  })

  it('blocks cancel while a delete mutation is in flight', async () => {
    const pendingDelete = deferred<{ data: { ok: boolean } }>()
    const { result } = buildController()
    deleteQuoteVersion.mockReturnValueOnce(pendingDelete.promise)

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    let confirm!: Promise<boolean>
    await act(async () => {
      confirm = result.current.actions.confirmDelete()
      await Promise.resolve()
    })

    act(() => {
      result.current.actions.cancelDelete()
    })

    expect(result.current.deleteState).toMatchObject({
      status: 'deleting',
      confirmingDelete: versionItem,
      deletingId: 'estimate-1',
    })

    pendingDelete.resolve({ data: { ok: true } })

    await act(async () => {
      await confirm
    })
  })

  it('refreshes home data then active job versions after deleting a bootstrap-selected job version', async () => {
    const { result, homeResource, versions } = buildController()

    act(() => {
      result.current.actions.requestDelete('estimate-1')
    })

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(true)
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(homeResource.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(versions.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(homeResource.attemptRefresh.mock.invocationCallOrder[0]).toBeLessThan(
      versions.attemptRefresh.mock.invocationCallOrder[0]
    )
    expect(result.current.deleteState.status).toBe('idle')
    expect(result.current.actionWarning).toBeNull()
  })

  it('refreshes home data then active job versions after deleting a non-bootstrap selected job version', async () => {
    const activeVersionsPage = makeVersionsPage('job-2', [nonBootstrapVersionItem])
    const { result, homeResource, versions } = buildController({
      versionsPageData: activeVersionsPage,
      versionItems: activeVersionsPage.items,
    })

    act(() => {
      result.current.actions.requestDelete('estimate-2')
    })

    await act(async () => {
      expect(await result.current.actions.confirmDelete()).toBe(true)
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-2')
    expect(homeResource.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(versions.attemptRefresh).toHaveBeenCalledWith({
      preserveDataOnError: true,
      reportError: false,
    })
    expect(homeResource.attemptRefresh.mock.invocationCallOrder[0]).toBeLessThan(
      versions.attemptRefresh.mock.invocationCallOrder[0]
    )
    expect(result.current.deleteState.status).toBe('idle')
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

  it('does not rely on bootstrap-selected versions as delete follow-up refresh coverage', async () => {
    const { result, homeResource, versions } = buildController()
    homeResource.attemptRefresh.mockResolvedValue({
      ok: true,
      error: null,
      data: bootstrapWithActiveVersions,
    })

    act(() => {
      result.current.actions.requestDelete('estimate-1')
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

    act(() => {
      result.current.actions.requestDelete('estimate-1')
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

  it('warns clearly when only the versions refresh fails after a successful delete', async () => {
    const { result, homeResource, versions } = buildController()
    versions.attemptRefresh.mockResolvedValue({
      ok: false,
      error: 'versions refresh failed',
    })

    act(() => {
      result.current.actions.requestDelete('estimate-1')
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
    expect(result.current.deleteState.status).toBe('idle')
    expect(result.current.actionWarning).toEqual({
      source: 'delete',
      message:
        'Quote deleted, but follow-up refresh failed. Reload the page if the quote still appears. Versions refresh failed. versions refresh failed',
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

    act(() => {
      result.current.actions.requestDelete('estimate-1')
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
