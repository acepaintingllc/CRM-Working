import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesDashboard } from '@/lib/notes/client/useNotesDashboard'

const { mockAuthedFetch } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

describe('useNotesDashboard', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  it('loads the dashboard data', async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        today: { timezone: 'America/Chicago', date_key: '2026-04-21' },
        settings: { upcoming_days: 3 },
        tasks: { overdue: [], due_today: [], upcoming: [], untimed_today: [] },
        notes: { starred: [], recent: [] },
      }),
    })

    const { result } = renderHook(() => useNotesDashboard())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.data?.today.timezone).toBe('America/Chicago')
    expect(result.current.error).toBeNull()
  })

  it('normalizes dashboard load errors', async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Dashboard failed.' }),
    })

    const { result } = renderHook(() => useNotesDashboard())

    await waitFor(() => {
      expect(result.current.error).toBe('Dashboard failed.')
    })
  })
})
