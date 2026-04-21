import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotesExplorer } from '@/lib/notes/client/useNotesExplorer'

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

describe('useNotesExplorer', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
    mockPush.mockReset()
    vi.spyOn(window, 'confirm').mockReset()
    vi.spyOn(window, 'prompt').mockReset()
  })

  it('loads folders and notes together', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folders: [{ id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 1 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notes: [{ id: 'note-1', title: 'Note', body: 'Body', folder_id: 'folder-1', status: 'active', starred: false, created_by: null, created_at: '', updated_at: '', archived_at: null, org_id: 'org' }], filters: { status: 'active', folder_id: null, search: '' } }),
      })

    const { result } = renderHook(() => useNotesExplorer({ status: 'active' }))

    await waitFor(() => {
      expect(result.current.folders.length).toBe(1)
      expect(result.current.notes.length).toBe(1)
    })
  })

  it('handles the folder delete cascade and refreshes local data', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folders: [{ id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 1 }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notes: [{ id: 'note-1', title: 'Note', body: 'Body', folder_id: 'folder-1', status: 'active', starred: false, created_by: null, created_at: '', updated_at: '', archived_at: null, org_id: 'org' }], filters: { status: 'active', folder_id: null, search: '' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Conflict', required: true, notes_count: 1 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ folders: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notes: [], filters: { status: 'active', folder_id: null, search: '' } }),
      })

    const { result } = renderHook(() => useNotesExplorer({ status: 'active' }))

    await waitFor(() => {
      expect(result.current.folders.length).toBe(1)
    })

    await act(async () => {
      await result.current.deleteFolder(result.current.folders[0]!)
    })

    await waitFor(() => {
      expect(result.current.folders.length).toBe(0)
    })
  })
})
