import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTaskForm } from '../_components/useTaskForm'

const { mockAuthedFetch } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

describe('useTaskForm', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  it('uses empty defaults for create mode', () => {
    const { result } = renderHook(() =>
      useTaskForm({
        open: true,
        taskId: null,
        onSuccess: vi.fn(),
      })
    )

    expect(result.current.loading).toBe(false)
    expect(result.current.title).toBe('')
    expect(result.current.dirty).toBe(false)
  })

  it('loads edit values and resets dirty against the loaded snapshot', async () => {
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        task: {
          id: 'task-1',
          org_id: 'org',
          title: 'Loaded task',
          description: 'Desc',
          status: 'active',
          due_at: null,
          is_all_day: false,
          has_due_time: false,
          reminder_enabled: false,
          reminder_at: null,
          reminder_offset_minutes: null,
          reminder_sent_at: null,
          recurrence_rule: null,
          recurrence_series_id: null,
          priority: null,
          starred: false,
          source_note_id: null,
          created_by: null,
          created_at: '',
          updated_at: '',
          completed_at: null,
          archived_at: null,
        },
      }),
    })

    const { result } = renderHook(() =>
      useTaskForm({
        open: true,
        taskId: 'task-1',
        onSuccess: vi.fn(),
      })
    )

    await waitFor(() => {
      expect(result.current.title).toBe('Loaded task')
      expect(result.current.dirty).toBe(false)
    })

    act(() => {
      result.current.setTitle('Edited task')
    })

    expect(result.current.dirty).toBe(true)
  })

  it('submits successfully and maps server errors', async () => {
    const onSuccess = vi.fn()
    mockAuthedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, task: { id: 'task-1' } }),
    })

    const { result } = renderHook(() =>
      useTaskForm({
        open: true,
        taskId: null,
        onSuccess,
      })
    )

    act(() => {
      result.current.setTitle('New task')
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(onSuccess).toHaveBeenCalled()

    mockAuthedFetch.mockReset()
    mockAuthedFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Task title is invalid.' }),
    })

    const { result: failure } = renderHook(() =>
      useTaskForm({
        open: true,
        taskId: null,
        onSuccess: vi.fn(),
      })
    )

    act(() => {
      failure.current.setTitle('Broken')
    })

    await act(async () => {
      await failure.current.handleSave()
    })

    expect(failure.current.error).toBe('Task title is invalid.')
  })
})
