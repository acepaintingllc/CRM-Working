import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuoteDefaultsPage from '../QuoteDefaultsPage'

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

describe('QuoteDefaultsPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads and saves quote defaults through the shared CRM resource shell', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce(
        createResponse({
          data: [
            { id: 'paint-1', name: 'Super Paint', family: 'Paint', status: 'Active' },
            { id: 'primer-1', name: 'Prime Coat', family: 'Primer', status: 'Active' },
          ],
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          data: {
            walls_paint_id: 'paint-1',
            walls_primer_id: 'primer-1',
            ceiling_paint_id: null,
            ceiling_primer_id: null,
            trim_paint_id: null,
            trim_primer_id: null,
            override_labor_rate: 65,
          },
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          data: {
            walls_paint_id: 'paint-1',
            walls_primer_id: 'primer-1',
            ceiling_paint_id: null,
            ceiling_primer_id: null,
            trim_paint_id: null,
            trim_primer_id: null,
            override_labor_rate: 70,
          },
          notice: 'Quote defaults saved.',
        })
      )

    render(<QuoteDefaultsPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('65')).toBeTruthy()
    })

    fireEvent.change(screen.getByDisplayValue('65'), {
      target: { value: '70' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save defaults' }))

    await waitFor(() => {
      expect(screen.getByText('Quote defaults saved.')).toBeTruthy()
    })
  })
})
