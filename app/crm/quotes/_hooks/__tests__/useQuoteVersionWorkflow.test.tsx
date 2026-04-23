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
        items: [],
      })
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 1,
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

    await act(async () => {
      await result.current.actions.refresh()
    })

    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(loadQuoteJobVersions).toHaveBeenCalledTimes(2)

    await waitFor(() => {
      expect(result.current.versions.items).toHaveLength(1)
    })
  })
})
