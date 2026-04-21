import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotesLayout from '../layout'

const { mockUsePathname, mockUseSearchParams } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
  mockUseSearchParams: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
  useSearchParams: mockUseSearchParams,
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
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

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: vi.fn(),
}))

describe('NotesLayout', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/crm/notes')
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the three primary tabs and distinct composer actions', () => {
    render(
      <NotesLayout>
        <div>child</div>
      </NotesLayout>
    )

    expect(screen.getByRole('link', { name: 'Today' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tasks' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Notes' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Quick Add' })).toBeNull()
    expect(screen.getByRole('link', { name: 'New Task' }).getAttribute('href')).toContain('composer=task')
    expect(screen.getByRole('link', { name: 'New Note' }).getAttribute('href')).toContain('composer=note')
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/crm/notes/settings')
  })
})
