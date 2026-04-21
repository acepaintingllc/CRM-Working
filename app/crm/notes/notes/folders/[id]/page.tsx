'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import type { FolderRow, NoteRow } from '../../../_lib'
import {
  buildNotesHref,
  filterNotesBySearch,
  normalizeNotesStatus,
  NotePreviewCard,
  NotesStatusTabs,
  NotesToolbarLink,
} from '../../_components'

type FolderDeletePayload = {
  error?: string
  notes_count?: number
  required?: boolean
}

export default function FolderNotesPage() {
  const params = useParams<{ id: string }>()
  const folderId = typeof params?.id === 'string' ? params.id : ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = normalizeNotesStatus(searchParams.get('status'))

  const [folders, setFolders] = useState<FolderRow[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)

  const loadData = async () => {
    if (!folderId) return

    setLoading(true)
    setError(null)

    const [foldersRes, notesRes] = await Promise.all([
      authedFetch('/api/notes/folders', { cache: 'no-store' }),
      authedFetch(`/api/notes/notes?status=${status}&folder_id=${folderId}`, { cache: 'no-store' }),
    ])

    const foldersPayload = await foldersRes.json().catch(() => null)
    const notesPayload = await notesRes.json().catch(() => null)

    if (!foldersRes.ok) {
      setError(foldersPayload?.error ?? 'Unable to load folders.')
      setLoading(false)
      return
    }
    if (!notesRes.ok) {
      setError(notesPayload?.error ?? 'Unable to load notes.')
      setLoading(false)
      return
    }

    setFolders((foldersPayload?.folders ?? []) as FolderRow[])
    setNotes((notesPayload?.notes ?? []) as NoteRow[])
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId, status])

  const folder = folders.find((item) => item.id === folderId) ?? null
  const filteredNotes = filterNotesBySearch(notes, search)

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    setFolderSaving(true)
    setError(null)
    const res = await authedFetch('/api/notes/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newFolderName.trim() }),
    })
    const payload = await res.json().catch(() => null)
    setFolderSaving(false)

    if (!res.ok) {
      setError(payload?.error ?? 'Unable to create folder.')
      return
    }

    setNewFolderName('')
    setCreateFolderOpen(false)
    await loadData()
  }

  const renameFolder = async () => {
    if (!folder) return
    const nextName = window.prompt('Rename folder', folder.name)
    if (!nextName || !nextName.trim()) return

    const res = await authedFetch(`/api/notes/folders/${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nextName.trim() }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to rename folder.')
      return
    }

    await loadData()
  }

  const deleteFolder = async () => {
    if (!folder) return

    const firstTry = await authedFetch(`/api/notes/folders/${folder.id}`, { method: 'DELETE' })
    const firstPayload = (await firstTry.json().catch(() => null)) as FolderDeletePayload | null

    if (firstTry.ok) {
      router.push(buildNotesHref('/crm/notes/notes', status))
      return
    }

    if (firstTry.status !== 409 || !firstPayload?.required) {
      setError(firstPayload?.error ?? 'Unable to delete folder.')
      return
    }

    const noteCount = firstPayload.notes_count ?? 0
    const uncategorize = window.confirm(
      `Folder "${folder.name}" has ${noteCount} notes. Press OK to move them to uncategorized before deleting. Press Cancel to choose another folder.`
    )

    if (uncategorize) {
      const res = await authedFetch(`/api/notes/folders/${folder.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: 'uncategorize' }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? 'Unable to delete folder.')
        return
      }
      router.push(buildNotesHref('/crm/notes/notes', status))
      return
    }

    const targets = folders.filter((row) => row.id !== folder.id)
    if (targets.length === 0) {
      setError('Create another folder first or use uncategorize.')
      return
    }

    const target = targets[0]
    const confirmed = window.confirm(
      `Move notes into "${target.name}" and delete "${folder.name}"?`
    )
    if (!confirmed) return

    const res = await authedFetch(`/api/notes/folders/${folder.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: 'move_to_folder', target_folder_id: target.id }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to delete folder.')
      return
    }

    router.push(buildNotesHref('/crm/notes/notes', status))
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">
              Folder Browser
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <NotesToolbarLink href={buildNotesHref('/crm/notes/notes', status)}>
                All Notes
              </NotesToolbarLink>
              <span>/</span>
              <span className="font-bold text-white">{folder?.name ?? 'Loading...'}</span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">{folder?.name ?? 'Folder'}</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Scan previews first, then open the note you want to review or edit.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NotesStatusTabs
              status={status}
              buildHref={(nextStatus) =>
                buildNotesHref(`/crm/notes/notes/folders/${folderId}`, nextStatus)
              }
            />
            <button
              type="button"
              onClick={() => setCreateFolderOpen((current) => !current)}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800"
            >
              New Folder
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void renameFolder()}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-sm font-bold text-neutral-200"
          >
            Rename Folder
          </button>
          <button
            type="button"
            onClick={() => void deleteFolder()}
            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700"
          >
            Delete Folder
          </button>
        </div>

        <div className="mt-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search inside this folder..."
            className="w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white"
          />
        </div>

        {createFolderOpen && (
          <div className="mt-4 grid gap-3 rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Folder name"
              className="rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white"
            />
            <button
              type="button"
              disabled={folderSaving}
              onClick={() => void createFolder()}
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 disabled:opacity-60"
            >
              {folderSaving ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        )}
      </section>

      {loading && <div className="text-sm text-neutral-400">Loading folder...</div>}
      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

      {!loading && !folder && (
        <div className="rounded-[30px] border border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-400 shadow-sm">
          Folder not found.
        </div>
      )}

      {!loading && folder && (
        <section className="grid gap-4 rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-white">Notes in {folder.name}</h3>
              <p className="mt-1 text-sm text-neutral-400">
                {filteredNotes.length} {filteredNotes.length === 1 ? 'note' : 'notes'} in this view.
              </p>
            </div>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-6 text-sm text-neutral-500">
              {search.trim()
                ? 'No notes in this folder match the current search.'
                : 'No notes in this folder yet.'}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredNotes.map((note) => (
                <NotePreviewCard
                  key={note.id}
                  note={note}
                  selected={selectedNoteId === note.id}
                  onSelect={() => setSelectedNoteId(note.id)}
                  onOpen={() => router.push(buildNotesHref(`/crm/notes/notes/${note.id}`, status))}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
