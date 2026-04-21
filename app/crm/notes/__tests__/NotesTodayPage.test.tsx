import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotesTodayPage from '../page'

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

describe('NotesTodayPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders dashboard-only sections including pinned and recent notes', async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: {
          overdue: [{ id: 'task-1', title: 'Past due follow-up', description: null, due_at: null, is_all_day: false, has_due_time: false }],
          due_today: [],
          upcoming: [],
        },
        notes: {
          starred: [{ id: 'note-1', title: 'Pinned note', body: 'Keep this visible' }],
          recent: [{ id: 'note-2', title: 'Recent note', body: 'Latest detail' }],
        },
      }),
    })

    render(<NotesTodayPage />)

    await waitFor(() => {
      expect(screen.getByText('Pinned Notes')).toBeTruthy()
      expect(screen.getByText('Recent Notes')).toBeTruthy()
      expect(screen.getByText('Past due follow-up')).toBeTruthy()
      expect(screen.getByText('Pinned note')).toBeTruthy()
      expect(screen.getByText('Recent note')).toBeTruthy()
    })

    expect(screen.queryByText('Daily Summary Email')).toBeNull()
    expect(screen.queryByText('Recent Reminder Logs')).toBeNull()
  })
})
