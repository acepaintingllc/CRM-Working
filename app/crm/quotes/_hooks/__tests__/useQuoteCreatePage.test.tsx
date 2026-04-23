import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteCreatePage } from '../useQuoteCreatePage'

const { push, getSearchParam } = vi.hoisted(() => ({
  push: vi.fn(),
  getSearchParam: vi.fn(),
}))

const { fetchJobList, loadJobRecord } = vi.hoisted(() => ({
  fetchJobList: vi.fn(),
  loadJobRecord: vi.fn(),
}))

const { createQuoteVersion, loadQuoteJobVersions } = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: getSearchParam }),
}))

vi.mock('@/lib/jobs/client', () => ({
  fetchJobList,
  loadJobRecord,
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  loadQuoteJobVersions,
}))

describe('useQuoteCreatePage', () => {
  beforeEach(() => {
    push.mockReset()
    getSearchParam.mockReset()
    fetchJobList.mockReset()
    loadJobRecord.mockReset()
    createQuoteVersion.mockReset()
    loadQuoteJobVersions.mockReset()
  })

  it('stays idle when no job query param is present', async () => {
    getSearchParam.mockReturnValue(null)

    const { result } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedbackVm.loading).toBe(false)
    })

    expect(fetchJobList).not.toHaveBeenCalled()
    expect(loadJobRecord).not.toHaveBeenCalled()
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
    expect(result.current.feedbackVm.shouldLoadJobData).toBe(false)
    expect(result.current.selectedJobVm.title).toBe('Unknown job')
    expect(result.current.createVm.canCreate).toBe(false)
  })

  it('keeps the load error ahead of the required-job create error', async () => {
    getSearchParam.mockReturnValue('job-1')
    loadJobRecord.mockRejectedValue(new Error('Load failed'))
    loadQuoteJobVersions.mockRejectedValue(new Error('Load failed'))

    const { result } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedbackVm.loading).toBe(false)
      expect(result.current.feedbackVm.error).toBe('Load failed')
    })

    await act(async () => {
      await result.current.actions.createVersion()
    })

    expect(result.current.feedbackVm.error).toBe('Load failed')
    expect(createQuoteVersion).not.toHaveBeenCalled()
  })
<<<<<<< Updated upstream
=======

  it('loads job data only for the requested job param and enables creation for eligible jobs', async () => {
    getSearchParam.mockReturnValue('job-1')
    loadJobRecord.mockResolvedValue({
      id: 'job-1',
      customer_id: 'customer-1',
      customer_name: 'Alice',
      customer_address: '123 Main',
      customer_email: null,
      customer_phone: null,
      title: 'Kitchen',
      description: null,
      status: 'estimate_pending',
      estimate_date: null,
      estimate_sent_at: null,
      scheduled_date: null,
      scheduled_end_date: null,
      completed_at: null,
      linked_estimate_id: null,
      closeout_notes: null,
      linked_estimates: [],
    })
    loadQuoteJobVersions.mockResolvedValue({
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

    const { result } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    expect(loadJobRecord).toHaveBeenCalledWith('job-1')
    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1', {
      cursor: undefined,
      limit: 25,
    })
    expect(result.current.job.hasJob).toBe(true)
    expect(result.current.versions.hasVersions).toBe(true)
    expect(result.current.create.canCreate).toBe(true)
  })

  it('resets the draft fields when the selected job changes at the page level', async () => {
    loadJobRecord
      .mockResolvedValueOnce({
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        customer_email: null,
        customer_phone: null,
        title: 'Kitchen',
        description: null,
        status: 'estimate_pending',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        scheduled_end_date: null,
        completed_at: null,
        linked_estimate_id: null,
        closeout_notes: null,
        linked_estimates: [],
      })
      .mockResolvedValueOnce({
        id: 'job-2',
        customer_id: 'customer-2',
        customer_name: 'Bob',
        customer_address: '456 Oak',
        customer_email: null,
        customer_phone: null,
        title: 'Garage',
        description: null,
        status: 'estimate_sent',
        estimate_date: null,
        estimate_sent_at: null,
        scheduled_date: null,
        scheduled_end_date: null,
        completed_at: null,
        linked_estimate_id: null,
        closeout_notes: null,
        linked_estimates: [],
      })
    loadQuoteJobVersions
      .mockResolvedValueOnce({ job_id: 'job-1', total_versions: 0, limit: 25, next_cursor: null, items: [] })
      .mockResolvedValueOnce({ job_id: 'job-2', total_versions: 0, limit: 25, next_cursor: null, items: [] })
    getSearchParam.mockReturnValue('job-1')

    const { result, rerender } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
      expect(result.current.job.jobId).toBe('job-1')
    })

    act(() => {
      result.current.actions.setVersionName('Custom')
      result.current.actions.setVersionKind('revision')
    })

    getSearchParam.mockReturnValue('job-2')
    rerender()

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
      expect(result.current.job.jobId).toBe('job-2')
    })

    expect(result.current.create.versionName).toBe('')
    expect(result.current.create.versionKind).toBe('standard')
  })

  it('keeps the draft when the same job reloads through the resource boundary', async () => {
    getSearchParam.mockReturnValue('job-1')
    loadJobRecord.mockResolvedValue({
      id: 'job-1',
      customer_id: 'customer-1',
      customer_name: 'Alice',
      customer_address: '123 Main',
      customer_email: null,
      customer_phone: null,
      title: 'Kitchen',
      description: null,
      status: 'estimate_pending',
      estimate_date: null,
      estimate_sent_at: null,
      scheduled_date: null,
      scheduled_end_date: null,
      completed_at: null,
      linked_estimate_id: null,
      closeout_notes: null,
      linked_estimates: [],
    })
    loadQuoteJobVersions
      .mockResolvedValueOnce({ job_id: 'job-1', total_versions: 0, limit: 25, next_cursor: null, items: [] })
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
            version_name: 'Revision B',
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

    const { result } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    act(() => {
      result.current.actions.setVersionName('Keep me')
      result.current.actions.setVersionKind('revision')
    })

    await act(async () => {
      await result.current.actions.retry()
    })

    await waitFor(() => {
      expect(result.current.versions.items).toHaveLength(1)
    })

    expect(result.current.job.jobId).toBe('job-1')
    expect(result.current.create.versionName).toBe('Keep me')
    expect(result.current.create.versionKind).toBe('revision')
  })
>>>>>>> Stashed changes
})
