'use client'

import { useNoteDetail } from '@/lib/notes/client/useNoteDetail'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  buildNotesHref,
  formatNoteTimestamp,
  normalizeNotesStatus,
  noteSnippet,
  NotesToolbarLink,
} from '../_components'

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>()
  const noteId = typeof params?.id === 'string' ? params.id : ''
  const searchParams = useSearchParams()
  const requestedStatus = normalizeNotesStatus(searchParams.get('status'))
  const {
    note,
    folders,
    loading,
    saving,
    error,
    message,
    editState,
    setEditMode,
    setTitle,
    setBody,
    setMoveFolderId,
    saveEdit,
    moveNote,
    toggleStar,
    toggleArchive,
    deleteNote,
    convertToTask,
    derived,
  } = useNoteDetail(noteId, requestedStatus)

  return (
    <div className="grid gap-4 pb-16">
      <section className="rounded-[30px] border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--crm-muted)]">
            <NotesToolbarLink href={buildNotesHref('/crm/notes/notes', derived.effectiveStatus)}>
              All Notes
            </NotesToolbarLink>
            {note?.folder_id && (
              <>
                <span>/</span>
                <NotesToolbarLink
                  href={buildNotesHref(`/crm/notes/notes/folders/${note.folder_id}`, derived.effectiveStatus)}
                >
                  {derived.folderNameById.get(note.folder_id) ?? 'Folder'}
                </NotesToolbarLink>
              </>
            )}
            <span>/</span>
            <span className="font-bold text-[var(--crm-text)]">{note?.title ?? 'Loading...'}</span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-[var(--crm-muted)]">
                Note Preview
              </div>
              <h2 className="mt-2 text-2xl font-extrabold text-[var(--crm-text)]">
                {note?.title ?? 'Loading note...'}
              </h2>
              <p className="mt-1 text-sm text-[var(--crm-text-soft)]">
                {note
                  ? `Updated ${formatNoteTimestamp(note.updated_at)}`
                  : 'Loading note metadata...'}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <NotesToolbarLink href={derived.backHref}>Back</NotesToolbarLink>
              <button
                type="button"
                onClick={() => setEditMode((current) => !current)}
                disabled={!note || saving}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-extrabold text-[var(--crm-text)] disabled:opacity-60"
              >
                {editState.editMode ? 'Preview' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => void toggleStar()}
                disabled={!note || saving}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-extrabold text-[var(--crm-text)] disabled:opacity-60"
              >
                {note?.starred ? 'Unstar' : 'Star'}
              </button>
              <button
                type="button"
                onClick={() => void toggleArchive()}
                disabled={!note || saving}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-extrabold text-[var(--crm-text)] disabled:opacity-60"
              >
                {note?.status === 'archived' ? 'Unarchive' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={() => void convertToTask()}
                disabled={!note || saving}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-extrabold text-[var(--crm-text)] disabled:opacity-60"
              >
                Convert to Task
              </button>
              <button
                type="button"
                onClick={() => void deleteNote()}
                disabled={!note || saving}
                className="rounded-xl border border-red-200 px-3 py-2 text-sm font-extrabold text-red-700 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-gray-200 bg-gray-50 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-sm font-semibold text-[var(--crm-text-soft)]">
              Move to folder
              <select
                value={editState.moveFolderId}
                onChange={(event) => setMoveFolderId(event.target.value)}
                disabled={!note || saving}
                className="rounded-2xl border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Uncategorized</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void moveNote()}
              disabled={!note || saving}
              className="rounded-2xl bg-black px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60 lg:self-end"
            >
              Move Note
            </button>
          </div>
        </div>
      </section>

      {loading && <div className="text-sm text-gray-500">Loading note...</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {editState.createdTaskId && (
        <div className="rounded-2xl border border-gray-200 bg-white p-3 text-sm text-[var(--crm-text-soft)] shadow-sm">
          Open the new task:
          {' '}
          <Link
            href={`/crm/notes/tasks?focus=${encodeURIComponent(editState.createdTaskId)}`}
            className="font-bold underline"
          >
            view task
          </Link>
        </div>
      )}

      {!loading && !note && (
        <div className="rounded-[30px] border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Note not found.
        </div>
      )}

      {!loading && note && (
        <section className="grid gap-4 rounded-[30px] border border-gray-200 bg-white p-5 shadow-sm">
          {editState.editMode ? (
            <>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-semibold text-[var(--crm-text-soft)]">
                  Title
                  <input
                    value={editState.title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="rounded-2xl border border-gray-300 px-4 py-3 text-base"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-[var(--crm-text-soft)]">
                  Body
                  <textarea
                    value={editState.body}
                    onChange={(event) => setBody(event.target.value)}
                    className="min-h-80 rounded-2xl border border-gray-300 px-4 py-3 text-sm"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  className="rounded-2xl bg-black px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Note'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!note) return
                    setTitle(note.title)
                    setBody(note.body)
                    setEditMode(false)
                  }}
                  disabled={saving}
                  className="rounded-2xl border border-gray-300 px-4 py-3 text-sm font-bold text-[var(--crm-text)] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--crm-muted)]">
                <span>{note.status === 'archived' ? 'Archived note' : 'Active note'}</span>
                {note.starred && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">Starred</span>}
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[var(--crm-text-soft)]">
                  {note.folder_id ? derived.folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized'}
                </span>
              </div>
              <div className="rounded-[28px] border border-gray-200 bg-gray-50 p-6">
                {note.body.trim() ? (
                  <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--crm-text)]">{note.body}</div>
                ) : (
                  <div className="text-sm text-[var(--crm-muted)]">{noteSnippet(note.body)}</div>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  )
}
