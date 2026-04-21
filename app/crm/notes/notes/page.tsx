'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useEffect, useState } from 'react'
import type { FolderRow, NoteRow } from '../_lib'
import {
  buildNotesHref,
  filterNotesBySearch,
  FolderTile,
  normalizeNotesStatus,
  NotePreviewCard,
  NotesStatusTabs,
} from './_components'
import { useRouter, useSearchParams } from 'next/navigation'

function sortByUpdated(notes: NoteRow[]) {
  return [...notes].sort((left, right) => {
    const leftTime = new Date(left.updated_at).getTime()
    const rightTime = new Date(right.updated_at).getTime()
    return rightTime - leftTime
  })
}

function latestNote(notes: NoteRow[]) {
  return sortByUpdated(notes)[0] ?? null
}

type FolderDeletePayload = {
  error?: string
  notes_count?: number
  required?: boolean
}

export default function NotesExplorerHomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = normalizeNotesStatus(searchParams.get('status'))

  const [folders, setFolders] = useState<FolderRow[]>([])
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [manageFolders, setManageFolders] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    const [foldersRes, notesRes] = await Promise.all([
      authedFetch('/api/notes/folders', { cache: 'no-store' }),
      authedFetch(`/api/notes/notes?status=${status}`, { cache: 'no-store' }),
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

    const nextFolders = (foldersPayload?.folders ?? []) as FolderRow[]
    const nextNotes = (notesPayload?.notes ?? []) as NoteRow[]
    setFolders(nextFolders)
    setNotes(nextNotes)
    setLoading(false)

    if (selectedFolderId && nextFolders.some((folder) => folder.id === selectedFolderId)) return
    setSelectedFolderId(nextFolders[0]?.id ?? null)
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const filteredNotes = filterNotesBySearch(notes, search)
  const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]))
  const starredNotes = sortByUpdated(notes.filter((note) => note.starred)).slice(0, 8)
  const recentNotes = sortByUpdated(notes).slice(0, 8)
  const looseNotes = sortByUpdated(notes.filter((note) => note.folder_id == null && !note.starred)).slice(0, 8)
  const searchResults = sortByUpdated(filteredNotes).slice(0, 16)

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

  const renameFolder = async (folder: FolderRow) => {
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

  const reorderFolder = async (folderIdValue: string, direction: 'up' | 'down') => {
    const index = folders.findIndex((folder) => folder.id === folderIdValue)
    if (index < 0) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= folders.length) return

    const reordered = [...folders]
    const [folder] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, folder)

    const res = await authedFetch('/api/notes/folders/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_ids: reordered.map((item) => item.id) }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to reorder folders.')
      return
    }

    await loadData()
  }

  const deleteFolder = async (folder: FolderRow) => {
    const firstTry = await authedFetch(`/api/notes/folders/${folder.id}`, { method: 'DELETE' })
    const firstPayload = (await firstTry.json().catch(() => null)) as FolderDeletePayload | null

    if (firstTry.ok) {
      await loadData()
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
      await loadData()
      return
    }

    const targets = folders.filter((row) => row.id !== folder.id)
    if (targets.length === 0) {
      setError('Create another folder first or use uncategorize.')
      return
    }

    const target = targets[0]
    const confirmed = window.confirm(`Move notes into "${target.name}" and delete "${folder.name}"?`)
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
    await loadData()
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">
              Notes Explorer
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Browse notes like a workspace</h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-400">
                Search first, skim dense previews, then open the note editor as a dedicated destination.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NotesStatusTabs
              status={status}
              buildHref={(nextStatus) => buildNotesHref('/crm/notes/notes', nextStatus)}
            />
            <button
              type="button"
              onClick={() => setCreateFolderOpen((current) => !current)}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
            >
              New Folder
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search all notes..."
            className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
          />
          <button
            type="button"
            onClick={() => setManageFolders((current) => !current)}
            className={`rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
              manageFolders
                ? 'bg-emerald-400 text-neutral-950'
                : 'border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800'
            }`}
          >
            {manageFolders ? 'Done Managing Folders' : 'Manage Folders'}
          </button>
        </div>

        {createFolderOpen && (
          <div className="mt-4 grid gap-3 rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Folder name"
              className="rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
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

      {loading && <div className="text-sm text-neutral-400">Loading notes explorer...</div>}
      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      {!loading && (
        <>
          <section className="grid gap-3 rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-[0.2em] text-neutral-500">Folders</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Open folders for deeper navigation. Management stays secondary unless you turn it on.
                </p>
              </div>
              <div className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-bold text-neutral-500">
                {folders.length} folders
              </div>
            </div>

            {folders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-6 text-sm text-neutral-500">
                No folders yet. Create one or start with uncategorized notes.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {folders.map((folder, index) => {
                  const folderNotes = notes.filter((note) => note.folder_id === folder.id)
                  return (
                    <FolderTile
                      key={folder.id}
                      folder={folder}
                      noteCount={folderNotes.length}
                      latestNote={latestNote(folderNotes)}
                      selected={selectedFolderId === folder.id}
                      manageMode={manageFolders}
                      canMoveUp={index > 0}
                      canMoveDown={index < folders.length - 1}
                      onSelect={() => setSelectedFolderId(folder.id)}
                      onOpen={() => router.push(buildNotesHref(`/crm/notes/notes/folders/${folder.id}`, status))}
                      onRename={() => void renameFolder(folder)}
                      onDelete={() => void deleteFolder(folder)}
                      onMoveUp={() => void reorderFolder(folder.id, 'up')}
                      onMoveDown={() => void reorderFolder(folder.id, 'down')}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {search.trim() ? (
            <ExplorerSection
              title="Search Results"
              description={
                searchResults.length === 0
                  ? `No notes matched "${search.trim()}".`
                  : `${searchResults.length} notes matched "${search.trim()}".`
              }
              notes={searchResults}
              selectedNoteId={selectedNoteId}
              onSelect={setSelectedNoteId}
              onOpen={(noteId) => router.push(buildNotesHref(`/crm/notes/notes/${noteId}`, status))}
              getContextLabel={(note) => note.folder_id ? folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized'}
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-3">
              <ExplorerSection
                title="Pinned Notes"
                description="Starred notes that should stay in easy reach."
                notes={starredNotes}
                selectedNoteId={selectedNoteId}
                onSelect={setSelectedNoteId}
                onOpen={(noteId) => router.push(buildNotesHref(`/crm/notes/notes/${noteId}`, status))}
                getContextLabel={(note) => note.folder_id ? folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized'}
              />
              <ExplorerSection
                title="Recent Notes"
                description="Most recently updated notes across the module."
                notes={recentNotes}
                selectedNoteId={selectedNoteId}
                onSelect={setSelectedNoteId}
                onOpen={(noteId) => router.push(buildNotesHref(`/crm/notes/notes/${noteId}`, status))}
                getContextLabel={(note) => note.folder_id ? folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized'}
              />
              <ExplorerSection
                title="Loose Notes"
                description="Uncategorized notes that still need filing."
                notes={looseNotes}
                selectedNoteId={selectedNoteId}
                onSelect={setSelectedNoteId}
                onOpen={(noteId) => router.push(buildNotesHref(`/crm/notes/notes/${noteId}`, status))}
                getContextLabel={() => 'Uncategorized'}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ExplorerSection(props: {
  title: string
  description: string
  notes: NoteRow[]
  selectedNoteId: string | null
  onSelect: (noteId: string) => void
  onOpen: (noteId: string) => void
  getContextLabel: (note: NoteRow) => string
}) {
  return (
    <section className="grid gap-3 rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-extrabold text-white">{props.title}</h3>
        <p className="mt-1 text-sm text-neutral-400">{props.description}</p>
      </div>

      {props.notes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-6 text-sm text-neutral-500">
          Nothing to show here yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {props.notes.map((note) => (
            <NotePreviewCard
              key={note.id}
              note={note}
              selected={props.selectedNoteId === note.id}
              onSelect={() => props.onSelect(note.id)}
              onOpen={() => props.onOpen(note.id)}
              contextLabel={props.getContextLabel(note)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
