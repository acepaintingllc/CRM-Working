import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteDetail } from '@/lib/notes/client/useNoteDetail'

const { mockAuthedFetch, mockPush } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
  mockPush: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}))

function notePayload(overrides: Record<string, unknown> = {}) {
  return {
    note: {
      id: 'note-1',
      title: 'Note',
      body: 'Body',
      folder_id: null,
      status: 'active',
      starred: false,
      created_by: null,
      created_at: '',
      updated_at: '',
      archived_at: null,
      org_id: 'org',
      ...overrides,
    },
  }
}

describe('useNoteDetail', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
    mockPush.mockReset()
    vi.spyOn(window, 'confirm').mockReset()
  })

  it('loads note detail and saves edits', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({ ok: true, json: async () => notePayload() })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ folders: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => notePayload({ title: 'Updated' }) })

    const { result } = renderHook(() => useNoteDetail('note-1', 'active'))

    await waitFor(() => {
      expect(result.current.note?.title).toBe('Note')
    })

    await act(async () => {
      result.current.setTitle('Updated')
      await result.current.saveEdit()
    })

    expect(result.current.note?.title).toBe('Updated')
    expect(result.current.message).toBe('Note saved.')
  })

  it('handles convert-to-task success', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({ ok: true, json: async () => notePayload() })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ folders: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ task: { id: 'task-1' } }) })

    const { result } = renderHook(() => useNoteDetail('note-1', 'active'))

    await waitFor(() => {
      expect(result.current.note?.id).toBe('note-1')
    })

    await act(async () => {
      await result.current.convertToTask()
    })

    expect(result.current.editState.createdTaskId).toBe('task-1')
    expect(result.current.message).toBe('Task created from note.')
  })

  it('archives and restores the note through the status routes', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({ ok: true, json: async () => notePayload() })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ folders: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => notePayload({ status: 'archived', archived_at: '2026-04-21T12:00:00.000Z' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => notePayload({ status: 'active', archived_at: null }) })

    const { result } = renderHook(() => useNoteDetail('note-1', 'active'))

    await waitFor(() => {
      expect(result.current.note?.status).toBe('active')
    })

    await act(async () => {
      await result.current.toggleArchive()
    })

    expect(mockAuthedFetch).toHaveBeenCalledWith('/api/notes/notes/note-1/archive', { method: 'POST' })
    expect(result.current.note?.status).toBe('archived')
    expect(result.current.message).toBe('Note archived.')

    await act(async () => {
      await result.current.toggleArchive()
    })

    expect(mockAuthedFetch).toHaveBeenCalledWith('/api/notes/notes/note-1/unarchive', { method: 'POST' })
    expect(result.current.note?.status).toBe('active')
    expect(result.current.message).toBe('Note restored.')
  })

  it('deletes after confirmation and redirects to the derived back link', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockAuthedFetch
      .mockResolvedValueOnce({ ok: true, json: async () => notePayload({ folder_id: 'folder-1' }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          folders: [
            {
              id: 'folder-1',
              name: 'General',
              sort_order: 0,
              created_at: '',
              updated_at: '',
              org_id: 'org',
              note_count: 1,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })

    const { result } = renderHook(() => useNoteDetail('note-1', 'active'))

    await waitFor(() => {
      expect(result.current.note?.folder_id).toBe('folder-1')
    })

    await act(async () => {
      await result.current.deleteNote()
    })

    expect(window.confirm).toHaveBeenCalledWith('Delete "Note"?')
    expect(mockAuthedFetch).toHaveBeenCalledWith('/api/notes/notes/note-1', { method: 'DELETE' })
    expect(mockPush).toHaveBeenCalledWith('/crm/notes/notes/folders/folder-1')
  })
})
