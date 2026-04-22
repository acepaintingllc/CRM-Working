import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CustomersPage from '../page'

const mockUseOrg = vi.fn()
const mockUseCustomerList = vi.fn()

vi.mock('@/app/crm/customers/customers-orgproviders', () => ({
  useOrg: () => mockUseOrg(),
}))

vi.mock('@/app/crm/customers/_hooks/useCustomerList', () => ({
  useCustomerList: () => mockUseCustomerList(),
}))

describe('CustomersPage', () => {
  beforeEach(() => {
    mockUseOrg.mockReset()
    mockUseCustomerList.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the shared CRM shell and debounces server-side search updates', () => {
    const setSearch = vi.fn()
    const setPage = vi.fn()

    mockUseOrg.mockReturnValue({ orgId: 'org-123' })
    mockUseCustomerList.mockReturnValue({
      customers: [
        { id: '1', name: 'Alice Painter', email: 'alice@example.com', phone: '555-1111', address: '123 Main St' },
        { id: '2', name: 'Bob Owner', email: 'bob@example.com', phone: '555-2222', address: '456 Oak Ave' },
      ],
      total: 2,
      page: 1,
      pageSize: 50,
      search: '',
      setSearch,
      setPage,
      loading: false,
      error: null,
    })

    render(<CustomersPage />)

    expect(screen.getByText('Customers')).toBeTruthy()
    expect(screen.getByText('Org: org-123')).toBeTruthy()
    expect(screen.getByText('Alice Painter')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Search customers by name, email, or phone...'), {
      target: { value: 'bob' },
    })

    expect(setSearch).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(setSearch).toHaveBeenCalledWith('bob')
  })
})
