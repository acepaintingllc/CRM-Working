import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuoteProductsPage from '../QuoteProductsPage'

const { mockAuthedFetch } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

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

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    text: vi.fn(async () => JSON.stringify(payload)),
  }
}

describe('QuoteProductsPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads products, saves, and archives through the standardized CRM admin shell', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce(
        createResponse({
          data: [
            {
              id: 'product-1',
              name: 'Super Paint',
              family: 'Paint',
              base: 'A',
              subtype: 'Interior',
              cost_per_unit: 30,
              coverage_sqft_per_gal_per_coat: 350,
              efficiency_pct: 90,
              default_coats: 2,
              default_sheen: 'Eggshell',
              default_scopes: ['Walls'],
              notes: '',
              status: 'Active',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          data: {
            id: 'product-1',
            name: 'Super Paint Pro',
            family: 'Paint',
            base: 'A',
            subtype: 'Interior',
            cost_per_unit: 30,
            coverage_sqft_per_gal_per_coat: 350,
            efficiency_pct: 90,
            default_coats: 2,
            default_sheen: 'Eggshell',
            default_scopes: ['Walls'],
            notes: '',
            status: 'Active',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
          notice: 'Product saved.',
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          data: {
            id: 'product-1',
            name: 'Super Paint Pro',
            family: 'Paint',
            base: 'A',
            subtype: 'Interior',
            cost_per_unit: 30,
            coverage_sqft_per_gal_per_coat: 350,
            efficiency_pct: 90,
            default_coats: 2,
            default_sheen: 'Eggshell',
            default_scopes: ['Walls'],
            notes: '',
            status: 'Archived',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
          notice: 'Product archived.',
        })
      )

    render(<QuoteProductsPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Super Paint').length).toBeGreaterThan(0)
    })
    fireEvent.click(screen.getAllByRole('button', { name: /Super Paint/ })[0])

    await waitFor(() => {
      expect(screen.getByLabelText('Product name')).toBeTruthy()
    })

    fireEvent.change(screen.getByLabelText('Product name'), {
      target: { value: 'Super Paint Pro' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(screen.getByText('Product saved.')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Archive product' }))

    await waitFor(() => {
      expect(screen.getByText('Product archived.')).toBeTruthy()
      expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('Archived')
    })

    expect(mockAuthedFetch).toHaveBeenCalledTimes(3)
  })
})
