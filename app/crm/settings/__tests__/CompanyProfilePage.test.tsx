import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CompanyProfilePage from '../company/page'

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

describe('CompanyProfilePage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads, validates, and saves the company profile resource', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            business_name: 'ACE Painting',
            timezone: 'America/Chicago',
            main_phone: '',
            business_email: '',
            address: '',
            website: '',
            sender_signature: '',
            logo_url: '',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            business_name: 'ACE Pro Painting',
            timezone: 'America/Chicago',
            main_phone: '',
            business_email: '',
            address: '',
            website: '',
            sender_signature: '',
            logo_url: '',
          },
          notice: 'Company profile saved.',
        }),
      })

    render(<CompanyProfilePage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('ACE Painting')).toBeTruthy()
    })

    const saveButton = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByDisplayValue('ACE Painting'), {
      target: { value: 'ACE Pro Painting' },
    })

    expect(saveButton.disabled).toBe(false)
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Company profile saved.')).toBeTruthy()
    })

    fireEvent.change(screen.getByPlaceholderText('hello@acepainting.com'), {
      target: { value: 'bad-email' },
    })

    expect(screen.getByText('Business email must be a valid email address.')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows an explicit retry state when the initial load fails', async () => {
    mockAuthedFetch.mockRejectedValue(new Error('Network down'))

    render(<CompanyProfilePage />)

    await waitFor(() => {
      expect(screen.getByText('Network down')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    })
  })
})
