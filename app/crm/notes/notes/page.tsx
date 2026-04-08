'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { FolderRow, NoteRow } from '../_lib'

type StatusFilter = 'active' | 'archived'

export default function NotesListPage() {
  const [status, setStatus] = useState<StatusFilter>('active')
  const [folderFilter, setFolderFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [notes, setNotes] = useState<NoteRow[]>([])
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editId, setEditId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [folderId, setFolderId] = useState('')
  const [starred, setStarred] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newFolderName, setNewFolderName] = useState('')
  const [folderSaving, setFolderSaving] = useState(false)

  const loadFolders = async () => {
    const res = await authedFetch('/api/notes/folders', { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    if (res.ok) {
      setFolders((payload?.folders ?? []) as FolderRow[])
    }
  }

  const loadNotes = async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    params.set('status', status)
    if (folderFilter !== 'all') params.set('folder_id', folderFilter)
    if (search.trim()) params.set('search', search.trim())
    const res = await authedFetch(`/api/notes/notes?${params.toString()}`, { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to load notes.')
      setLoading(false)
      return
    }
    setNotes((payload?.notes ?? []) as NoteRow[])
    setLoading(false)
  }

  useEffect(() => {
    void loadFolders()
  }, [])

  useEffect(() => {
    void loadNotes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, folderFilter])

  useEffect(() => {
    const timer = setTimeout(() => void loadNotes(), 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const folderNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const folder of folders) map.set(folder.id, folder.name)
    return map
  }, [folders])

  const openEditor = (note: NoteRow) => {
    setEditId(note.id)
    setTitle(note.title)
    setBody(note.body)
    setFolderId(note.folder_id ?? '')
    setStarred(note.starred)
  }

  const saveNote = async () => {
    if (!editId) return
    setSaving(true)
    const res = await authedFetch(`/api/notes/notes/${editId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        body,
        folder_id: folderId || null,
        starred,
      }),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to update note.')
      return
    }
    setEditId(null)
    await loadNotes()
  }

  const runAction = async (
    path: string,
    method: 'POST' | 'DELETE' | 'PATCH' = 'POST',
    bodyPayload?: Record<string, unknown>
  ) => {
    const res = await authedFetch(path, {
      method,
      headers: bodyPayload ? { 'Content-Type': 'application/json' } : undefined,
      body: bodyPayload ? JSON.stringify(bodyPayload) : undefined,
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Action failed.')
      return false
    }
    await Promise.all([loadNotes(), loadFolders()])
    return true
  }

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    setFolderSaving(true)
    const ok = await runAction('/api/notes/folders', 'POST', { name: newFolderName.trim() })
    setFolderSaving(false)
    if (ok) setNewFolderName('')
  }

  const renameFolder = async (folder: FolderRow) => {
    const nextName = window.prompt('Rename folder', folder.name)
    if (!nextName || !nextName.trim()) return
    await runAction(`/api/notes/folders/${folder.id}`, 'PATCH', { name: nextName.trim() })
  }

  const reorderFolder = async (folderIdValue: string, direction: 'up' | 'down') => {
    const index = folders.findIndex((folder) => folder.id === folderIdValue)
    if (index < 0) return
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= folders.length) return
    const copy = [...folders]
    const [item] = copy.splice(index, 1)
    copy.splice(targetIndex, 0, item)
    const ids = copy.map((folder) => folder.id)
    await runAction('/api/notes/folders/reorder', 'POST', { folder_ids: ids })
  }

  const deleteFolder = async (folder: FolderRow) => {
    if ((folder.note_count ?? 0) <= 0) {
      await runAction(`/api/notes/folders/${folder.id}`, 'DELETE')
      return
    }

    const uncategorize = window.confirm(
      `Folder "${folder.name}" has ${folder.note_count} notes. Press OK to move them to uncategorized before deleting. Press Cancel to choose a different folder.`
    )
    if (uncategorize) {
      await runAction(`/api/notes/folders/${folder.id}`, 'DELETE', { strategy: 'uncategorize' })
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
    await runAction(`/api/notes/folders/${folder.id}`, 'DELETE', {
      strategy: 'move_to_folder',
      target_folder_id: target.id,
    })
  }

  return (
    <div className="grid gap-4 pb-14">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(['active', 'archived'] as StatusFilter[]).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-xl px-3 py-2 text-sm font-extrabold ${
                status === value ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
          <Link href="/crm/notes/quick-add" className="ml-auto rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold">
            Quick Add
          </Link>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={folderFilter}
            onChange={(event) => setFolderFilter(event.target.value)}
            className="rounded-xl border border-gray-300 px-3 py-2"
          >
            <option value="all">All folders</option>
            <option value="uncategorized">Uncategorized</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes..."
            className="rounded-xl border border-gray-300 px-3 py-2"
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-gray-600">Folders</h2>
        <div className="flex gap-2">
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            className="flex-1 rounded-xl border border-gray-300 px-3 py-2"
            placeholder="New folder name"
          />
          <button disabled={folderSaving} onClick={() => void createFolder()} className="rounded-xl bg-black px-3 py-2 text-sm font-extrabold text-white">
            Add
          </button>
        </div>
        <div className="grid gap-2">
          {folders.length === 0 && <div className="text-sm text-gray-500">No folders yet.</div>}
          {folders.map((folder) => (
            <div key={folder.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <div className="min-w-0 flex-1 text-sm font-bold text-gray-900">
                {folder.name} <span className="font-normal text-gray-500">({folder.note_count ?? 0})</span>
              </div>
              <button onClick={() => void reorderFolder(folder.id, 'up')} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold">↑</button>
              <button onClick={() => void reorderFolder(folder.id, 'down')} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold">↓</button>
              <button onClick={() => void renameFolder(folder)} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold">Rename</button>
              <button onClick={() => void deleteFolder(folder)} className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700">
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>

      {editId && (
        <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold text-gray-900">Edit Note</h2>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2" />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="min-h-32 rounded-xl border border-gray-300 px-3 py-2"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={folderId} onChange={(event) => setFolderId(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2">
              <option value="">Uncategorized</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={starred} onChange={(event) => setStarred(event.target.checked)} />
              <span>Starred</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} onClick={() => void saveNote()} className="rounded-xl bg-black px-4 py-2 text-sm font-extrabold text-white">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setEditId(null)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold">Cancel</button>
          </div>
        </section>
      )}

      {loading && <div className="text-sm text-gray-500">Loading notes...</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && (
        <section className="grid gap-2">
          {notes.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">No notes found.</div>}
          {notes.map((note) => (
            <article key={note.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold text-gray-900">
                    {note.starred ? '★ ' : ''}
                    {note.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    Folder: {note.folder_id ? folderNameById.get(note.folder_id) ?? 'Unknown' : 'Uncategorized'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openEditor(note)} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold">
                    Edit
                  </button>
                  {note.status === 'active' ? (
                    <button onClick={() => void runAction(`/api/notes/notes/${note.id}/archive`)} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold">
                      Archive
                    </button>
                  ) : (
                    <button onClick={() => void runAction(`/api/notes/notes/${note.id}/unarchive`)} className="rounded border border-gray-300 px-2 py-1 text-xs font-bold">
                      Unarchive
                    </button>
                  )}
                  <button onClick={() => void runAction(`/api/notes/notes/${note.id}`, 'DELETE')} className="rounded border border-red-200 px-2 py-1 text-xs font-bold text-red-700">
                    Delete
                  </button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{note.body || 'No content.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    void runAction(`/api/notes/notes/${note.id}/convert-to-task`, 'POST', { carry_body: true })
                  }
                  className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-bold"
                >
                  Convert to Task
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
