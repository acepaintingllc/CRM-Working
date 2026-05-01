import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CrmLayout from '../layout'

vi.mock('next/navigation', () => ({
  usePathname: () => '/crm/quotes',
}))

vi.mock('next/image', () => ({
  default: ({ alt }: {
    alt: string
    src: string
    width: number
    height: number
    unoptimized?: boolean
    style?: React.CSSProperties
    onError?: () => void
  }) => <span aria-label={alt} />,
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: vi.fn(async () => ({
    ok: true,
    json: async () => ({}),
  })),
}))

describe('CrmLayout sidebar', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('collapses and expands the desktop CRM navigation with persisted state', async () => {
    render(
      <CrmLayout>
        <main>CRM content</main>
      </CrmLayout>
    )

    await waitFor(() => expect(screen.getByText('CRM content')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Collapse CRM navigation' }))

    expect(screen.queryByRole('button', { name: 'Collapse CRM navigation' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand CRM navigation' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Job Center' })[0]).toHaveAttribute(
      'title',
      'Job Center'
    )
    expect(window.localStorage.getItem('acecrm.sidebarCollapsed')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Expand CRM navigation' }))

    expect(screen.getByRole('button', { name: 'Collapse CRM navigation' })).toBeInTheDocument()
    expect(screen.getAllByText('ACE Painting').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Job Center').length).toBeGreaterThan(0)
    expect(window.localStorage.getItem('acecrm.sidebarCollapsed')).toBe('false')
  })
})
