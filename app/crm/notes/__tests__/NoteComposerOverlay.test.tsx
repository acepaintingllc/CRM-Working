import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteComposerOverlay } from '../_components/NoteComposer'

const {
  mockAuthedFetch,
  mockPush,
  mockRefresh,
  mockReplace,
} = vi.hoisted(() => ({
  mockAuthedFetch: vi.fn(),
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockReplace: vi.fn(),
}))

vi.mock('@/lib/auth/authedFetch', () => ({
  authedFetch: mockAuthedFetch,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: mockReplace,
  }),
}))

vi.mock('@/lib/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}))

vi.mock('@/lib/hooks/useLockBodyScroll', () => ({
  useLockBodyScroll: vi.fn(),
}))

describe('NoteComposerOverlay', () => {
  beforeEach(() => {
    mockAuthedFetch.mockReset()
    mockPush.mockReset()
    mockRefresh.mockReset()
    mockReplace.mockReset()
  })

  it('submits the create flow with the selected folder and navigates to the new note', async () => {
    mockAuthedFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          folders: [
            { id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 0 },
            { id: 'folder-2', name: 'Projects', sort_order: 1, created_at: '', updated_at: '', org_id: 'org', note_count: 0 },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, note: { id: 'note-1' } }),
      })

    render(<NoteComposerOverlay open folderId="folder-1" closeHref="/crm/notes/notes" />)

    const folderSelect = (await screen.findByLabelText('Folder')) as HTMLSelectElement
    await waitFor(() => {
      expect(folderSelect.value).toBe('folder-1')
    })

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: '  CRM idea  ' },
    })
    fireEvent.change(screen.getByLabelText('Body'), {
      target: { value: 'Capture the migration notes.' },
    })
    fireEvent.change(folderSelect, {
      target: { value: 'folder-2' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create Note' }))

    await waitFor(() => {
      expect(mockAuthedFetch).toHaveBeenCalledWith(
        '/api/notes/notes',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String),
        })
      )
    })

    const [, options] = mockAuthedFetch.mock.calls[1]!
    expect(JSON.parse(options.body as string)).toEqual({
      title: 'CRM idea',
      body: 'Capture the migration notes.',
      folder_id: 'folder-2',
      starred: false,
    })
    expect(mockRefresh).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/crm/notes/notes/note-1')
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
