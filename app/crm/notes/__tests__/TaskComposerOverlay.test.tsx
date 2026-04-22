import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskComposerOverlay } from '../_components/TaskComposer'

const {
  mockAuthedFetch,
  mockReplace,
  mockRefresh,
} = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}))

vi.mock('@/lib/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/lib/hooks/useLockBodyScroll', () => ({
  useLockBodyScroll: vi.fn(),
}))

describe('TaskComposerOverlay', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
    mockReplace.mockReset()
    mockRefresh.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('submits the create flow and closes through the existing success navigation', async () => {
    mockAuthedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, task: { id: 'task-1' } }),
    })

    render(<TaskComposerOverlay open closeHref="/crm/notes/tasks" />)

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: '  Follow up vendor  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create Task' }))

    await waitFor(() => {
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        '/api/notes/tasks',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      )
    })

    const [, options] = mockAuthedFetch.mock.calls[0]!
    expect(JSON.parse(options.body as string)).toEqual(
      expect.objectContaining({
        title: 'Follow up vendor',
      })
    )
    expect(mockReplace).toHaveBeenCalledWith('/crm/notes/tasks')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('loads edit state, keeps save disabled while pristine, and submits once dirty', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, task: { id: 'task-1' } }),
      })

    render(<TaskComposerOverlay open taskId="task-1" closeHref="/crm/notes/tasks" />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Loaded task')).toBeTruthy()
    })

    const saveButton = screen.getByRole('button', { name: 'Save Task' }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)

    fireEvent.change(screen.getByDisplayValue('Loaded task'), {
      target: { value: 'Edited task' },
    })

    expect(saveButton.disabled).toBe(false)
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        '/api/notes/tasks/task-1',
        expect.objectContaining({
          method: 'PATCH',
          body: expect.any(String),
        })
      )
    })

    const [, patchOptions] = mockAuthedFetch.mock.calls[1]!
    expect(JSON.parse(patchOptions.body as string)).toEqual(
      expect.objectContaining({
        title: 'Edited task',
      })
    )
    expect(mockReplace).toHaveBeenCalledWith('/crm/notes/tasks')
    expect(mockRefresh).toHaveBeenCalled()
  })
})
