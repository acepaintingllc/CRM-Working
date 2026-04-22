import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useQuoteVersionCreation } from '../useQuoteVersionCreation'

const { push } = vi.hoisted(() => ({
  push: vi.fn(),
}))

const { createQuoteVersion } = vi.hoisted(() => ({
  createQuoteVersion: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/lib/quotes/client', () => ({
  createQuoteVersion,
}))

describe('useQuoteVersionCreation', () => {
  beforeEach(() => {
    push.mockReset()
    createQuoteVersion.mockReset()
  })

  it('creates a quote version and routes to the workspace', async () => {
    createQuoteVersion.mockResolvedValue({ id: 'estimate-99' })

    const { result } = renderHook(() =>
      useQuoteVersionCreation({
        id: 'job-1',
        customer_id: 'customer-1',
      })
    )

    act(() => {
      result.current.setVersionName('  Garage Custom  ')
      result.current.setVersionKind('split')
    })

    await act(async () => {
      await result.current.createVersion()
    })

    expect(createQuoteVersion).toHaveBeenCalledWith({
      job_id: 'job-1',
      customer_id: 'customer-1',
      version_kind: 'split',
      version_name: 'Garage Custom',
    })
    expect(push).toHaveBeenCalledWith('/crm/quotes/estimate-99')
  })

  it('surfaces the shared required-job error when no job is selected', async () => {
    const { result } = renderHook(() => useQuoteVersionCreation(null))

    await act(async () => {
      await result.current.createVersion()
    })

    expect(createQuoteVersion).not.toHaveBeenCalled()
    expect(result.current.error).toBe('Select a job before creating a version.')
  })

  it('resets the draft fields when the selected job changes', async () => {
    const firstJob = { id: 'job-1', customer_id: 'customer-1' }
    const nextJob = { id: 'job-2', customer_id: 'customer-2' }

    const { result, rerender } = renderHook(({ selectedJob }) => useQuoteVersionCreation(selectedJob), {
      initialProps: { selectedJob: firstJob },
    })

    act(() => {
      result.current.setVersionName('Custom')
      result.current.setVersionKind('revision')
    })

    rerender({ selectedJob: nextJob })

    await waitFor(() => {
      expect(result.current.versionName).toBe('')
      expect(result.current.versionKind).toBe('standard')
      expect(result.current.error).toBeNull()
    })
  })
})
