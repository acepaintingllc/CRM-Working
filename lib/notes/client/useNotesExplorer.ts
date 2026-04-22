'use client'

import type {
  NotesCursorPage,
  NotesExplorerSections,
  NotesFolderWithCount,
  NotesFoldersResponse,
  NotesNoteRow,
  NotesNotesResponse,
} from '@/lib/notes/types'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildNotesHref } from '@/app/crm/notes/notes/_components'
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(params.folderId ?? null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [page, setPage] = useState<NotesCursorPage>({
    next_cursor: null,
    has_more: false,
    limit: 16,
  })
  const [sections, setSections] = useState<NotesExplorerSections>({
    starred: [],
    recent: [],
    loose: [],
  })

  const loadNotes = useCallback(async (mode: 'reset' | 'append', cursor?: string | null) => {
    if (mode === 'append') {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }
    setLoadError(null)

    const noteQuery = new URLSearchParams({ status: params.status, limit: String(page.limit) })
    if (params.folderId) noteQuery.set('folder_id', params.folderId)
    if (search.trim()) noteQuery.set('search', search.trim())
    if (cursor) noteQuery.set('cursor', cursor)

    const [foldersResult, notesResult] = await Promise.all([
      notesFetchJson<NotesFoldersResponse>('/api/notes/folders', { cache: 'no-store' }, 'Unable to load folders.'),
      notesFetchJson<NotesNotesResponse>(`/api/notes/notes?${noteQuery.toString()}`, { cache: 'no-store' }, 'Unable to load notes.'),
    ])

    if (!foldersResult.ok) {
      setLoadError(foldersResult.error)
      setLoading(false)
      setLoadingMore(false)
      return
    }
    if (!notesResult.ok) {
      setLoadError(notesResult.error)
      setLoading(false)
      setLoadingMore(false)
      return
    }

    setFolders(foldersResult.data.folders)
    setAllNotes((current) => (mode === 'append' ? [...current, ...notesResult.data.notes] : notesResult.data.notes))
    setPage(notesResult.data.page ?? { next_cursor: null, has_more: false, limit: page.limit })
    if (notesResult.data.sections) {
      setSections(notesResult.data.sections)
    } else if (mode === 'reset') {
      setSections({ starred: [], recent: [], loose: [] })
    }
    setLoading(false)
    setLoadingMore(false)

    if (params.folderId) {
      setSelectedFolderId(params.folderId)
      return
    }

    setSelectedFolderId((current) => {
      if (current && foldersResult.data.folders.some((folder) => folder.id === current)) return current
      return foldersResult.data.folders[0]?.id ?? null
    })
  }, [page.limit, params.folderId, params.status, search])

  const refresh = useCallback(async () => {
    await loadNotes('reset')
  }, [loadNotes])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const loadMore = useCallback(async () => {
    if (!page.has_more || !page.next_cursor || loadingMore) return
    await loadNotes('append', page.next_cursor)
  }, [loadNotes, loadingMore, page.has_more, page.next_cursor])

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
  const notes = useMemo(() => allNotes, [allNotes])
  const folderNameById = useMemo(() => new Map(folders.map((entry) => [entry.id, entry.name])), [folders])
  const starredNotes = useMemo(() => (sections.starred.length > 0 ? sections.starred : sortByUpdated(allNotes.filter((note) => note.starred)).slice(0, 8)), [allNotes, sections.starred])
  const recentNotes = useMemo(() => (sections.recent.length > 0 ? sections.recent : sortByUpdated(allNotes).slice(0, 8)), [allNotes, sections.recent])
  const looseNotes = useMemo(
    () =>
      sections.loose.length > 0
        ? sections.loose
        : sortByUpdated(allNotes.filter((note) => note.folder_id == null && !note.starred)).slice(0, 8),
    [allNotes, sections.loose]
  )
  const searchResults = useMemo(() => sortByUpdated(notes), [notes])

  return {
    folders,
    allNotes,
    notes,
    folder,
    loading,
    loadingMore,
    saving: folderActions.saving,
    hasMore: page.has_more,
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
    loadMore,
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
