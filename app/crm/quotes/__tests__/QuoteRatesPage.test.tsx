import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuoteRatesPage from '../QuoteRatesPage'

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

describe('QuoteRatesPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads the dense admin editor through the shared CRM shell', async () => {
    mockAuthedFetch.mockResolvedValueOnce(
      createResponse({
        data: {
          source: 'db',
          seeded: true,
          template_version: 2,
          categories: [
            {
              key: 'production_rates_walls',
              tab: 'rates',
              group: 'production_rates',
              label: 'Wall Production',
              table_title: 'Wall Production',
              description: 'Wall rates',
              columns: [
                { key: 'display_name', label: 'Name' },
                { key: 'active', label: 'Status' },
              ],
              fields: [
                { key: 'id', label: 'ID', type: 'text', required: true },
                { key: 'display_name', label: 'Display Name', type: 'text', required: true },
              ],
              rows: [
                {
                  id: 'wall-rate-1',
                  display_name: 'Standard walls',
                  notes: '',
                  active: true,
                  production_scope: 'walls',
                  scope_id: 'walls',
                  surface_type: 'standard',
                  condition: 'good',
                  prep_sqft_per_hr: '100',
                  sqft_per_hr: '150',
                  primer_sqft_per_hr: '120',
                },
              ],
            },
          ],
        },
      })
    )

    render(<QuoteRatesPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Standard walls')).toHaveLength(2)
      expect(screen.getAllByText('Wall Production')).toHaveLength(2)
    })
  })

  it('shows the shared retry state when loading fails', async () => {
    mockAuthedFetch.mockRejectedValueOnce(new Error('Rates unavailable'))

    render(<QuoteRatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Rates unavailable')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    })
  })

  it('shows a discard modal before replacing a dirty draft', async () => {
    mockAuthedFetch.mockResolvedValueOnce(
      createResponse({
        data: {
          source: 'db',
          seeded: true,
          template_version: 2,
          categories: [
            {
              key: 'production_rates_walls',
              tab: 'rates',
              group: 'production_rates',
              label: 'Wall Production',
              table_title: 'Wall Production',
              description: 'Wall rates',
              columns: [{ key: 'display_name', label: 'Name' }],
              fields: [
                { key: 'id', label: 'ID', type: 'text', required: true },
                { key: 'display_name', label: 'Display Name', type: 'text', required: true },
              ],
              rows: [
                { id: 'wall-rate-1', display_name: 'Standard walls', notes: '', active: true },
                { id: 'wall-rate-2', display_name: 'Tall walls', notes: '', active: true },
              ],
            },
          ],
        },
      })
    )

    render(<QuoteRatesPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Standard walls')).toHaveLength(2)
    })

    const displayNameInput = screen.getByLabelText('Display Name *')
    fireEvent.change(displayNameInput, { target: { value: 'Edited walls' } })

    fireEvent.click(screen.getByRole('row', { name: 'Tall walls' }))

    await waitFor(() => {
      expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
      expect(
        screen.getByText('Switching to another row will discard unsaved edits in the current draft.')
      ).toBeTruthy()
    })
  })
})
