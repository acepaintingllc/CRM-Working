import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteCreatePage } from '../useQuoteCreatePage'

const { push, getSearchParam } = vi.hoisted(() => ({
  push: vi.fn(),
  getSearchParam: vi.fn(),
}))

const { createQuoteVersion, loadQuoteCreateJobContext, loadQuoteJobVersions } = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
  loadQuoteCreateJobContext: vi.fn(),
  loadQuoteJobVersions: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: getSearchParam }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
  loadQuoteCreateJobContext,
  loadQuoteJobVersions,
}))

describe('useQuoteCreatePage', () => {
  beforeEach(() => {
    push.mockReset()
    getSearchParam.mockReset()
    createQuoteVersion.mockReset()
    loadQuoteCreateJobContext.mockReset()
    loadQuoteJobVersions.mockReset()
  })

  it('stays idle when no job query param is present', async () => {
    getSearchParam.mockReturnValue(null)

    const { result } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    expect(loadQuoteCreateJobContext).not.toHaveBeenCalled()
    expect(loadQuoteJobVersions).not.toHaveBeenCalled()
    expect(result.current.feedback.shouldLoadJobData).toBe(false)
    expect(result.current.job.title).toBe('Unknown job')
    expect(result.current.create.canCreate).toBe(false)
  })

  it('keeps the load error ahead of the required-job create error', async () => {
    getSearchParam.mockReturnValue('job-1')
    loadQuoteCreateJobContext.mockRejectedValue(new Error('Load failed'))
    loadQuoteJobVersions.mockRejectedValue(new Error('Load failed'))

    const { result } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
      expect(result.current.feedback.pageBanner?.message).toBe('Load failed')
    })

    await act(async () => {
      await result.current.actions.create()
    })

    expect(result.current.feedback.pageBanner?.message).toBe('Load failed')
    expect(createQuoteVersion).not.toHaveBeenCalled()
  })

  it('loads job data only for the requested job param and enables creation for eligible jobs', async () => {
    getSearchParam.mockReturnValue('job-1')
    loadQuoteCreateJobContext.mockResolvedValue({
      job: {
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        title: 'Kitchen',
        eligibility: { eligible: true, reason: 'eligible' },
      },
    })
    loadQuoteJobVersions.mockResolvedValue({
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

    const { result } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    expect(loadQuoteCreateJobContext).toHaveBeenCalledWith('job-1')
    expect(loadQuoteJobVersions).toHaveBeenCalledWith('job-1')
    expect(result.current.job.hasJob).toBe(true)
    expect(result.current.versions.hasVersions).toBe(true)
    expect(result.current.create.canCreate).toBe(true)
  })

  it('represents existing ineligible jobs without treating them as unknown jobs', async () => {
    getSearchParam.mockReturnValue('job-1')
    loadQuoteCreateJobContext.mockResolvedValue({
      job: {
        id: 'job-1',
        customer_id: null,
        customer_name: null,
        customer_address: null,
        title: 'Kitchen',
        eligibility: { eligible: false, reason: 'missing_customer' },
      },
    })
    loadQuoteJobVersions.mockResolvedValue({ job_id: 'job-1', total_versions: 0, items: [] })

    const { result } = renderHook(() => useQuoteCreatePage())

    await waitFor(() => {
      expect(result.current.feedback.loading).toBe(false)
    })

    expect(result.current.job.hasJob).toBe(true)
    expect(result.current.job.isEligible).toBe(false)
    expect(result.current.job.title).toBe('Kitchen')
    expect(result.current.job.customerLine).toBe('No customer assigned')
    expect(result.current.create.canCreate).toBe(false)
  })

  it('resets the draft fields when the selected job changes at the page level', async () => {
    loadQuoteCreateJobContext
      .mockResolvedValueOnce({
        job: {
          id: 'job-1',
          customer_id: 'customer-1',
          customer_name: 'Alice',
          customer_address: '123 Main',
          title: 'Kitchen',
          eligibility: { eligible: true, reason: 'eligible' },
        },
      })
      .mockResolvedValueOnce({
        job: {
          id: 'job-2',
          customer_id: 'customer-2',
          customer_name: 'Bob',
          customer_address: '456 Oak',
          title: 'Garage',
          eligibility: { eligible: true, reason: 'eligible' },
        },
      })
    loadQuoteJobVersions
      .mockResolvedValueOnce({ job_id: 'job-1', total_versions: 0, items: [] })
      .mockResolvedValueOnce({ job_id: 'job-2', total_versions: 0, items: [] })
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
    loadQuoteCreateJobContext.mockResolvedValue({
      job: {
        id: 'job-1',
        customer_id: 'customer-1',
        customer_name: 'Alice',
        customer_address: '123 Main',
        title: 'Kitchen',
        eligibility: { eligible: true, reason: 'eligible' },
      },
    })
    loadQuoteJobVersions
      .mockResolvedValueOnce({ job_id: 'job-1', total_versions: 0, items: [] })
      .mockResolvedValueOnce({
        job_id: 'job-1',
        total_versions: 1,
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
})
