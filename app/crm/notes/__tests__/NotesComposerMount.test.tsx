import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesComposerMount } from '../_components/NotesComposerMount'

const { mockUsePathname, mockUseSearchParams } = vi.hoisted(() => ({
  mockUsePathname: vi.fn(),
  mockUseSearchParams: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
  useSearchParams: mockUseSearchParams,
}))

vi.mock('../_components/TaskComposer', () => ({
  TaskComposerOverlay: ({ open }: { open: boolean }) => (open ? <div>task composer mounted</div> : null),
}))

vi.mock('../_components/NoteComposer', () => ({
  NoteComposerOverlay: ({ open }: { open: boolean }) => (open ? <div>note composer mounted</div> : null),
}))

describe('NotesComposerMount', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/crm/notes')
  })

  afterEach(() => {
    cleanup()
  })

  it('mounts the task composer when composer=task', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('composer=task&taskId=task-1'))

    render(<NotesComposerMount />)

    expect(screen.getByText('task composer mounted')).toBeTruthy()
    expect(screen.queryByText('note composer mounted')).toBeNull()
  })

  it('mounts the note composer when composer=note', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('composer=note&noteId=note-1'))

    render(<NotesComposerMount />)

    expect(screen.getByText('note composer mounted')).toBeTruthy()
    expect(screen.queryByText('task composer mounted')).toBeNull()
  })

  it('mounts neither composer when query param is missing', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams())

    render(<NotesComposerMount />)

    expect(screen.queryByText('task composer mounted')).toBeNull()
    expect(screen.queryByText('note composer mounted')).toBeNull()
  })
})
