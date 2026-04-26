import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNewJobPage } from '../_hooks/useNewJobPage'

const authedFetch = vi.fn()
const invalidateSwrKey = vi.fn<(key: string) => Promise<unknown>>()
const push = vi.fn()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => authedFetch(input, init),
}))

vi.mock('@/app/crm/_hooks/swrCache', () => ({
  invalidateSwrKey: (key: string) => invalidateSwrKey(key),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('customerId=customer-1'),
}))

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    text: vi.fn(async () => JSON.stringify(payload)),
  }
}

describe('useNewJobPage', () => {
  beforeEach(() => {
    authedFetch.mockReset()
    push.mockReset()
    invalidateSwrKey.mockClear()
  })

  it('loads customers, validates create values, and routes to detail on save', async () => {
    authedFetch
      .mockResolvedValueOnce(
        createResponse({
          data: {
            data: [
              {
                id: 'customer-1',
                name: 'Taylor Jones',
                email: 'taylor@example.com',
                phone: '812-555-0100',
                address: '123 Main St, Newburgh, IN 47630',
              },
            ],
            total: 1,
            page: 1,
            pageSize: 50,
          },
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          data: {
            id: 'customer-1',
            name: 'Taylor Jones',
            email: 'taylor@example.com',
            phone: '812-555-0100',
            address: '123 Main St, Newburgh, IN 47630',
          },
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          data: {
            id: 'job-1',
            customer_id: 'customer-1',
            title: 'Exterior repaint',
            status: 'estimate_scheduled',
          },
        })
      )
      .mockResolvedValueOnce(createResponse({ data: { event: { id: 'calendar-1' } } }))

    const { result } = renderHook(() => useNewJobPage())

    await waitFor(() => expect(result.current.selectedCustomer?.id).toBe('customer-1'))
    expect(authedFetch).toHaveBeenCalledWith('/api/customers?pageSize=3', { cache: 'no-store' })
    expect(authedFetch).toHaveBeenCalledWith('/api/customers/customer-1', { cache: 'no-store' })

    await act(async () => {
      result.current.setValue({
        ...result.current.value,
        title: 'Exterior repaint',
      })
    })

    await act(async () => {
      await result.current.save()
    })

    expect(push).toHaveBeenCalledWith('/crm/jobs/job-1')
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/jobs')
  })
})
