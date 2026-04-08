'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import type { FolderRow, NoteRow } from '../../_lib'
import {
  buildNotesHref,
  formatNoteTimestamp,
  normalizeNotesStatus,
  noteSnippet,
  NotesToolbarLink,
} from '../_components'

type ConvertToTaskPayload = {
  error?: string
  task?: {
    id: string
  }
}

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>()
  const noteId = typeof params?.id === 'string' ? params.id : ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const requestedStatus = normalizeNotesStatus(searchParams.get('status'))

  const [note, setNote] = useState<NoteRow | null>(null)
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [moveFolderId, setMoveFolderId] = useState('')
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)

  const loadData = async () => {
    if (!noteId) return

    setLoading(true)
    setError(null)

    const [noteRes, foldersRes] = await Promise.all([
      authedFetch(`/api/notes/notes/${noteId}`, { cache: 'no-store' }),
      authedFetch('/api/notes/folders', { cache: 'no-store' }),
    ])

    const notePayload = await noteRes.json().catch(() => null)
    const foldersPayload = await foldersRes.json().catch(() => null)

    if (!noteRes.ok) {
      setError(notePayload?.error ?? 'Unable to load note.')
      setLoading(false)
      return
    }
    if (!foldersRes.ok) {
      setError(foldersPayload?.error ?? 'Unable to load folders.')
      setLoading(false)
      return
    }

    const loadedNote = notePayload?.note as NoteRow
    setNote(loadedNote)
    setFolders((foldersPayload?.folders ?? []) as FolderRow[])
    setTitle(loadedNote.title)
    setBody(loadedNote.body)
    setMoveFolderId(loadedNote.folder_id ?? '')
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  const effectiveStatus = note?.status ?? requestedStatus
  const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]))
  const backHref = note?.folder_id
    ? buildNotesHref(`/crm/notes/notes/folders/${note.folder_id}`, effectiveStatus)
    : buildNotesHref('/crm/notes/notes', effectiveStatus)

  const patchNote = async (patch: Record<string, unknown>, successMessage: string) => {
    if (!note) return false

    setSaving(true)
    setError(null)
    setMessage(null)

    const res = await authedFetch(`/api/notes/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)

    if (!res.ok) {
      setError(payload?.error ?? 'Unable to update note.')
      return false
    }

    const updatedNote = payload?.note as NoteRow
    setNote(updatedNote)
    setTitle(updatedNote.title)
    setBody(updatedNote.body)
    setMoveFolderId(updatedNote.folder_id ?? '')
    setMessage(successMessage)
    return true
  }

  const saveEdit = async () => {
    if (!note) return
    const ok = await patchNote(
      {
        title: title.trim(),
        body,
      },
      'Note saved.'
    )
    if (ok) setEditMode(false)
  }

  const moveNote = async () => {
    await patchNote({ folder_id: moveFolderId || null }, 'Note moved.')
  }

  const toggleStar = async () => {
    if (!note) return
    await patchNote({ starred: !note.starred }, note.starred ? 'Star removed.' : 'Note starred.')
  }

  const toggleArchive = async () => {
    if (!note) return

    setSaving(true)
    setError(null)
    setMessage(null)

    const route =
      note.status === 'active'
        ? `/api/notes/notes/${note.id}/archive`
        : `/api/notes/notes/${note.id}/unarchive`

    const res = await authedFetch(route, { method: 'POST' })
    const payload = await res.json().catch(() => null)
    setSaving(false)

    if (!res.ok) {
      setError(payload?.error ?? 'Unable to update note status.')
      return
    }

    const updatedNote = payload?.note as NoteRow
    setNote(updatedNote)
    setMessage(updatedNote.status === 'archived' ? 'Note archived.' : 'Note restored.')
  }

  const deleteNote = async () => {
    if (!note) return
    const confirmed = window.confirm(`Delete "${note.title}"?`)
    if (!confirmed) return

    setSaving(true)
    setError(null)
    setMessage(null)

    const res = await authedFetch(`/api/notes/notes/${note.id}`, { method: 'DELETE' })
    const payload = await res.json().catch(() => null)
    setSaving(false)

    if (!res.ok) {
      setError(payload?.error ?? 'Unable to delete note.')
      return
    }

    router.push(backHref)
  }

  const convertToTask = async () => {
    if (!note) return

    setSaving(true)
    setError(null)
    setMessage(null)
    setCreatedTaskId(null)

    const res = await authedFetch(`/api/notes/notes/${note.id}/convert-to-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ carry_body: true }),
    })
    const payload = (await res.json().catch(() => null)) as ConvertToTaskPayload | null
    setSaving(false)

    if (!res.ok) {
      setError(payload?.error ?? 'Unable to convert note to task.')
      return
    }

    setCreatedTaskId(payload?.task?.id ?? null)
    setMessage('Task created from note.')
  }

  return (
    <div className="grid gap-4 pb-16">
      <section className="rounded-[30px] border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--crm-muted)]">
            <NotesToolbarLink href={buildNotesHref('/crm/notes/notes', effectiveStatus)}>
              All Notes
            </NotesToolbarLink>
            {note?.folder_id && (
              <>
                <span>/</span>
                <NotesToolbarLink
                  href={buildNotesHref(`/crm/notes/notes/folders/${note.folder_id}`, effectiveStatus)}
                >
                  {folderNameById.get(note.folder_id) ?? 'Folder'}
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
              <NotesToolbarLink href={backHref}>Back</NotesToolbarLink>
              <button
                type="button"
                onClick={() => setEditMode((current) => !current)}
                disabled={!note || saving}
                className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-extrabold text-[var(--crm-text)] disabled:opacity-60"
              >
                {editMode ? 'Preview' : 'Edit'}
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
                value={moveFolderId}
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
      {createdTaskId && (
        <div className="rounded-2xl border border-gray-200 bg-white p-3 text-sm text-[var(--crm-text-soft)] shadow-sm">
          Open the new task:
          {' '}
          <Link
            href={`/crm/notes/tasks?focus=${encodeURIComponent(createdTaskId)}`}
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
          {editMode ? (
            <>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm font-semibold text-[var(--crm-text-soft)]">
                  Title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="rounded-2xl border border-gray-300 px-4 py-3 text-base"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-[var(--crm-text-soft)]">
                  Body
                  <textarea
                    value={body}
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
                  {note.folder_id ? folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized'}
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
