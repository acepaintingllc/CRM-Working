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
})
