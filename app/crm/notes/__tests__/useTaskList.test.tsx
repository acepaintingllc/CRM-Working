import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskList } from '@/lib/notes/client/useTaskList'

const { mockAuthedFetch, mockRefresh } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    replace: vi.fn(),
    push: vi.fn(),
  }),
}))

describe('useTaskList', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockAuthedFetch.mockReset()
    mockRefresh.mockReset()
  })

  it('builds the task query and reloads on debounced search', async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        tasks: [],
        filters: { status: 'active', due: 'all', starred: false, priority: null, search: '' },
        page: { next_cursor: null, has_more: false, limit: 24 },
      }),
    })

    const { result } = renderHook(() => useTaskList())

    await waitFor(() => {
      expect(mockAuthedFetch).toHaveBeenCalled()
    })

    await act(async () => {
      result.current.setSearch('paint')
    })

    await waitFor(() => {
      expect(mockAuthedFetch).toHaveBeenLastCalledWith('/api/notes/tasks?status=active&due=all&search=paint&limit=24', {
        cache: 'no-store',
      })
    }, { timeout: 1500 })
  })

  it('runs task actions, refreshes local data, and refreshes the route', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [{ id: 'task-1', title: 'Task', description: null, status: 'active', due_at: null, is_all_day: false, has_due_time: false, reminder_enabled: false, reminder_at: null, reminder_offset_minutes: null, reminder_sent_at: null, recurrence_rule: null, recurrence_series_id: null, priority: null, starred: false, source_note_id: null, created_by: null, created_at: '2026-04-21T00:00:00.000Z', updated_at: '2026-04-21T00:00:00.000Z', completed_at: null, archived_at: null, org_id: 'org' }],
          filters: { status: 'active', due: 'all', starred: false, priority: null, search: '' },
          page: { next_cursor: null, has_more: false, limit: 24 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [],
          filters: { status: 'active', due: 'all', starred: false, priority: null, search: '' },
          page: { next_cursor: null, has_more: false, limit: 24 },
        }),
      })

    const { result } = renderHook(() => useTaskList())

    await waitFor(() => {
      expect(result.current.tasks.length).toBe(1)
    })

    await act(async () => {
      await result.current.completeTask('task-1')
    })

    expect(mockRefresh).toHaveBeenCalled()
    expect(result.current.tasks.length).toBe(0)
  })

  it('appends another page when loadMore runs', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [{ id: 'task-1', title: 'Task 1', description: null, status: 'active', due_at: null, is_all_day: false, has_due_time: false, reminder_enabled: false, reminder_at: null, reminder_offset_minutes: null, reminder_sent_at: null, recurrence_rule: null, recurrence_series_id: null, priority: null, starred: false, source_note_id: null, created_by: null, created_at: '2026-04-21T00:00:00.000Z', updated_at: '2026-04-21T00:00:00.000Z', completed_at: null, archived_at: null, org_id: 'org' }],
          filters: { status: 'active', due: 'all', starred: false, priority: null, search: '' },
          page: { next_cursor: 'cursor-1', has_more: true, limit: 24 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tasks: [{ id: 'task-2', title: 'Task 2', description: null, status: 'active', due_at: null, is_all_day: false, has_due_time: false, reminder_enabled: false, reminder_at: null, reminder_offset_minutes: null, reminder_sent_at: null, recurrence_rule: null, recurrence_series_id: null, priority: null, starred: false, source_note_id: null, created_by: null, created_at: '2026-04-20T00:00:00.000Z', updated_at: '2026-04-20T00:00:00.000Z', completed_at: null, archived_at: null, org_id: 'org' }],
          filters: { status: 'active', due: 'all', starred: false, priority: null, search: '' },
          page: { next_cursor: null, has_more: false, limit: 24 },
        }),
      })

    const { result } = renderHook(() => useTaskList())

    await waitFor(() => {
      expect(result.current.tasks).toHaveLength(1)
      expect(result.current.hasMore).toBe(true)
    })

    await act(async () => {
      await result.current.loadMore()
    })

    expect(
      mockAuthedFetch.mock.calls.some(
        ([url, init]) =>
          url === '/api/notes/tasks?status=active&due=all&limit=24&cursor=cursor-1' &&
          (init as RequestInit | undefined)?.cache === 'no-store'
      )
    ).toBe(true)
    expect(result.current.tasks.map((task) => task.id)).toEqual(['task-1', 'task-2'])
    expect(result.current.hasMore).toBe(false)
  })
})
