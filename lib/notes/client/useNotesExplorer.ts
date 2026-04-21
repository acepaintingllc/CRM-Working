'use client'

import type {
  NotesFolderDeleteResponse,
  NotesFolderWithCount,
  NotesFoldersResponse,
  NotesNoteRow,
  NotesNotesResponse,
} from '@/lib/notes/types'
import { authedFetch } from '@/lib/auth/authedFetch'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildNotesHref, filterNotesBySearch } from '@/app/crm/notes/notes/_components'
import { notesFetchJson, useNotesMutation } from './core'

type Params = {
  status: 'active' | 'archived'
  folderId?: string | null
}

function sortByUpdated(notes: NotesNoteRow[]) {
  return [...notes].sort((left, right) => {
    const leftTime = new Date(left.updated_at).getTime()
    const rightTime = new Date(right.updated_at).getTime()
    return rightTime - leftTime
  })
}

export function useNotesExplorer(params: Params) {
  const router = useRouter()
  const [folders, setFolders] = useState<NotesFolderWithCount[]>([])
  const [allNotes, setAllNotes] = useState<NotesNoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(params.folderId ?? null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const { saving, runMutation } = useNotesMutation()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    const noteQuery = new URLSearchParams({ status: params.status })
    if (params.folderId) noteQuery.set('folder_id', params.folderId)

    const [foldersResult, notesResult] = await Promise.all([
      notesFetchJson<NotesFoldersResponse>('/api/notes/folders', { cache: 'no-store' }, 'Unable to load folders.'),
      notesFetchJson<NotesNotesResponse>(`/api/notes/notes?${noteQuery.toString()}`, { cache: 'no-store' }, 'Unable to load notes.'),
    ])

    if (!foldersResult.ok) {
      setError(foldersResult.error)
      setLoading(false)
      return
    }
    if (!notesResult.ok) {
      setError(notesResult.error)
      setLoading(false)
      return
    }

    setFolders(foldersResult.data.folders)
    setAllNotes(notesResult.data.notes)
    setLoading(false)

    if (params.folderId) {
      setSelectedFolderId(params.folderId)
      return
    }

    setSelectedFolderId((current) => {
      if (current && foldersResult.data.folders.some((folder) => folder.id === current)) return current
      return foldersResult.data.folders[0]?.id ?? null
    })
  }, [params.folderId, params.status])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mutate = useCallback(
    async <T>(
      request: () => Promise<Response>,
      fallbackMessage: string,
      onSuccess?: ((data: T) => Promise<void> | void) | null
    ) => {
      setError(null)
      const result = await runMutation<T>(request, {
        fallbackMessage,
        refresh: onSuccess ? null : refresh,
        onSuccess,
        onError: setError,
      })
      return result.ok
    },
    [refresh, runMutation]
  )

  const createFolder = useCallback(
    async (name: string) => {
      if (!name.trim()) return false
      return mutate(
        () =>
          authedFetch('/api/notes/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim() }),
          }),
        'Unable to create folder.'
      )
    },
    [mutate]
  )

  const renameFolder = useCallback(
    async (folder: NotesFolderWithCount) => {
      const nextName = window.prompt('Rename folder', folder.name)
      if (!nextName || !nextName.trim()) return false
      return mutate(
        () =>
          authedFetch(`/api/notes/folders/${folder.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nextName.trim() }),
          }),
        'Unable to rename folder.'
      )
    },
    [mutate]
  )

  const reorderFolder = useCallback(
    async (folderIdValue: string, direction: 'up' | 'down') => {
      const index = folders.findIndex((folder) => folder.id === folderIdValue)
      if (index < 0) return false

      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= folders.length) return false

      const reordered = [...folders]
      const [folder] = reordered.splice(index, 1)
      reordered.splice(targetIndex, 0, folder)

      return mutate(
        () =>
          authedFetch('/api/notes/folders/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder_ids: reordered.map((item) => item.id) }),
          }),
        'Unable to reorder folders.'
      )
    },
    [folders, mutate]
  )

  const deleteFolder = useCallback(
    async (folder: NotesFolderWithCount) => {
      setError(null)
      const firstTry = await notesFetchJson<NotesFolderDeleteResponse>(
        `/api/notes/folders/${folder.id}`,
        { method: 'DELETE' },
        'Unable to delete folder.'
      )

      if (firstTry.ok) {
        if (params.folderId === folder.id) {
          router.push(buildNotesHref('/crm/notes/notes', params.status))
          return true
        }
        await refresh()
        return true
      }

      const firstPayload = firstTry.payload as NotesFolderDeleteResponse | null
      if (!firstPayload?.required) {
        setError(firstTry.error)
        return false
      }

      const noteCount = firstPayload.notes_count ?? 0
      const uncategorize = window.confirm(
        `Folder "${folder.name}" has ${noteCount} notes. Press OK to move them to uncategorized before deleting. Press Cancel to choose another folder.`
      )

      if (uncategorize) {
        const ok = await mutate(
          () =>
            authedFetch(`/api/notes/folders/${folder.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ strategy: 'uncategorize' }),
            }),
          'Unable to delete folder.',
          params.folderId === folder.id
            ? async () => {
                router.push(buildNotesHref('/crm/notes/notes', params.status))
              }
            : null
        )
        return ok
      }

      const targets = folders.filter((row) => row.id !== folder.id)
      if (targets.length === 0) {
        setError('Create another folder first or use uncategorize.')
        return false
      }

      const target = targets[0]
      const confirmed = window.confirm(`Move notes into "${target.name}" and delete "${folder.name}"?`)
      if (!confirmed) return false

      return mutate(
        () =>
          authedFetch(`/api/notes/folders/${folder.id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ strategy: 'move_to_folder', target_folder_id: target.id }),
          }),
        'Unable to delete folder.',
        params.folderId === folder.id
          ? async () => {
              router.push(buildNotesHref('/crm/notes/notes', params.status))
            }
          : null
      )
    },
    [folders, mutate, params.folderId, params.status, refresh, router]
  )

  const folder = useMemo(
    () => (params.folderId ? folders.find((item) => item.id === params.folderId) ?? null : null),
    [folders, params.folderId]
  )
  const notes = useMemo(() => filterNotesBySearch(allNotes, search), [allNotes, search])
  const folderNameById = useMemo(() => new Map(folders.map((entry) => [entry.id, entry.name])), [folders])
  const starredNotes = useMemo(() => sortByUpdated(allNotes.filter((note) => note.starred)).slice(0, 8), [allNotes])
  const recentNotes = useMemo(() => sortByUpdated(allNotes).slice(0, 8), [allNotes])
  const looseNotes = useMemo(
    () => sortByUpdated(allNotes.filter((note) => note.folder_id == null && !note.starred)).slice(0, 8),
    [allNotes]
  )
  const searchResults = useMemo(() => sortByUpdated(notes).slice(0, 16), [notes])

  return {
    folders,
    allNotes,
    notes,
    folder,
    loading,
    saving,
    error,
    search,
    setSearch,
    selectedFolderId,
    setSelectedFolderId,
    selectedNoteId,
    setSelectedNoteId,
    createFolder,
    renameFolder,
    reorderFolder,
    deleteFolder,
    refresh,
    folderNameById,
    starredNotes,
    recentNotes,
    looseNotes,
    searchResults,
  }
}
