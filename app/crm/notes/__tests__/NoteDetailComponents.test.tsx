import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentPropsWithoutRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ConvertToTask, FolderAssignment, NoteActions, NoteEditor } from '../notes/[id]/_components'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: ComponentPropsWithoutRef<'a'> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const note = {
  id: 'note-1',
  title: 'Field note',
  body: 'Body',
  folder_id: null,
  status: 'active' as const,
  starred: false,
  created_by: null,
  created_at: '',
  updated_at: '',
  archived_at: null,
  org_id: 'org',
}

describe('Note detail components', () => {
  it('wires action buttons through NoteActions', () => {
    const onToggleEdit = vi.fn()
    const onToggleStar = vi.fn()
    const onToggleArchive = vi.fn()
    const onDelete = vi.fn()

    render(
      <NoteActions
        note={note}
        saving={false}
        editMode={false}
        backHref="/crm/notes/notes"
        onToggleEdit={onToggleEdit}
        onToggleStar={onToggleStar}
        onToggleArchive={onToggleArchive}
        onDelete={onDelete}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Star' }))
    fireEvent.click(screen.getByRole('button', { name: 'Archive' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onToggleEdit).toHaveBeenCalled()
    expect(onToggleStar).toHaveBeenCalled()
    expect(onToggleArchive).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })

  it('moves a note through FolderAssignment', () => {
    const onChangeFolderId = vi.fn()
    const onMove = vi.fn()

    render(
      <FolderAssignment
        note={note}
        folders={[{ id: 'folder-1', name: 'General', sort_order: 0, created_at: '', updated_at: '', org_id: 'org', note_count: 0 }]}
        moveFolderId=""
        saving={false}
        onChangeFolderId={onChangeFolderId}
        onMove={onMove}
      />
    )

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'folder-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move Note' }))

    expect(onChangeFolderId).toHaveBeenCalledWith('folder-1')
    expect(onMove).toHaveBeenCalled()
  })

  it('renders convert-to-task success state', () => {
    const onConvert = vi.fn()
    render(<ConvertToTask note={note} saving={false} createdTaskId="task-1" onConvert={onConvert} />)

    fireEvent.click(screen.getByRole('button', { name: 'Convert to Task' }))
    expect(onConvert).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'view task' }).getAttribute('href')).toContain('focus=task-1')
  })

  it('saves and cancels through NoteEditor', () => {
    const onTitleChange = vi.fn()
    const onBodyChange = vi.fn()
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <NoteEditor
        title="Start"
        body="Body"
        saving={false}
        onTitleChange={onTitleChange}
        onBodyChange={onBodyChange}
        onSave={onSave}
        onCancel={onCancel}
      />
    )

    fireEvent.change(screen.getByDisplayValue('Start'), { target: { value: 'Next' } })
    fireEvent.change(screen.getByDisplayValue('Body'), { target: { value: 'Updated body' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Note' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onTitleChange).toHaveBeenCalledWith('Next')
    expect(onBodyChange).toHaveBeenCalledWith('Updated body')
    expect(onSave).toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalled()
  })
})
