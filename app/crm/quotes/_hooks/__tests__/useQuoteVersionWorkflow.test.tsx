import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteVersionWorkflow } from '../useQuoteVersionWorkflow'

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}))

const { createQuoteVersion, loadQuoteJobVersions } = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  loadQuoteJobVersions,
}))

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>['resolve'] = () => undefined
  let reject: Deferred<T>['reject'] = () => undefined
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, resolve, reject }
}

describe('useQuoteVersionWorkflow', () => {
  beforeEach(() => {
    push.mockReset()
    createQuoteVersion.mockReset()
    loadQuoteJobVersions.mockReset()
  })

  it('resets the draft and reloads versions when the job context changes', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 1,
        limit: 25,
        next_cursor: null,
        items: [
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
      })
      .mockResolvedValueOnce({
        job_id: 'job-2',
        total_versions: 0,
        limit: 25,
        next_cursor: null,
        items: [],
      })

    const { result, rerender } = renderHook(
      ({ jobId, selectedJob }) =>
        useQuoteVersionWorkflow({
          jobId,
          selectedJob,
        }),
      {
        initialProps: {
          jobId: 'job-1',
          selectedJob: { id: 'job-1', customer_id: 'customer-1' },
        },
      }
    )

    await waitFor(() => {
      expect(result.current.versions.items).toHaveLength(1)
    })

    act(() => {
      result.current.actions.setVersionName('Custom')
      result.current.actions.setVersionKind('revision')
    })

    rerender({
      jobId: 'job-2',
      selectedJob: { id: 'job-2', customer_id: 'customer-2' },
    })

    expect(result.current.create.versionName).toBe('')
    expect(result.current.create.versionKind).toBe('standard')
    expect(result.current.versions.items).toEqual([])

    await waitFor(() => {
      expect(result.current.versions.data.job_id).toBe('job-2')
    })
  })

  it('preserves the draft when selected job data changes without changing job context', async () => {
    loadQuoteJobVersions.mockResolvedValue({
      job_id: 'job-1',
      total_versions: 0,
      limit: 25,
      next_cursor: null,
      items: [],
    })

    const { result, rerender } = renderHook(
      ({ selectedJob }) =>
        useQuoteVersionWorkflow({
          jobId: 'job-1',
          selectedJob,
        }),
      {
        initialProps: {
          selectedJob: { id: 'job-1', customer_id: 'customer-1' },
        },
      }
    )

    await waitFor(() => {
      expect(result.current.versions.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setVersionName('Keep me')
      result.current.actions.setVersionKind('alternate')
    })

    rerender({
      selectedJob: { id: 'job-1', customer_id: 'customer-1' },
    })

    expect(result.current.create.versionName).toBe('Keep me')
    expect(result.current.create.versionKind).toBe('alternate')
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(1)
  })

  it('uses the shared required-job guard for missing or invalid job context', async () => {
    const { result } = renderHook(() =>
      useQuoteVersionWorkflow({
        jobId: 'job-1',
        selectedJob: null,
      })
    )

    await act(async () => {
      await result.current.actions.create()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1')
    expect(createQuoteVersion).not.toHaveBeenCalled()
    expect(result.current.create.error).toBe('Select a job before creating a version.')
    expect(result.current.create.canCreate).toBe(false)
  })

  it('refreshes both the page context and the selected job versions', async () => {
    const onRefresh = vi.fn().mockResolvedValue(true)
    loadQuoteJobVersions
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 0,
        limit: 25,
        next_cursor: null,
        items: [],
      })
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 1,
        limit: 25,
        next_cursor: null,
        items: [
          {
            estimate_id: 'estimate-2',
            job_id: 'job-1',
            customer_id: 'customer-1',
            version_name: 'Version B',
            version_state: 'draft',
            version_kind: 'revision',
            version_sort_order: 2,
            job_title: 'Kitchen',
            customer_name: 'Alice',
            final_total: 700,
            updated_at: '2026-04-21T10:00:00.000Z',
            created_at: '2026-04-21T09:00:00.000Z',
            is_sent_estimate: false,
          },
        ],
      })

    const { result } = renderHook(() =>
      useQuoteVersionWorkflow({
        jobId: 'job-1',
        selectedJob: { id: 'job-1', customer_id: 'customer-1' },
        onRefresh,
      })
    )

    await waitFor(() => {
      expect(result.current.versions.loading).toBe(false)
    })

    let refreshResult = false
    await act(async () => {
      refreshResult = await result.current.actions.refresh()
    })

    expect(refreshResult).toBe(true)
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)

    await waitFor(() => {
      expect(result.current.versions.items).toHaveLength(1)
    })
  })

  it('calls context and version refreshes in parallel and returns their combined boolean', async () => {
    const onRefreshDeferred = createDeferred<boolean>()
    const versionsRefreshDeferred = createDeferred<{
      job_id: string
      total_versions: number
      limit: number
      next_cursor: null
      items: []
    }>()
    const onRefresh = vi.fn(() => onRefreshDeferred.promise)
    loadQuoteJobVersions
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 0,
        limit: 25,
        next_cursor: null,
        items: [],
      })
      .mockReturnValueOnce(versionsRefreshDeferred.promise)

    const { result } = renderHook(() =>
      useQuoteVersionWorkflow({
        jobId: 'job-1',
        selectedJob: { id: 'job-1', customer_id: 'customer-1' },
        onRefresh,
      })
    )

    await waitFor(() => {
      expect(result.current.versions.loading).toBe(false)
    })

    let refreshPromise: Promise<boolean> | null = null
    act(() => {
      refreshPromise = result.current.actions.refresh()
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
    })

    if (!refreshPromise) throw new Error('Expected refresh to start.')
    const pendingRefresh = refreshPromise

    let refreshResult = true
    await act(async () => {
      onRefreshDeferred.resolve(false)
      versionsRefreshDeferred.resolve({
        job_id: 'job-1',
        total_versions: 0,
        limit: 25,
        next_cursor: null,
        items: [],
      })
      refreshResult = await pendingRefresh
    })

    expect(refreshResult).toBe(false)
  })

  it('returns true from refresh when no page context refresh is provided', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 0,
        limit: 25,
        next_cursor: null,
        items: [],
      })
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 0,
        limit: 25,
        next_cursor: null,
        items: [],
      })

    const { result } = renderHook(() =>
      useQuoteVersionWorkflow({
        jobId: 'job-1',
        selectedJob: { id: 'job-1', customer_id: 'customer-1' },
      })
    )

    await waitFor(() => {
      expect(result.current.versions.loading).toBe(false)
    })

    let refreshResult = false
    await act(async () => {
      refreshResult = await result.current.actions.refresh()
    })

    expect(refreshResult).toBe(true)
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)
  })

  it('loads additional version pages for the selected job', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 30,
        limit: 25,
        next_cursor: 'cursor-2',
        items: Array.from({ length: 25 }, (_, index) => ({
          estimate_id: `estimate-${index + 1}`,
          job_id: 'job-1',
          customer_id: 'customer-1',
          version_name: `Version ${index + 1}`,
          version_state: 'draft',
          version_kind: 'standard',
          version_sort_order: 30 - index,
          job_title: 'Kitchen',
          customer_name: 'Alice',
          final_total: 500,
          updated_at: '2026-04-20T10:00:00.000Z',
          created_at: '2026-04-19T10:00:00.000Z',
          is_sent_estimate: false,
        })),
      })
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 30,
        limit: 25,
        next_cursor: null,
        items: Array.from({ length: 5 }, (_, index) => ({
          estimate_id: `estimate-${index + 26}`,
          job_id: 'job-1',
          customer_id: 'customer-1',
          version_name: `Version ${index + 26}`,
          version_state: 'draft',
          version_kind: 'standard',
          version_sort_order: 5 - index,
          job_title: 'Kitchen',
          customer_name: 'Alice',
          final_total: 500,
          updated_at: '2026-04-20T10:00:00.000Z',
          created_at: '2026-04-19T10:00:00.000Z',
          is_sent_estimate: false,
        })),
      })

    const { result } = renderHook(() =>
      useQuoteVersionWorkflow({
        jobId: 'job-1',
        selectedJob: { id: 'job-1', customer_id: 'customer-1' },
      })
    )

    await waitFor(() => {
      expect(result.current.versions.items).toHaveLength(25)
    })

    expect(result.current.versions.pageData.total_versions).toBe(30)
    expect(result.current.versions.hasMore).toBe(true)

    await act(async () => {
      await result.current.actions.loadMoreVersions()
    })

    expect(loadQuoteJobVersions).toHaveBeenNthCalledWith(1, 'job-1')
    expect(loadQuoteJobVersions).toHaveBeenNthCalledWith(2, 'job-1', {
      cursor: 'cursor-2',
    })
    expect(result.current.versions.items).toHaveLength(30)
    expect(result.current.versions.hasMore).toBe(false)
  })
})
