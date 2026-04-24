import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { useQuotesHomeDelete } from '../useQuotesHomeDelete'

const { deleteQuoteVersion } = vi.hoisted(() => ({
  deleteQuoteVersion: vi.fn(),
}))

vi.mock('@/lib/quotes/client', () => ({
  deleteQuoteVersion,
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

function makeEstimate(
  estimateId: string,
  overrides: Partial<QuoteHomeJobVersionItemReadModel> = {}
): QuoteHomeJobVersionItemReadModel {
  return {
    estimate_id: estimateId,
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
    ...overrides,
  }
}

describe('useQuotesHomeDelete', () => {
  beforeEach(() => {
    deleteQuoteVersion.mockReset()
  })

  it('sets confirmingDelete to the requested estimate and clears any prior error', async () => {
    deleteQuoteVersion.mockRejectedValueOnce(new Error('delete failed'))
    const failedEstimate = makeEstimate('estimate-1')
    const nextEstimate = makeEstimate('estimate-2', {
      version_name: 'Version B',
      version_sort_order: 2,
    })
    const { result } = renderHook(() => useQuotesHomeDelete())

    act(() => {
      result.current.requestDeleteVersion(failedEstimate)
    })

    await act(async () => {
      await result.current.confirmDeleteVersion()
    })

    expect(result.current.error).toBe('delete failed')

    act(() => {
      result.current.requestDeleteVersion(nextEstimate)
    })

    expect(result.current.confirmingDelete).toBe(nextEstimate)
    expect(result.current.error).toBeNull()
  })

  it('clears confirmingDelete when cancelDelete runs without a deletion in flight', () => {
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    expect(result.current.confirmingDelete).toBe(estimate)

    act(() => {
      result.current.cancelDelete()
    })

    expect(result.current.confirmingDelete).toBeNull()
  })

  it('clears a failed delete error when cancelDelete runs without a deletion in flight', async () => {
    deleteQuoteVersion.mockRejectedValueOnce(new Error('delete failed'))
    const failedEstimate = makeEstimate('estimate-1')
    const nextEstimate = makeEstimate('estimate-2')
    const { result } = renderHook(() => useQuotesHomeDelete())

    act(() => {
      result.current.requestDeleteVersion(failedEstimate)
    })

    await act(async () => {
      await result.current.confirmDeleteVersion()
    })

    expect(result.current.error).toBe('delete failed')

    act(() => {
      result.current.cancelDelete()
      result.current.requestDeleteVersion(nextEstimate)
    })

    expect(result.current.confirmingDelete).toBe(nextEstimate)
    expect(result.current.error).toBeNull()
  })

  it('does nothing when cancelDelete runs while a deletion is in flight', async () => {
    const pendingDelete = deferred<{ data: { ok: boolean } }>()
    deleteQuoteVersion.mockReturnValueOnce(pendingDelete.promise)
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    let confirmPromise!: Promise<boolean>
    await act(async () => {
      confirmPromise = result.current.confirmDeleteVersion()
      await Promise.resolve()
    })

    expect(result.current.deletingId).toBe('estimate-1')

    act(() => {
      result.current.cancelDelete()
    })

    expect(result.current.confirmingDelete).toBe(estimate)

    await act(async () => {
      pendingDelete.resolve({ data: { ok: true } })
      await confirmPromise
    })
  })

  it('returns false without deleting when confirmDeleteVersion has no confirmed estimate', async () => {
    const { result } = renderHook(() => useQuotesHomeDelete())
    let deleted = true

    await act(async () => {
      deleted = await result.current.confirmDeleteVersion()
    })

    expect(deleted).toBe(false)
    expect(deleteQuoteVersion).not.toHaveBeenCalled()
    expect(result.current.confirmingDelete).toBeNull()
    expect(result.current.deletingId).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('returns false without deleting again when confirmDeleteVersion runs while a deletion is in flight', async () => {
    const pendingDelete = deferred<{ data: { ok: boolean } }>()
    deleteQuoteVersion.mockReturnValueOnce(pendingDelete.promise)
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    let firstConfirmPromise!: Promise<boolean>
    await act(async () => {
      firstConfirmPromise = result.current.confirmDeleteVersion()
      await Promise.resolve()
    })

    expect(result.current.deletingId).toBe('estimate-1')

    let secondConfirmResult = true
    await act(async () => {
      secondConfirmResult = await result.current.confirmDeleteVersion()
    })

    expect(secondConfirmResult).toBe(false)
    expect(deleteQuoteVersion).toHaveBeenCalledTimes(1)

    await act(async () => {
      pendingDelete.resolve({ data: { ok: true } })
      await firstConfirmPromise
    })
  })

  it('deletes the confirmed estimate and clears delete state on success', async () => {
    deleteQuoteVersion.mockResolvedValueOnce({ data: { ok: true } })
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())
    let deleted = false

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    await act(async () => {
      deleted = await result.current.confirmDeleteVersion()
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(deleted).toBe(true)
    expect(result.current.confirmingDelete).toBeNull()
    expect(result.current.deletingId).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('surfaces delete failures and clears deletingId', async () => {
    deleteQuoteVersion.mockRejectedValueOnce(new Error('delete failed'))
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())
    let deleted = true

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    await act(async () => {
      deleted = await result.current.confirmDeleteVersion()
    })

    expect(deleteQuoteVersion).toHaveBeenCalledWith('estimate-1')
    expect(deleted).toBe(false)
    expect(result.current.error).toBe('delete failed')
    expect(result.current.deletingId).toBeNull()
  })
})
