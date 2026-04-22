import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import userEvent from '@testing-library/user-event'
import { mutate as swrMutate } from 'swr'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSWRWrapper } from '@/app/crm/__tests__/swrTestUtils'
import NewCustomerPage from '../new/page'
import CustomerDetailPage from '../[id]/page'
import EditCustomerPage from '../[id]/edit/page'

const authedFetch = vi.fn()
const invalidateSwrKey = vi.fn<(key: string) => Promise<unknown>>()
const push = vi.fn()
const replace = vi.fn()
const refresh = vi.fn()
const back = vi.fn()
const useParams = vi.fn()
const usePathname = vi.fn()
const useSearchParams = vi.fn()
const useOrg = vi.fn()

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: (input: RequestInfo | URL, init?: RequestInit) => authedFetch(input, init),
}))

vi.mock('@/app/crm/_hooks/swrCache', () => ({
  invalidateSwrKey: (key: string) => invalidateSwrKey(key),
}))

vi.mock('@/app/crm/customers/customers-orgproviders', () => ({
  useOrg: () => useOrg(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, refresh, back }),
  useParams: () => useParams(),
  usePathname: () => usePathname(),
  useSearchParams: () => useSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: Record<string, unknown> & { children?: ReactNode }) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
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

describe('customer journey smoke', () => {
  beforeEach(() => {
    authedFetch.mockReset()
    push.mockReset()
    replace.mockReset()
    refresh.mockReset()
    back.mockReset()
    useParams.mockReset()
    usePathname.mockReset()
    useSearchParams.mockReset()
    useOrg.mockReset()
    invalidateSwrKey.mockClear()
    invalidateSwrKey.mockImplementation((key: string) => swrMutate(key))
    useOrg.mockReturnValue({ orgId: 'org-1', loading: false, error: null, refresh: vi.fn() })
    usePathname.mockReturnValue('/crm/customers/customer-1')
    useSearchParams.mockReturnValue(new URLSearchParams(''))
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('covers create, detail, edit, note add, and delete transitions', async () => {
    const user = userEvent.setup()

    authedFetch.mockResolvedValueOnce(createMutationResponse({ id: 'customer-1' }))
    render(<NewCustomerPage />, { wrapper: createSWRWrapper() })

    await user.type(screen.getByLabelText('Name *'), 'Taylor Jones')
    await user.type(screen.getByLabelText('Street'), '123 Main St')
    await user.type(screen.getByLabelText('City'), 'Newburgh')
    await user.type(screen.getByLabelText('State'), 'IN')
    await user.type(screen.getByLabelText('ZIP'), '47630')
    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/customers/customer-1'))
    expect(refresh).not.toHaveBeenCalled()
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/customers')
    cleanup()

    authedFetch.mockReset()
    push.mockReset()
    refresh.mockReset()
    useParams.mockReturnValue({ id: 'customer-1' })
    useSearchParams.mockReturnValue(new URLSearchParams(''))
    authedFetch
      .mockResolvedValueOnce(
        createDataResponse({
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
          created_at: '2026-04-21T12:00:00.000Z',
        })
      )
      .mockResolvedValueOnce(
        createDataResponse([
          { id: 'customer-1', name: 'Taylor Jones', email: 'taylor@example.com', phone: '812-555-0100', address: '123 Main St, Newburgh, IN 47630' },
        ])
      )
      .mockResolvedValueOnce(createDataResponse([]))
      .mockResolvedValueOnce(createMutationResponse({ id: 'note-1' }))
      .mockResolvedValueOnce(
        createDataResponse([
          {
            id: 'note-1',
            type: 'note',
            title: null,
            body: 'Customer prefers mornings',
            created_at: null,
            created_by: null,
            link_path: null,
            link_label: null,
          },
        ])
      )
      .mockResolvedValueOnce(createMutationResponse(true))

    render(<CustomerDetailPage />, { wrapper: createSWRWrapper() })

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Customer details' })).toBeTruthy()
    )
    expect(screen.getAllByText('Taylor Jones').length).toBeGreaterThan(0)
    await user.type(screen.getByPlaceholderText('Add a note about this customer...'), 'Customer prefers mornings')
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    await waitFor(() =>
      expect(invalidateSwrKey).toHaveBeenCalledWith('/api/customers/customer-1/timeline')
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/customers'))
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/customers/customer-1/timeline')
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/customers/customer-1')
    cleanup()

    authedFetch.mockReset()
    push.mockReset()
    refresh.mockReset()
    useSearchParams.mockReturnValue(new URLSearchParams('returnTo=%2Fcrm%2Fcustomers%2Fcustomer-1'))
    authedFetch
      .mockResolvedValueOnce(
        createDataResponse({
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
        })
      )
      .mockResolvedValueOnce(createMutationResponse({ id: 'customer-1' }))

    render(<EditCustomerPage />, { wrapper: createSWRWrapper() })

    await waitFor(() => expect(screen.getByDisplayValue('Taylor Jones')).toBeTruthy())
    const nameInput = screen.getByLabelText('Name *')
    await user.clear(nameInput)
    await user.type(nameInput, 'Taylor Updated')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/crm/customers/customer-1'))
    expect(refresh).not.toHaveBeenCalled()
    expect(invalidateSwrKey).toHaveBeenCalledWith('/api/customers/customer-1')
  }, 15000)
})
