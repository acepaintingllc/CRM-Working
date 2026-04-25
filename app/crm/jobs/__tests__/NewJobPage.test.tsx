import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NewJobPage from '../new/page'

const authedFetch = vi.fn()
const push = vi.fn()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
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

const taylorCustomer = {
  id: 'customer-1',
  name: 'Taylor Jones',
  email: 'taylor@example.com',
  phone: '812-555-0100',
  address: '123 Main St, Newburgh, IN 47630',
}

function createCustomerListResponse(customers: unknown[]) {
  return createResponse({
    data: {
      data: customers,
      total: customers.length,
      page: 1,
      pageSize: 3,
    },
  })
}

describe('NewJobPage', () => {
  beforeEach(() => {
    authedFetch.mockReset()
    push.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('creates a job and routes to detail by default', async () => {
    const user = userEvent.setup()
    authedFetch
      .mockResolvedValueOnce(createCustomerListResponse([taylorCustomer]))
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

    render(<NewJobPage />)

    await waitFor(() => expect(screen.getByText('Taylor Jones')).toBeTruthy())
    await user.click(screen.getByText('Taylor Jones'))
    await user.type(screen.getByPlaceholderText('ex: Exterior repaint'), 'Exterior repaint')
    await user.click(screen.getByRole('button', { name: 'Create job' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/jobs/job-1'))
  })

  it('shows standardized validation errors for missing customer, title, and email-send prerequisites', async () => {
    const user = userEvent.setup()
    authedFetch
      .mockResolvedValueOnce(createCustomerListResponse([{ ...taylorCustomer, email: null }]))
      .mockResolvedValueOnce(
        createResponse({
          data: [{ stage: 'estimate_scheduled', subject: 'Subject', body: 'Body' }],
        })
      )

    render(<NewJobPage />)
    await waitFor(() => expect(screen.getByText('Taylor Jones')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Create job' }))
    expect(screen.getByText('Select a customer')).toBeTruthy()

    await user.click(screen.getByText('Taylor Jones'))
    await user.click(screen.getByRole('button', { name: 'Create job' }))
    expect(screen.getByText('Job title is required')).toBeTruthy()

    await user.type(screen.getByPlaceholderText('ex: Exterior repaint'), 'Exterior repaint')
    await user.click(screen.getByRole('button', { name: 'Edit & send' }))
    await waitFor(() => expect(screen.getByDisplayValue('Subject')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: 'Create job & send email' }))
    expect(screen.getByText('Customer email is missing.')).toBeTruthy()
  })
})
