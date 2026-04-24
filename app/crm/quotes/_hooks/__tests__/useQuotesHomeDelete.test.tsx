import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { type QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { useQuotesHomeDelete } from '../useQuotesHomeDelete'

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
  it('starts in an explicit idle delete state', () => {
    const { result } = renderHook(() => useQuotesHomeDelete())

    expect(result.current).toMatchObject({
      status: 'idle',
      confirmingDelete: null,
      deletingId: null,
      error: null,
      canCancel: true,
      canConfirm: false,
    })
  })

  it('sets confirmingDelete to the requested estimate and clears any prior error', async () => {
    const failedEstimate = makeEstimate('estimate-1')
    const nextEstimate = makeEstimate('estimate-2', {
      version_name: 'Version B',
      version_sort_order: 2,
    })
    const { result } = renderHook(() => useQuotesHomeDelete())

    act(() => {
      result.current.requestDeleteVersion(failedEstimate)
    })

    act(() => {
      result.current.beginDelete()
      result.current.failDelete('delete failed')
    })

    expect(result.current.error).toBe('delete failed')

    act(() => {
      result.current.requestDeleteVersion(nextEstimate)
    })

    expect(result.current.confirmingDelete).toBe(nextEstimate)
    expect(result.current.error).toBeNull()
    expect(result.current.status).toBe('confirming')
    expect(result.current.canConfirm).toBe(true)
  })

  it('clears confirmingDelete when cancelDelete runs without a delete in flight', () => {
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())
    let canceled = false

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    expect(result.current.confirmingDelete).toBe(estimate)

    act(() => {
      canceled = result.current.cancelDelete()
    })

    expect(canceled).toBe(true)
    expect(result.current.confirmingDelete).toBeNull()
    expect(result.current.status).toBe('idle')
  })

  it('clears a failed delete error when cancelDelete runs without a delete in flight', async () => {
    const failedEstimate = makeEstimate('estimate-1')
    const nextEstimate = makeEstimate('estimate-2')
    const { result } = renderHook(() => useQuotesHomeDelete())

    act(() => {
      result.current.requestDeleteVersion(failedEstimate)
    })

    act(() => {
      result.current.beginDelete()
      result.current.failDelete('delete failed')
    })

    expect(result.current.error).toBe('delete failed')

    act(() => {
      result.current.cancelDelete()
      result.current.requestDeleteVersion(nextEstimate)
    })

    expect(result.current.confirmingDelete).toBe(nextEstimate)
    expect(result.current.error).toBeNull()
  })

  it('blocks cancelDelete while a delete is in flight', async () => {
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())
    let canceled = true

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    act(() => {
      result.current.beginDelete()
    })

    expect(result.current.deletingId).toBe('estimate-1')
    expect(result.current.status).toBe('deleting')
    expect(result.current.canCancel).toBe(false)

    act(() => {
      canceled = result.current.cancelDelete()
    })

    expect(canceled).toBe(false)
    expect(result.current.confirmingDelete).toBe(estimate)
    expect(result.current.status).toBe('deleting')
  })

  it('returns null from beginDelete when there is no confirmed estimate', async () => {
    const { result } = renderHook(() => useQuotesHomeDelete())
    let estimate: QuoteHomeJobVersionItemReadModel | null = makeEstimate('estimate-1')

    act(() => {
      estimate = result.current.beginDelete()
    })

    expect(estimate).toBeNull()
    expect(result.current.confirmingDelete).toBeNull()
    expect(result.current.deletingId).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.status).toBe('idle')
  })

  it('returns null from beginDelete while a delete is in flight', async () => {
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())
    let secondBeginResult: QuoteHomeJobVersionItemReadModel | null = estimate

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    act(() => {
      result.current.beginDelete()
    })

    expect(result.current.deletingId).toBe('estimate-1')

    act(() => {
      secondBeginResult = result.current.beginDelete()
    })

    expect(secondBeginResult).toBeNull()
    expect(result.current.status).toBe('deleting')
  })

  it('returns the confirmed estimate from beginDelete and clears delete state on completeDelete', async () => {
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())
    let deletingEstimate: QuoteHomeJobVersionItemReadModel | null = null

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    act(() => {
      deletingEstimate = result.current.beginDelete()
    })

    expect(deletingEstimate).toBe(estimate)
    expect(result.current.deletingId).toBe('estimate-1')
    expect(result.current.status).toBe('deleting')

    act(() => {
      result.current.completeDelete()
    })

    expect(result.current.confirmingDelete).toBeNull()
    expect(result.current.deletingId).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.status).toBe('idle')
  })

  it('surfaces delete failures and clears deletingId', () => {
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())

    act(() => {
      result.current.requestDeleteVersion(estimate)
    })

    act(() => {
      result.current.beginDelete()
      result.current.failDelete('delete failed')
    })

    expect(result.current.error).toBe('delete failed')
    expect(result.current.confirmingDelete).toBe(estimate)
    expect(result.current.deletingId).toBeNull()
    expect(result.current.status).toBe('failed')
    expect(result.current.canConfirm).toBe(true)
  })

  it('allows a failed delete to be retried for the same estimate', () => {
    const estimate = makeEstimate('estimate-1')
    const { result } = renderHook(() => useQuotesHomeDelete())
    let retryEstimate: QuoteHomeJobVersionItemReadModel | null = null

    act(() => {
      result.current.requestDeleteVersion(estimate)
      result.current.beginDelete()
      result.current.failDelete('delete failed')
    })

    act(() => {
      retryEstimate = result.current.beginDelete()
    })

    expect(retryEstimate).toBe(estimate)
    expect(result.current.status).toBe('deleting')
    expect(result.current.deletingId).toBe('estimate-1')
  })
})
