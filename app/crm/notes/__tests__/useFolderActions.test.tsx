import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFolderActions } from '@/lib/notes/client/useFolderActions'

const { mockAuthedFetch, mockRouterRefresh } = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
  mockRouterRefresh: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: mockRouterRefresh,
  }),
}))

const folders = [
  { id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 2 },
  { id: 'folder-2', name: 'Archive', sort_order: 1, created_at: '', updated_at: '', org_id: 'org', note_count: 0 },
]

describe('useFolderActions', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
    mockRouterRefresh.mockReset()
  })

  it('opens rename modal and submits the rename request', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mockAuthedFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, folder: { ...folders[0], name: 'Projects' } }),
    })

    const { result } = renderHook(() =>
      useFolderActions({ folders, status: 'active', refresh, activeFolderId: null, onDeleteActiveFolder: null })
    )

    act(() => {
      result.current.requestRename(folders[0]!)
      result.current.setRenameValue(' Projects ')
    })

    await act(async () => {
      await result.current.submitRename()
    })

    expect(mockAuthedFetch).toHaveBeenCalledWith('/api/notes/folders/folder-1', expect.objectContaining({
      method: 'PATCH',
    }))
    expect(refresh).toHaveBeenCalled()
    expect(result.current.modalState.open).toBe(false)
  })

  it('opens delete choice modal after a conflict response', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mockAuthedFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Conflict', required: true, notes_count: 2, strategies: ['uncategorize', 'move_to_folder'] }),
    })

    const { result } = renderHook(() =>
      useFolderActions({ folders, status: 'active', refresh, activeFolderId: null, onDeleteActiveFolder: null })
    )

    await act(async () => {
      await result.current.requestDelete(folders[0]!)
    })

    expect(result.current.modalState.open).toBe(true)
    expect(result.current.modalState.mode).toBe('delete_choice')
    expect(result.current.modalState.noteCount).toBe(2)
  })

  it('submits uncategorize delete and refreshes', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Conflict', required: true, notes_count: 2, strategies: ['uncategorize', 'move_to_folder'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, deleted_folder_id: 'folder-1' }),
      })

    const { result } = renderHook(() =>
      useFolderActions({ folders, status: 'active', refresh, activeFolderId: null, onDeleteActiveFolder: null })
    )

    await act(async () => {
      await result.current.requestDelete(folders[0]!)
    })

    await waitFor(() => {
      expect(result.current.modalState.mode).toBe('delete_choice')
    })

    await act(async () => {
      await result.current.submitDelete('uncategorize')
    })

    expect(mockAuthedFetch).toHaveBeenLastCalledWith('/api/notes/folders/folder-1', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ strategy: 'uncategorize' }),
    }))
    expect(refresh).toHaveBeenCalled()
  })

  it('requires a move target before deleting into another folder', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mockAuthedFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Conflict', required: true, notes_count: 2, strategies: ['uncategorize', 'move_to_folder'] }),
    })

    const { result } = renderHook(() =>
      useFolderActions({ folders, status: 'active', refresh, activeFolderId: null, onDeleteActiveFolder: null })
    )

    await act(async () => {
      await result.current.requestDelete(folders[0]!)
    })

    act(() => {
      result.current.beginMoveDelete()
    })

    await act(async () => {
      await result.current.submitDelete('move_to_folder')
    })

    expect(result.current.error).toBe('Select a destination folder.')
  })

  it('submits move-to-folder delete once a target is selected', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined)
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Conflict', required: true, notes_count: 2, strategies: ['uncategorize', 'move_to_folder'] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, deleted_folder_id: 'folder-1' }),
      })

    const { result } = renderHook(() =>
      useFolderActions({ folders, status: 'active', refresh, activeFolderId: null, onDeleteActiveFolder: null })
    )

    await act(async () => {
      await result.current.requestDelete(folders[0]!)
    })

    await waitFor(() => {
      expect(result.current.modalState.mode).toBe('delete_choice')
    })

    act(() => {
      result.current.beginMoveDelete()
      result.current.setDeleteTargetFolderId('folder-2')
    })

    await act(async () => {
      await result.current.submitDelete('move_to_folder')
    })

    expect(mockAuthedFetch).toHaveBeenLastCalledWith('/api/notes/folders/folder-1', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ strategy: 'move_to_folder', target_folder_id: 'folder-2' }),
    }))
    expect(refresh).toHaveBeenCalled()
  })
})
