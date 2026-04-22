import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmailTemplatesPage from '../page'

const { mockAuthedFetch } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: Record<string, unknown> & { children?: ReactNode }) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

describe('EmailTemplatesPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads templates, enables save when dirty, and surfaces save notices', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [{ stage: 'estimate_scheduled', subject: 'Initial', body: 'Body' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: { stage: 'estimate_scheduled', subject: 'Updated', body: 'Body' },
            notice: 'Email template saved.',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Initial')).toBeTruthy()
    })

    const saveButton = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByDisplayValue('Initial'), { target: { value: 'Updated' } })
    expect(saveButton.disabled).toBe(false)

    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Email template saved.')).toBeTruthy()
    })
  })

  it('shows load failures through the shared notice surface', async () => {
    mockAuthedFetch.mockRejectedValueOnce(new Error('Failed to reach API'))

    render(<EmailTemplatesPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to reach API')).toBeTruthy()
    })
  })
})
