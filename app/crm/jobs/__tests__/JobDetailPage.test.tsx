import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSWRWrapper } from '@/app/crm/__tests__/swrTestUtils'
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
      .mockResolvedValueOnce(createResponse({ error: 'No matching quote in Drive folder' }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: { ok: true } }))

    render(<JobDetailPage />, { wrapper: createSWRWrapper() })

    await waitFor(() => expect(screen.getAllByText('Exterior repaint').length).toBeGreaterThan(0))
    await user.click(screen.getAllByRole('button', { name: 'Copy' })[0])
    await waitFor(() => expect(screen.getByText('Email copied')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: 'Delete job' }))
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/crm/jobs'))
  })

  it('uses standardized resource states for not found and load failure', async () => {
    authedFetch
      .mockResolvedValueOnce(createResponse({ data: null }))
      .mockResolvedValueOnce(createResponse({ error: 'No matching quote in Drive folder' }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))

    render(<JobDetailPage />, { wrapper: createSWRWrapper() })

    await waitFor(() => expect(screen.getByText('Job not found')).toBeTruthy())

    cleanup()
    authedFetch.mockReset()
    authedFetch
      .mockResolvedValueOnce(createResponse({ error: 'Failed to load job.' }, false))
      .mockResolvedValueOnce(createResponse({ error: 'No matching quote in Drive folder' }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))

    render(<JobDetailPage />, { wrapper: createSWRWrapper() })

    await waitFor(() => expect(screen.getByText('Job unavailable')).toBeTruthy())
    expect(screen.getByText('Failed to load job.')).toBeTruthy()
  })

  it('shows accepted quote details and audit fields on the internal job detail page', async () => {
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
            status: 'scheduled',
            estimate_date: '2026-04-23T13:00:00.000Z',
            estimate_sent_at: null,
            scheduled_date: null,
            scheduled_end_date: null,
            completed_at: null,
            linked_estimate_id: 'estimate-1',
            accepted_estimate: {
              estimate_id: 'estimate-1',
              accepted_public_version_id: 'public-version-1',
              public_version_number: 3,
              public_token: 'public-token-1',
              accepted_at: '2026-04-29T10:00:00.000Z',
              accepted_by_legal_name: 'Jordan Customer',
              signature_type: 'typed',
              user_agent: 'Mozilla/5.0',
              ip: '127.0.0.1',
              version_name: 'Interior repaint',
              final_total: 4250,
            },
          },
        })
      )
      .mockResolvedValueOnce(createResponse({ data: { file: { id: 'drive-1', name: 'Drive estimate.pdf' } } }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))

    render(<JobDetailPage />, { wrapper: createSWRWrapper() })

    await waitFor(() => expect(screen.getByText('Accepted Quote')).toBeTruthy())
    expect(screen.getByText('Accepted by Jordan Customer')).toBeTruthy()
    expect(screen.getByText(/Public version #3/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Open accepted quote' })).toHaveAttribute(
      'href',
      '/quote/public-token-1'
    )
    expect(screen.getByText('Audit details')).toBeTruthy()
    expect(screen.getByText('Signature type: typed')).toBeTruthy()
    expect(screen.getByText('IP: 127.0.0.1')).toBeTruthy()
    expect(screen.getByText('User agent: Mozilla/5.0')).toBeTruthy()
    expect(screen.queryByText('Drive estimate.pdf')).toBeNull()
  })

  it('shows public quote events in the job timeline', async () => {
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
            status: 'estimate_sent',
            estimate_date: '2026-04-23T13:00:00.000Z',
            estimate_sent_at: null,
            scheduled_date: null,
            scheduled_end_date: null,
            completed_at: null,
            public_quote_timeline_events: [
              {
                id: 'quote-event-accepted',
                type: 'quote_accepted',
                title: 'Quote accepted',
                body: 'Public version #2',
                created_at: '2026-04-29T10:00:00.000Z',
                created_by: null,
                link_path: '/quote/public-token-1',
                link_label: 'Open quote',
              },
              {
                id: 'quote-event-viewed',
                type: 'quote_viewed',
                title: 'Quote viewed',
                body: 'Public version #2',
                created_at: '2026-04-28T10:00:00.000Z',
                created_by: null,
                link_path: '/quote/public-token-1',
                link_label: 'Open quote',
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(createResponse({ error: 'No matching quote in Drive folder' }))
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))

    render(<JobDetailPage />, { wrapper: createSWRWrapper() })

    await waitFor(() => expect(screen.getByText('Quote accepted')).toBeTruthy())
    expect(screen.getByText('Quote viewed')).toBeTruthy()
    expect(screen.getAllByText('Public version #2').length).toBeGreaterThanOrEqual(2)
    expect(
      screen
        .getAllByRole('link', { name: 'Open quote' })
        .some((link) => link.getAttribute('href') === '/quote/public-token-1')
    ).toBe(true)
  })

  it('uses estimate_navigation_id only for latest-quote navigation when no accepted estimate exists', async () => {
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
            status: 'estimate_sent',
            estimate_date: '2026-04-23T13:00:00.000Z',
            estimate_sent_at: null,
            scheduled_date: null,
            scheduled_end_date: null,
            completed_at: null,
            linked_estimate_id: null,
            estimate_navigation_id: 'draft-estimate-1',
            accepted_estimate: null,
          },
        })
      )
      .mockResolvedValueOnce(
        createResponse({ data: { file: { id: 'drive-1', name: 'Drive estimate.pdf' } } })
      )
      .mockResolvedValueOnce(createResponse({ data: [] }))
      .mockResolvedValueOnce(createResponse({ data: [] }))

    render(<JobDetailPage />, { wrapper: createSWRWrapper() })

    await waitFor(() => expect(screen.getByText('Latest Quote')).toBeTruthy())
    expect(
      screen
        .getAllByRole('link', { name: 'Open quote' })
        .every((link) => link.getAttribute('href') === '/crm/quotes/draft-estimate-1')
    ).toBe(true)
  })
})
