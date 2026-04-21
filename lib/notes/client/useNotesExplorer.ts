'use client'

import type {
  NotesFolderWithCount,
  NotesFoldersResponse,
  NotesNoteRow,
  NotesNotesResponse,
} from '@/lib/notes/types'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildNotesHref, filterNotesBySearch } from '@/app/crm/notes/notes/_components'
import { notesFetchJson } from './core'
import { useFolderActions } from './useFolderActions'

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
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(params.folderId ?? null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const noteQuery = new URLSearchParams({ status: params.status })
    if (params.folderId) noteQuery.set('folder_id', params.folderId)

    const [foldersResult, notesResult] = await Promise.all([
      notesFetchJson<NotesFoldersResponse>('/api/notes/folders', { cache: 'no-store' }, 'Unable to load folders.'),
      notesFetchJson<NotesNotesResponse>(`/api/notes/notes?${noteQuery.toString()}`, { cache: 'no-store' }, 'Unable to load notes.'),
    ])

    if (!foldersResult.ok) {
      setLoadError(foldersResult.error)
      setLoading(false)
      return
    }
    if (!notesResult.ok) {
      setLoadError(notesResult.error)
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

  const folderActions = useFolderActions({
    folders,
    status: params.status,
    activeFolderId: params.folderId ?? null,
    refresh,
    onDeleteActiveFolder: params.folderId
      ? async () => {
          router.push(buildNotesHref('/crm/notes/notes', params.status))
        }
      : null,
  })

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
    saving: folderActions.saving,
    error: loadError ?? folderActions.error,
    search,
    setSearch,
    selectedFolderId,
    setSelectedFolderId,
    selectedNoteId,
    setSelectedNoteId,
    createFolder: folderActions.createFolder,
    renameFolder: folderActions.requestRename,
    reorderFolder: folderActions.reorderFolder,
    deleteFolder: folderActions.deleteFolder,
    refresh,
    folderNameById,
    starredNotes,
    recentNotes,
    looseNotes,
    searchResults,
    requestRename: folderActions.requestRename,
    requestDelete: folderActions.requestDelete,
    modalState: folderActions.modalState,
    closeModal: folderActions.closeModal,
    submitRename: folderActions.submitRename,
    submitDelete: folderActions.submitDelete,
    beginMoveDelete: folderActions.beginMoveDelete,
    setDeleteTargetFolderId: folderActions.setDeleteTargetFolderId,
    setRenameValue: folderActions.setRenameValue,
    availableMoveTargets: folderActions.availableMoveTargets,
  }
}
