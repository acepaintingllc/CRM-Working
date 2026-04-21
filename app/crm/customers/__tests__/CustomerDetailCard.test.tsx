import { render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CustomerDetailCard } from '../_components/CustomerDetailCard'

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

describe('CustomerDetailCard', () => {
  it('shows transient status separately without masking customer content or action errors', () => {
    render(
      <CustomerDetailCard
        customer={{
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
        }}
        loading={false}
        error="Delete failed"
        statusMessage="Email copied"
        deleting={false}
        detailPathWithQuery="/crm/customers/customer-1"
        onBack={vi.fn()}
        onCopy={vi.fn()}
        onDelete={vi.fn()}
      />
    )

    expect(screen.getByText('Taylor Jones')).toBeTruthy()
    expect(screen.getByText('Delete failed')).toBeTruthy()
    expect(screen.getByText('Email copied')).toBeTruthy()
  })
})
