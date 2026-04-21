import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditCustomerPage from '../[id]/edit/page'

const authedFetch = vi.fn()
const push = vi.fn()
const refresh = vi.fn()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (...args: unknown[]) => authedFetch(...args),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'customer-1' }),
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams('returnTo=%2Fcrm%2Fcustomers%2Fcustomer-1'),
}))

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    text: vi.fn(async () => JSON.stringify(payload)),
  }
}

describe('EditCustomerPage', () => {
  beforeEach(() => {
    authedFetch.mockReset()
    push.mockReset()
    refresh.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads malformed legacy addresses into cleanup mode without blocking the form', async () => {
    authedFetch.mockResolvedValue(
      createResponse({
        customer: {
          id: 'customer-1',
          name: 'Taylor Jones',
          email: 'taylor@example.com',
          phone: '812-555-0100',
          address: '123 Main St Newburgh IN',
          street: null,
          city: null,
          state: null,
          zip: null,
          notes: null,
          created_at: null,
        },
      })
    )

    render(<EditCustomerPage />)

    await waitFor(() => expect(screen.getByDisplayValue('Taylor Jones')).toBeTruthy())
    expect(screen.getByDisplayValue('taylor@example.com')).toBeTruthy()
    expect(screen.getByText('Legacy address needs cleanup')).toBeTruthy()
    expect(screen.getByText(/123 Main St Newburgh IN/)).toBeTruthy()
  })

  it('loads structured addresses normally', async () => {
    authedFetch.mockResolvedValue(
      createResponse({
        customer: {
          id: 'customer-1',
          name: 'Taylor Jones',
          email: 'taylor@example.com',
          phone: '812-555-0100',
          address: '123 Main St, Newburgh, IN 47630',
          street: '123 Main St',
          city: 'Newburgh',
          state: 'IN',
          zip: '47630',
          notes: null,
          created_at: null,
        },
      })
    )

    render(<EditCustomerPage />)

    await waitFor(() => expect(screen.getByDisplayValue('123 Main St')).toBeTruthy())
    expect(screen.queryByText('Legacy address needs cleanup')).toBeNull()
  })

  it('navigates on successful patch', async () => {
    const user = userEvent.setup()
    authedFetch
      .mockResolvedValueOnce(
        createResponse({
          customer: {
            id: 'customer-1',
            name: 'Taylor Jones',
            email: 'taylor@example.com',
            phone: '812-555-0100',
            address: '123 Main St, Newburgh, IN 47630',
            street: '123 Main St',
            city: 'Newburgh',
            state: 'IN',
            zip: '47630',
            notes: null,
            created_at: null,
          },
        })
      )
      .mockResolvedValueOnce(createResponse({}, true))

    render(<EditCustomerPage />)
    await waitFor(() => expect(screen.getByDisplayValue('Taylor Jones')).toBeTruthy())

    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/crm/customers/customer-1')
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it('surfaces server patch failures', async () => {
    const user = userEvent.setup()
    authedFetch.mockReset()
    push.mockReset()
    refresh.mockReset()
    authedFetch
      .mockResolvedValueOnce(
        createResponse({
          customer: {
            id: 'customer-1',
            name: 'Taylor Jones',
            email: 'taylor@example.com',
            phone: '812-555-0100',
            address: '123 Main St, Newburgh, IN 47630',
            street: '123 Main St',
            city: 'Newburgh',
            state: 'IN',
            zip: '47630',
            notes: null,
            created_at: null,
          },
        })
      )
      .mockResolvedValueOnce(createResponse({ error: 'Patch failed' }, false))

    render(<EditCustomerPage />)
    await waitFor(() => expect(screen.getByDisplayValue('Taylor Jones')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText('Patch failed')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })
})
