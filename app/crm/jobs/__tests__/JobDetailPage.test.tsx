import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import JobDetailPage from '../[id]/page'

const authedFetch = vi.fn()
const replace = vi.fn()
const push = vi.fn()
const back = vi.fn()
const writeText = vi.fn()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
}))

vi.mock('@/app/crm/jobs/_components/StageEmailModal', () => ({
  default: () => null,
}))

vi.mock('@/app/crm/jobs/_components/JobCompletionCloseoutModal', () => ({
  default: () => null,
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'job-1' }),
  useRouter: () => ({ replace, push, back }),
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

describe('JobDetailPage', () => {
  beforeEach(() => {
    authedFetch.mockReset()
    replace.mockReset()
    push.mockReset()
    back.mockReset()
    writeText.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('renders the shared detail surface and reuses standardized copy/delete actions', async () => {
    const user = userEvent.setup()
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

    render(<JobDetailPage />)

    await waitFor(() => expect(screen.getAllByText('Exterior repaint').length).toBeGreaterThan(0))
    await user.click(screen.getAllByRole('button', { name: 'Copy' })[0])
    await waitFor(() => expect(screen.getByText('Email copied')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: 'Delete job' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/crm/jobs'))
  })

  it('uses standardized resource states for not found and load failure', async () => {
    authedFetch
      .mockResolvedValueOnce(createResponse({ data: null }))
      .mockResolvedValueOnce(createResponse({ error: 'No matching estimate in Drive folder' }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))

    render(<JobDetailPage />)

    await waitFor(() => expect(screen.getByText('Job not found')).toBeTruthy())

    cleanup()
    authedFetch.mockReset()
    authedFetch
      .mockResolvedValueOnce(createResponse({ error: 'Failed to load job.' }, false))
      .mockResolvedValueOnce(createResponse({ error: 'No matching estimate in Drive folder' }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))

    render(<JobDetailPage />)

    await waitFor(() => expect(screen.getByText('Job unavailable')).toBeTruthy())
    expect(screen.getByText('Failed to load job.')).toBeTruthy()
  })
})
