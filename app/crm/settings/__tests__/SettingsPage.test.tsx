import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import IntegrationsSettingsPage from '../integrations/page'
import SettingsPage from '../page'

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

describe('settings navigation pages', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the settings landing page with domain-focused tiles', () => {
    render(<SettingsPage />)

    expect(screen.getByText('CRM Settings')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Company profile/i }).getAttribute('href')).toBe('/crm/settings/company')
    expect(screen.getByRole('link', { name: /Integrations/i }).getAttribute('href')).toBe('/crm/settings/integrations')
    expect(screen.getByRole('link', { name: /Templates/i }).getAttribute('href')).toBe('/crm/settings/templates')
    expect(screen.getByRole('link', { name: /Quote V2/i }).getAttribute('href')).toBe('/crm/settings/quote-v2')
  })

  it('renders integrations as a navigation surface instead of a persisted form', () => {
    render(<IntegrationsSettingsPage />)

    expect(screen.getByRole('heading', { name: 'Integrations' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Google Calendar/i }).getAttribute('href')).toBe('/crm/calendar')
    expect(screen.getByRole('link', { name: /Environment health/i }).getAttribute('href')).toBe('/env-check')
  })
})
