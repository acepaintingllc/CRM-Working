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
})
