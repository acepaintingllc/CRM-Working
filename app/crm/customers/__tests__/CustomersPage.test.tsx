import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  })

  it('renders the shared CRM shell and filters customers from the search bar', () => {
    mockUseOrg.mockReturnValue({ orgId: 'org-123' })
    mockUseCustomerList.mockReturnValue({
      listCustomers: [
        { id: '1', name: 'Alice Painter', email: 'alice@example.com', phone: '555-1111', address: '123 Main St' },
        { id: '2', name: 'Bob Owner', email: 'bob@example.com', phone: '555-2222', address: '456 Oak Ave' },
      ],
      listLoading: false,
      listError: null,
    })

    render(<CustomersPage />)

    expect(screen.getByText('Customers')).toBeTruthy()
    expect(screen.getByText('Org: org-123')).toBeTruthy()
    expect(screen.getByText('Alice Painter')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('Search customers by name, email, phone, or address...'), {
      target: { value: 'bob' },
    })

    expect(screen.queryByText('Alice Painter')).toBeNull()
    expect(screen.getByText('Bob Owner')).toBeTruthy()
  })
})
