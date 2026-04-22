import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NotesExplorerHomePage from '../notes/page'

const { mockUseSearchParams, mockUseRouter, mockUseNotesExplorer } = vi.hoisted(() => ({
  mockUseSearchParams: vi.fn(),
  mockUseRouter: vi.fn(),
  mockUseNotesExplorer: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: mockUseSearchParams,
  useRouter: mockUseRouter,
}))

vi.mock('@/lib/notes/client/useNotesExplorer', () => ({
  useNotesExplorer: mockUseNotesExplorer,
}))

describe('NotesExplorerHomePage', () => {
  it('renders the shared folder action modal', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockUseRouter.mockReturnValue({ push: vi.fn() })
    mockUseNotesExplorer.mockReturnValue({
      folders: [],
      allNotes: [],
      notes: [],
      loading: false,
      loadingMore: false,
      saving: false,
      hasMore: true,
      error: null,
      search: '',
      setSearch: vi.fn(),
      selectedFolderId: null,
      setSelectedFolderId: vi.fn(),
      selectedNoteId: null,
      setSelectedNoteId: vi.fn(),
      createFolder: vi.fn(),
      renameFolder: vi.fn(),
      reorderFolder: vi.fn(),
      deleteFolder: vi.fn(),
      loadMore: vi.fn(),
      folderNameById: new Map(),
      starredNotes: [],
      recentNotes: [],
      looseNotes: [],
      searchResults: [],
      modalState: {
        open: true,
        mode: 'rename',
        folder: { id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 0 },
        renameValue: 'General',
        deleteTargetFolderId: '',
        noteCount: 0,
      },
      closeModal: vi.fn(),
      submitRename: vi.fn(),
      submitDelete: vi.fn(),
      beginMoveDelete: vi.fn(),
      setDeleteTargetFolderId: vi.fn(),
      setRenameValue: vi.fn(),
      availableMoveTargets: [],
    })

    render(<NotesExplorerHomePage />)

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Rename Folder')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Load More Notes' })).toBeTruthy()
  })
})
