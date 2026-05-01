import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultQuoteTermsSections } from '@/lib/customer-estimates/termsDefaults'
import { templatePresets } from '@/lib/customer-estimates/presets'
import QuoteV2SettingsPage from '../quote-v2/page'
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

function createResponse(payload: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Server Error',
    text: vi.fn(async () => JSON.stringify(payload)),
  }
}

describe('TemplatesLibraryPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders stage template navigation only', () => {
    render(<TemplatesLibraryPage />)

    expect(screen.getByRole('heading', { name: 'Templates and Send Defaults' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Email templates/i }).getAttribute('href')).toBe('/crm/email-templates')
  })
})

describe('QuoteV2SettingsPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('loads quote v2 settings, keeps save disabled until dirty, and surfaces save errors', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce(
        createResponse({
          data: {
            default_template_key: 'default',
            quote_validity_days: 90,
            terms_text: 'Terms',
            terms_sections: defaultQuoteTermsSections,
            template_presets: templatePresets,
          },
        })
      )
      .mockResolvedValueOnce(
        createResponse({
          error: 'Unable to save right now',
        }, false)
      )

    render(<QuoteV2SettingsPage />)

    await waitFor(() => {
      expect(screen.getByDisplayValue(defaultQuoteTermsSections.insurance)).toBeTruthy()
    })

    const saveButton = screen.getByRole('button', { name: 'Save defaults' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByDisplayValue(defaultQuoteTermsSections.insurance), {
      target: { value: 'Updated insurance terms' },
    })

    expect(saveButton.disabled).toBe(false)
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Unable to save right now')).toBeTruthy()
    })
  })

  it('shows an explicit retry state when quote v2 settings fail to load', async () => {
    mockAuthedFetch.mockRejectedValue(new Error('Failed to reach API'))

    render(<QuoteV2SettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to reach API')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
    })
  })
})
