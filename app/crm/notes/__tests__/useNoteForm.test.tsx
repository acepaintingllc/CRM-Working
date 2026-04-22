import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteForm } from '../_components/useNoteForm'

const { mockAuthedFetch } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

describe('useNoteForm', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
  })

  it('uses create defaults from the requested folder', async () => {
    mockAuthedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ folders: [{ id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 0 }] }),
    })

    const { result } = renderHook(() =>
      useNoteForm({
        open: true,
        noteId: null,
        folderId: 'folder-1',
        onSuccess: vi.fn(),
      })
    )

    await waitFor(() => {
      expect(result.current.folderId).toBe('folder-1')
      expect(result.current.dirty).toBe(false)
    })
  })

  it('loads edit values and resets dirty after load', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folders: [{ id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 0 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          note: {
            id: 'note-1',
            org_id: 'org',
            title: 'Loaded note',
            body: 'Body',
            folder_id: 'folder-1',
            status: 'active',
            starred: true,
            created_by: null,
            created_at: '',
            updated_at: '',
            archived_at: null,
          },
        }),
      })

    const { result } = renderHook(() =>
      useNoteForm({
        open: true,
        noteId: 'note-1',
        folderId: null,
        onSuccess: vi.fn(),
      })
    )

    await waitFor(() => {
      expect(result.current.title).toBe('Loaded note')
      expect(result.current.dirty).toBe(false)
    })

    act(() => {
      result.current.setBody('Changed body')
    })

    expect(result.current.dirty).toBe(true)
  })

  it('submits successfully and maps server validation errors', async () => {
    const onSuccess = vi.fn()
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folders: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, note: { id: 'note-1' } }),
      })

    const { result } = renderHook(() =>
      useNoteForm({
        open: true,
        noteId: null,
        folderId: null,
        onSuccess,
      })
    )

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    act(() => {
      result.current.setTitle('New note')
    })

    await act(async () => {
      await result.current.handleSave()
    })

    expect(onSuccess).toHaveBeenCalledWith('note-1')

    mockAuthedFetch.mockReset()
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folders: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Note title is invalid.' }),
      })

    const { result: failure } = renderHook(() =>
      useNoteForm({
        open: true,
        noteId: null,
        folderId: null,
        onSuccess: vi.fn(),
      })
    )

    await waitFor(() => {
      expect(failure.current.loading).toBe(false)
    })

    act(() => {
      failure.current.setTitle('Broken note')
    })

    await act(async () => {
      await failure.current.handleSave()
    })

    expect(failure.current.error).toBe('Note title is invalid.')
  })
})
