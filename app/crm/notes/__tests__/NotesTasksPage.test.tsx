import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotesTasksPage from '../tasks/page'

const { mockAuthedFetch, mockUsePathname, mockUseSearchParams, mockRefresh } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
  mockUsePathname: vi.fn(),
  mockUseSearchParams: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
  useSearchParams: mockUseSearchParams,
  useRouter: () => ({
    refresh: mockRefresh,
    replace: vi.fn(),
    push: vi.fn(),
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

describe('NotesTasksPage', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
    mockUsePathname.mockReturnValue('/crm/notes/tasks')
    mockUseSearchParams.mockReturnValue(new URLSearchParams('focus=task-1'))
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [
          {
            id: 'task-1',
            title: 'Prepare proposal',
            description: 'Tight compact row',
            status: 'active',
            due_at: null,
            is_all_day: false,
            has_due_time: false,
            reminder_enabled: false,
            reminder_at: null,
            reminder_offset_minutes: null,
            recurrence_rule: null,
            priority: 'high',
            starred: true,
            reminder_sent_at: null,
            recurrence_series_id: null,
            source_note_id: null,
            created_by: null,
            created_at: '2026-04-21T00:00:00.000Z',
            updated_at: '2026-04-21T00:00:00.000Z',
            completed_at: null,
            archived_at: null,
            org_id: 'org',
          },
        ],
        filters: { status: 'active', due: 'all', starred: false, priority: null, search: '' },
        page: { next_cursor: 'cursor-1', has_more: true, limit: 24 },
      }),
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders compact task actions and opens edit through the composer query', async () => {
    render(<NotesTasksPage />)

    await waitFor(() => {
      expect(screen.getByText('Prepare proposal')).toBeTruthy()
    })

    expect(screen.queryByText('Edit Task')).toBeNull()
    expect(screen.getByRole('link', { name: 'Edit' }).getAttribute('href')).toContain('composer=task')
    expect(screen.getByText('Compact task manager')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Load More Tasks' })).toBeTruthy()
  })
})
