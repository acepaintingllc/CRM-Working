import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteJobVersions } from '../useQuoteJobVersions'

const { loadQuoteJobVersions } = vi.hoisted(() => ({
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  loadQuoteJobVersions,
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

const versionPayload = {
  job_id: 'job-1',
  total_versions: 2,
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
      updated_at: '2026-04-21T10:00:00.000Z',
      created_at: '2026-04-20T10:00:00.000Z',
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
      updated_at: '2026-04-22T10:00:00.000Z',
      created_at: '2026-04-21T10:00:00.000Z',
      is_sent_estimate: true,
    },
  ],
}

describe('useQuoteJobVersions', () => {
  beforeEach(() => {
    loadQuoteJobVersions.mockReset()
  })

  it('uses cached data until a forced refresh is requested', async () => {
    loadQuoteJobVersions.mockResolvedValue(versionPayload)

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)

    await act(async () => {
      await result.current.refresh()
    })

    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(3)
  })

  it('ignores stale responses when the selected job changes quickly', async () => {
    const first = deferred<typeof versionPayload>()
    const second = deferred<typeof versionPayload>()

    loadQuoteJobVersions
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() =>
        second.promise.then(() => ({
          ...versionPayload,
          job_id: 'job-2',
          items: versionPayload.items.map((item) => ({
            ...item,
            estimate_id: `${item.estimate_id}-job-2`,
            job_id: 'job-2',
            job_title: 'Garage',
          })),
        }))
      )

    const { result, rerender } = renderHook(({ jobId }) => useQuoteJobVersions(jobId), {
      initialProps: { jobId: 'job-1' },
    })

    rerender({ jobId: 'job-2' })

    second.resolve(versionPayload)

    await waitFor(() => {
      expect(result.current.data.job_id).toBe('job-2')
    })

    first.resolve(versionPayload)

    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.data.job_id).toBe('job-2')
    expect(result.current.items.every((item) => item.job_id === 'job-2')).toBe(true)
  })

  it('clears stale version items immediately when switching to a different uncached job', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce(versionPayload)
      .mockResolvedValueOnce({
        job_id: 'job-2',
        total_versions: 0,
        limit: 25,
        next_cursor: null,
        items: [],
      })

    const { result, rerender } = renderHook(({ jobId }) => useQuoteJobVersions(jobId), {
      initialProps: { jobId: 'job-1' },
    })

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
    })

    rerender({ jobId: 'job-2' })

    expect(result.current.data.job_id).toBe('job-2')
    expect(result.current.items).toEqual([])
  })

  it('keeps the last good version list when a forced refresh fails', async () => {
    loadQuoteJobVersions
      .mockResolvedValueOnce(versionPayload)
      .mockRejectedValueOnce(new Error('refresh failed'))

    const { result } = renderHook(() => useQuoteJobVersions('job-1'))

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2)
    })

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.error).toBe('refresh failed')
  })

  it('uses seeded selected-job versions before issuing a fetch', async () => {
    const seededPayload = {
      ...versionPayload,
      items: [versionPayload.items[0]],
      total_versions: 1,
    }

    const { result } = renderHook(() =>
      useQuoteJobVersions('job-1', {
        initialData: seededPayload,
      })
    )

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1)
    })

    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
  })
})
