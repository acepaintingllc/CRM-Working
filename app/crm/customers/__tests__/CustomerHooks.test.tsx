import { act, renderHook, waitFor } from '@testing-library/react'
import { mutate as swrMutate } from 'swr'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSWRWrapper } from '@/app/crm/__tests__/swrTestUtils'
import { useCustomerDetail } from '../_hooks/useCustomerDetail'
import { useCustomerList } from '../_hooks/useCustomerList'
import { useCustomerTimeline } from '../_hooks/useCustomerTimeline'

const authedFetch = vi.fn()
const invalidateSwrKey = vi.fn<(key: string) => Promise<unknown>>()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => authedFetch(input, init),
}))

vi.mock('@/app/crm/_hooks/swrCache', () => ({
  invalidateSwrKey: (key: string) => invalidateSwrKey(key),
}))

function createResponse(ok: boolean, payload: unknown, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Server Error',
    text: vi.fn(async () => JSON.stringify(payload)),
  }
}

function createDataResponse(data: unknown) {
  return createResponse(true, { data })
}

function createMutationResponse(data: unknown, notice?: string) {
  return createResponse(true, { data, ...(notice ? { notice } : {}) })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('customer hooks', () => {
  beforeEach(() => {
    authedFetch.mockReset()
    invalidateSwrKey.mockClear()
    invalidateSwrKey.mockImplementation((key: string) => swrMutate(key))
  })

  it('useCustomerDetail ignores stale responses when the id changes', async () => {
    const first = deferred<ReturnType<typeof createResponse>>()
    const second = deferred<ReturnType<typeof createResponse>>()
    authedFetch.mockImplementation((url: string) =>
      url.includes('customer-b') ? second.promise : first.promise
    )

    const { result, rerender } = renderHook(({ id }) => useCustomerDetail(id), {
      initialProps: { id: 'customer-a' as string | undefined },
      wrapper: createSWRWrapper(),
    })

    rerender({ id: 'customer-b' })

    second.resolve(createDataResponse({ id: 'customer-b', name: 'Second' }))
    await waitFor(() => expect(result.current.customer?.id).toBe('customer-b'))

    first.resolve(createDataResponse({ id: 'customer-a', name: 'First' }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.customer?.id).toBe('customer-b')
    expect(result.current.error).toBeNull()
  })

  it('useCustomerDetail reports missing ids as load errors without leaving loading stuck', async () => {
    const { result } = renderHook(() => useCustomerDetail(undefined), {
      wrapper: createSWRWrapper(),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.customer).toBeNull()
    expect(result.current.error).toBe('Missing customer id in URL.')
  })

  it('useCustomerDetail loads, refreshes, and preserves customer data on delete failure', async () => {
    authedFetch
      .mockResolvedValueOnce(createDataResponse({ id: 'customer-1', name: 'Taylor Jones' }))
      .mockResolvedValueOnce(createDataResponse({ id: 'customer-1', name: 'Taylor Updated' }))
      .mockResolvedValueOnce(createResponse(false, { error: 'Delete failed' }))

    const { result } = renderHook(() => useCustomerDetail('customer-1'), {
      wrapper: createSWRWrapper(),
    })

    await waitFor(() => expect(result.current.customer?.name).toBe('Taylor Jones'))

    await act(async () => {
      await result.current.loadCustomer()
    })
    expect(result.current.customer?.name).toBe('Taylor Updated')

    let deleted = false
    await act(async () => {
      deleted = await result.current.deleteCustomer()
    })

    expect(deleted).toBe(false)
    expect(result.current.customer?.name).toBe('Taylor Updated')
    expect(result.current.error).toBe('Delete failed')
  })

  it('useCustomerDetail reports delete success', async () => {
    authedFetch
      .mockResolvedValueOnce(createDataResponse({ id: 'customer-1', name: 'Taylor Jones' }))
      .mockResolvedValueOnce(createMutationResponse(true))

    const { result } = renderHook(() => useCustomerDetail('customer-1'), {
      wrapper: createSWRWrapper(),
    })
    await waitFor(() => expect(result.current.customer?.id).toBe('customer-1'))

    let deleted = false
    await act(async () => {
      deleted = await result.current.deleteCustomer()
    })

    expect(deleted).toBe(true)
    expect(result.current.error).toBeNull()
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/customers')
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/customers/customer-1')
  })

  it('useCustomerList reuses the SWR cache across remounts', async () => {
    authedFetch.mockResolvedValue(createDataResponse([{ id: '1', name: 'First' }]))

    const wrapper = createSWRWrapper()
    const first = renderHook(() => useCustomerList(), { wrapper })
    await waitFor(() => expect(first.result.current.listCustomers[0]?.id).toBe('1'))

    first.unmount()

    const second = renderHook(() => useCustomerList(), { wrapper })
    await waitFor(() => expect(second.result.current.listCustomers[0]?.id).toBe('1'))

    expect(authedFetch).toHaveBeenCalledTimes(1)
  })

  it('useCustomerList surfaces fetch failures and resets the list', async () => {
    authedFetch.mockResolvedValue(createResponse(false, { error: 'List exploded' }))

    const { result } = renderHook(() => useCustomerList(), {
      wrapper: createSWRWrapper(),
    })

    await waitFor(() => expect(result.current.listLoading).toBe(false))
    expect(result.current.listCustomers).toEqual([])
    expect(result.current.listError).toBe('List exploded')
  })

  it('useCustomerTimeline ignores stale responses and surfaces request errors', async () => {
    const first = deferred<ReturnType<typeof createResponse>>()
    const second = deferred<ReturnType<typeof createResponse>>()
    authedFetch.mockImplementation((url: string) =>
      url.includes('customer-b') ? second.promise : first.promise
    )

    const { result, rerender } = renderHook(({ customerId }) => useCustomerTimeline(customerId), {
      initialProps: { customerId: 'customer-a' as string | undefined },
      wrapper: createSWRWrapper(),
    })

    rerender({ customerId: 'customer-b' })

    second.resolve(createResponse(false, { error: 'Timeline exploded' }))
    await waitFor(() => expect(result.current.timelineError).toBe('Timeline exploded'))

    first.resolve(createDataResponse([{ id: 'old', type: 'note', body: 'Old', created_at: null, created_by: null, title: null, link_path: null, link_label: null }]))
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.timelineEvents).toEqual([])
    expect(result.current.timelineError).toBe('Timeline exploded')
  })

  it('useCustomerTimeline loads successfully, saves a note, refreshes, and clears the draft', async () => {
    authedFetch
      .mockResolvedValueOnce(
        createDataResponse([
          {
            id: 'old',
            type: 'note',
            body: 'Old',
            created_at: null,
            created_by: null,
            title: null,
            link_path: null,
            link_label: null,
          },
        ])
      )
      .mockResolvedValueOnce(createMutationResponse({ id: 'new' }))
      .mockResolvedValueOnce(
        createDataResponse([
          {
            id: 'new',
            type: 'note',
            body: 'Fresh',
            created_at: null,
            created_by: null,
            title: null,
            link_path: null,
            link_label: null,
          },
        ])
      )

    const { result } = renderHook(() => useCustomerTimeline('customer-1'), {
      wrapper: createSWRWrapper(),
    })
    await waitFor(() => expect(result.current.timelineEvents[0]?.id).toBe('old'))

    act(() => {
      result.current.setNoteBody(' Fresh ')
    })

    let saved = false
    await act(async () => {
      saved = await result.current.saveNote()
    })

    expect(saved).toBe(true)
    expect(result.current.noteBody).toBe('')
    expect(result.current.timelineError).toBeNull()
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/customers/customer-1/timeline')
  })

  it('useCustomerTimeline preserves the draft on note save failure and short-circuits missing ids', async () => {
    authedFetch
      .mockResolvedValueOnce(createDataResponse([]))
      .mockResolvedValueOnce(createResponse(false, { error: 'Save exploded' }))

    const { result } = renderHook(() => useCustomerTimeline('customer-1'), {
      wrapper: createSWRWrapper(),
    })
    await waitFor(() => expect(result.current.timelineLoading).toBe(false))

    act(() => {
      result.current.setNoteBody('Keep me')
    })

    let saved = false
    await act(async () => {
      saved = await result.current.saveNote()
    })

    expect(saved).toBe(false)
    expect(result.current.noteBody).toBe('Keep me')
    expect(result.current.timelineError).toBe('Save exploded')

    const missing = renderHook(() => useCustomerTimeline(undefined), {
      wrapper: createSWRWrapper(),
    })
    await waitFor(() => expect(missing.result.current.timelineLoading).toBe(false))
    expect(missing.result.current.timelineEvents).toEqual([])
    expect(missing.result.current.timelineError).toBeNull()
  })
})
