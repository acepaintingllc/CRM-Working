'use client'

import type { NotesFolderWithCount, NotesNoteRow } from '@/lib/notes/types'
import Link from 'next/link'
import { formatNoteTimestamp, noteSnippet, NotesToolbarLink } from '../_components'

export function NoteActions(props: {
  note: NotesNoteRow | null
  saving: boolean
  editMode: boolean
  backHref: string
  onToggleEdit: () => void
  onToggleStar: () => void
  onToggleArchive: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <NotesToolbarLink href={props.backHref}>Back</NotesToolbarLink>
      <button
        type="button"
        onClick={props.onToggleEdit}
        disabled={!props.note || props.saving}
        className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-neutral-200 disabled:opacity-60"
      >
        {props.editMode ? 'Preview' : 'Edit'}
      </button>
      <button
        type="button"
        onClick={props.onToggleStar}
        disabled={!props.note || props.saving}
        className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-neutral-200 disabled:opacity-60"
      >
        {props.note?.starred ? 'Unstar' : 'Star'}
      </button>
      <button
        type="button"
        onClick={props.onToggleArchive}
        disabled={!props.note || props.saving}
        className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-neutral-200 disabled:opacity-60"
      >
        {props.note?.status === 'archived' ? 'Unarchive' : 'Archive'}
      </button>
      <button
        type="button"
        onClick={props.onDelete}
        disabled={!props.note || props.saving}
        className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-extrabold text-red-200 disabled:opacity-60"
      >
        Delete
      </button>
    </div>
  )
}

export function FolderAssignment(props: {
  note: NotesNoteRow | null
  folders: NotesFolderWithCount[]
  moveFolderId: string
  saving: boolean
  onChangeFolderId: (value: string) => void
  onMove: () => void
}) {
  return (
    <div className="grid gap-3 rounded-3xl border border-neutral-800 bg-neutral-900/70 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
      <label className="grid gap-1 text-sm font-semibold text-neutral-300">
        Move to folder
        <select
          value={props.moveFolderId}
          onChange={(event) => props.onChangeFolderId(event.target.value)}
          disabled={!props.note || props.saving}
          className="rounded-2xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
        >
          <option value="">Uncategorized</option>
          {props.folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={props.onMove}
        disabled={!props.note || props.saving}
        className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 disabled:opacity-60 lg:self-end"
      >
        Move Note
      </button>
    </div>
  )
}

export function ConvertToTask(props: {
  note: NotesNoteRow | null
  saving: boolean
  createdTaskId: string | null
  onConvert: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={props.onConvert}
        disabled={!props.note || props.saving}
        className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-neutral-200 disabled:opacity-60"
      >
        Convert to Task
      </button>
      {props.createdTaskId && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-300 shadow-sm">
          Open the new task:{' '}
          <Link
            href={`/crm/notes/tasks?focus=${encodeURIComponent(props.createdTaskId)}`}
            className="font-bold underline"
          >
            view task
          </Link>
        </div>
      )}
    </>
  )
}

export function NoteEditor(props: {
  title: string
  body: string
  saving: boolean
  onTitleChange: (value: string) => void
  onBodyChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <>
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold text-neutral-300">
          Title
          <input
            value={props.title}
            onChange={(event) => props.onTitleChange(event.target.value)}
            className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-neutral-300">
          Body
          <textarea
            value={props.body}
            onChange={(event) => props.onBodyChange(event.target.value)}
            className="min-h-80 rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={props.onSave}
        disabled={props.saving}
        className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 disabled:opacity-60"
      >
          {props.saving ? 'Saving...' : 'Save Note'}
        </button>
      <button
        type="button"
        onClick={props.onCancel}
        disabled={props.saving}
        className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-bold text-neutral-200 disabled:opacity-60"
      >
          Cancel
        </button>
      </div>
    </>
  )
}

export function NoteViewer(props: {
  note: NotesNoteRow
  folderName: string
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
        <span>{props.note.status === 'archived' ? 'Archived note' : 'Active note'}</span>
        {props.note.starred && <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-300">Starred</span>}
        <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-neutral-300">{props.folderName}</span>
      </div>
      <div className="rounded-[28px] border border-neutral-800 bg-neutral-900/70 p-6">
        {props.note.body.trim() ? (
          <div className="whitespace-pre-wrap text-sm leading-7 text-neutral-200">{props.note.body}</div>
        ) : (
          <div className="text-sm text-neutral-500">{noteSnippet(props.note.body)}</div>
        )}
      </div>
    </>
  )
}

export function NoteHeader(props: {
  note: NotesNoteRow | null
  effectiveStatus: 'active' | 'archived'
  folderName: string | null
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
        <NotesToolbarLink href={`/crm/notes/notes${props.effectiveStatus === 'archived' ? '?status=archived' : ''}`}>
          All Notes
        </NotesToolbarLink>
        {props.note?.folder_id && props.folderName && (
          <>
            <span>/</span>
            <NotesToolbarLink
              href={`/crm/notes/notes/folders/${props.note.folder_id}${props.effectiveStatus === 'archived' ? '?status=archived' : ''}`}
            >
              {props.folderName}
            </NotesToolbarLink>
          </>
        )}
        <span>/</span>
        <span className="font-bold text-neutral-200">{props.note?.title ?? 'Loading...'}</span>
      </div>

      <div>
        <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">Note Preview</div>
        <h2 className="mt-2 text-2xl font-extrabold text-white">{props.note?.title ?? 'Loading note...'}</h2>
        <p className="mt-1 text-sm text-neutral-400">
          {props.note ? `Updated ${formatNoteTimestamp(props.note.updated_at)}` : 'Loading note metadata...'}
        </p>
      </div>
    </>
  )
}
