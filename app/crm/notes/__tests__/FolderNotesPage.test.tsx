import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FolderNotesPage from '../notes/folders/[id]/page'

const { mockUseParams, mockUseSearchParams, mockUseRouter, mockUseNotesExplorer } = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockUseSearchParams: vi.fn(),
  mockUseRouter: vi.fn(),
  mockUseNotesExplorer: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: mockUseParams,
  useSearchParams: mockUseSearchParams,
  useRouter: mockUseRouter,
}))

vi.mock('@/lib/notes/client/useNotesExplorer', () => ({
  useNotesExplorer: mockUseNotesExplorer,
}))

describe('FolderNotesPage', () => {
  it('renders the shared delete strategy modal', () => {
    mockUseParams.mockReturnValue({ id: 'folder-1' })
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
    mockUseRouter.mockReturnValue({ push: vi.fn() })
    mockUseNotesExplorer.mockReturnValue({
      folder: { id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 0 },
      folders: [],
      notes: [],
      loading: false,
      saving: false,
      error: null,
      search: '',
      setSearch: vi.fn(),
      selectedNoteId: null,
      setSelectedNoteId: vi.fn(),
      createFolder: vi.fn(),
      renameFolder: vi.fn(),
      deleteFolder: vi.fn(),
      modalState: {
        open: true,
        mode: 'delete_choice',
        folder: { id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 3 },
        renameValue: 'General',
        deleteTargetFolderId: '',
        noteCount: 3,
      },
      closeModal: vi.fn(),
      submitRename: vi.fn(),
      submitDelete: vi.fn(),
      beginMoveDelete: vi.fn(),
      setDeleteTargetFolderId: vi.fn(),
      setRenameValue: vi.fn(),
      availableMoveTargets: [],
    })

    render(<FolderNotesPage />)

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Delete Folder' })).toBeTruthy()
    expect(screen.getByText(/still contains 3 notes/i)).toBeTruthy()
  })
})
