import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TemplatesLibraryPage from '../templates/page'

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

describe('TemplatesLibraryPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads quote send defaults, keeps save disabled until dirty, and surfaces save errors', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            default_template_key: 'default',
            quote_validity_days: 90,
            terms_text: 'Terms',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Unable to save right now',
        }),
      })

    render(<TemplatesLibraryPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Terms')).toBeTruthy()
    })

    const saveButton = screen.getByRole('button', { name: 'Save defaults' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByDisplayValue('Terms'), {
      target: { value: 'Updated terms' },
    })

    expect(saveButton.disabled).toBe(false)
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Unable to save right now')).toBeTruthy()
    })
  })

  it('shows an explicit retry state when quote send defaults fail to load', async () => {
    mockAuthedFetch.mockRejectedValue(new Error('Failed to reach API'))

    render(<TemplatesLibraryPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to reach API')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    })
  })
})
