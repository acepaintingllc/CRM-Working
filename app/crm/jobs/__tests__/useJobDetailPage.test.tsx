import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useJobDetailPage } from '../_hooks/useJobDetailPage'

const authedFetch = vi.fn()
const replace = vi.fn()
const writeText = vi.fn()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    text: vi.fn(async () => JSON.stringify(payload)),
  }
}

describe('useJobDetailPage', () => {
  beforeEach(() => {
    authedFetch.mockReset()
    replace.mockReset()
    writeText.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('loads the job resource, supports copy notices, and deletes through the shared detail action helper', async () => {
    authedFetch
      .mockResolvedValueOnce(
        createResponse({
          data: {
            id: 'job-1',
            customer_id: 'customer-1',
            customer_name: 'Taylor Jones',
            customer_address: '123 Main St, Newburgh, IN 47630',
            customer_email: 'taylor@example.com',
            customer_phone: '812-555-0100',
            title: 'Exterior repaint',
            description: 'Front and back porch',
            status: 'estimate_scheduled',
            estimate_date: '2026-04-23T13:00:00.000Z',
            estimate_sent_at: null,
            scheduled_date: null,
            scheduled_end_date: null,
            completed_at: null,
          },
        })
      )
      .mockResolvedValueOnce(createResponse({ error: 'No matching estimate in Drive folder' }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: { ok: true } }))

    const { result } = renderHook(() => useJobDetailPage())

    await waitFor(() => expect(result.current.job?.id).toBe('job-1'))

    await act(async () => {
      await result.current.copy('Email', 'taylor@example.com')
    })
    expect(result.current.notice).toBe('Email copied')

    await act(async () => {
      await result.current.deleteJob()
    })
    expect(replace).toHaveBeenCalledWith('/crm/jobs')
  })
})
