'use client'

import { buildNotesHref } from '@/app/crm/notes/notes/_components'
import { authedFetch } from '@/lib/auth/authedFetch'
import type {
  NotesConvertToTaskResponse,
  NotesFolderWithCount,
  NotesFoldersResponse,
  NotesNoteResponse,
  NotesNoteRow,
} from '@/lib/notes/types'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { notesFetchJson, useNotesMutation } from './core'

type RequestedStatus = 'active' | 'archived'

export function useNoteDetail(noteId: string, requestedStatus: RequestedStatus) {
  const router = useRouter()
  const [note, setNote] = useState<NotesNoteRow | null>(null)
  const [folders, setFolders] = useState<NotesFolderWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [moveFolderId, setMoveFolderId] = useState('')
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null)
  const { saving, runMutation } = useNotesMutation()

  const refresh = useCallback(async () => {
    if (!noteId) return
    setLoading(true)
    setError(null)

    const [noteResult, foldersResult] = await Promise.all([
      notesFetchJson<NotesNoteResponse>(`/api/notes/notes/${noteId}`, { cache: 'no-store' }, 'Unable to load note.'),
      notesFetchJson<NotesFoldersResponse>('/api/notes/folders', { cache: 'no-store' }, 'Unable to load folders.'),
    ])

    if (!noteResult.ok) {
      setError(noteResult.error)
      setLoading(false)
      return
    }
    if (!foldersResult.ok) {
      setError(foldersResult.error)
      setLoading(false)
      return
    }

    setNote(noteResult.data.note)
    setFolders(foldersResult.data.folders)
    setTitle(noteResult.data.note.title)
    setBody(noteResult.data.note.body)
    setMoveFolderId(noteResult.data.note.folder_id ?? '')
    setLoading(false)
  }, [noteId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const derived = useMemo(() => {
    const effectiveStatus = note?.status ?? requestedStatus
    const folderNameById = new Map(folders.map((folder) => [folder.id, folder.name]))
    const backHref = note?.folder_id
      ? buildNotesHref(`/crm/notes/notes/folders/${note.folder_id}`, effectiveStatus)
      : buildNotesHref('/crm/notes/notes', effectiveStatus)

    return {
      effectiveStatus,
      folderNameById,
      backHref,
    }
  }, [folders, note, requestedStatus])

  const patchNote = useCallback(
    async (patch: Record<string, unknown>, successMessage: string) => {
      if (!note) return false
      setError(null)
      setMessage(null)
      const result = await runMutation<NotesNoteResponse>(
        () =>
          authedFetch(`/api/notes/notes/${note.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          }),
        {
          fallbackMessage: 'Unable to update note.',
          onError: setError,
          onSuccess: ({ note: updatedNote }) => {
            setNote(updatedNote)
            setTitle(updatedNote.title)
            setBody(updatedNote.body)
            setMoveFolderId(updatedNote.folder_id ?? '')
            setMessage(successMessage)
          },
        }
      )
      return result.ok
    },
    [note, runMutation]
  )

  const saveEdit = useCallback(async () => {
    if (!note) return false
    const ok = await patchNote({ title: title.trim(), body }, 'Note saved.')
    if (ok) setEditMode(false)
    return ok
  }, [body, note, patchNote, title])

  const moveNote = useCallback(async () => patchNote({ folder_id: moveFolderId || null }, 'Note moved.'), [moveFolderId, patchNote])
  const toggleStar = useCallback(async () => (note ? patchNote({ starred: !note.starred }, note.starred ? 'Star removed.' : 'Note starred.') : false), [note, patchNote])

  const toggleArchive = useCallback(async () => {
    if (!note) return false
    setError(null)
    setMessage(null)
    const route =
      note.status === 'active'
        ? `/api/notes/notes/${note.id}/archive`
        : `/api/notes/notes/${note.id}/unarchive`

    const result = await runMutation<NotesNoteResponse>(
      () => authedFetch(route, { method: 'POST' }),
      {
        fallbackMessage: 'Unable to update note status.',
        onError: setError,
        onSuccess: ({ note: updatedNote }) => {
          setNote(updatedNote)
          setMessage(updatedNote.status === 'archived' ? 'Note archived.' : 'Note restored.')
        },
      }
    )
    return result.ok
  }, [note, runMutation])

  const deleteNote = useCallback(async () => {
    if (!note) return false
    const confirmed = window.confirm(`Delete "${note.title}"?`)
    if (!confirmed) return false

    setError(null)
    setMessage(null)
    const result = await runMutation<unknown>(
      () => authedFetch(`/api/notes/notes/${note.id}`, { method: 'DELETE' }),
      {
        fallbackMessage: 'Unable to delete note.',
        onError: setError,
        onSuccess: async () => {
          router.push(derived.backHref)
        },
      }
    )
    return result.ok
  }, [derived.backHref, note, router, runMutation])

  const convertToTask = useCallback(async () => {
    if (!note) return false
    setError(null)
    setMessage(null)
    setCreatedTaskId(null)

    const result = await runMutation<NotesConvertToTaskResponse>(
      () =>
        authedFetch(`/api/notes/notes/${note.id}/convert-to-task`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ carry_body: true }),
        }),
      {
        fallbackMessage: 'Unable to convert note to task.',
        onError: setError,
        onSuccess: (payload) => {
          setCreatedTaskId(payload.task?.id ?? null)
          setMessage('Task created from note.')
        },
      }
    )
    return result.ok
  }, [note, runMutation])

  return {
    note,
    folders,
    loading,
    saving,
    error,
    message,
    editState: {
      editMode,
      title,
      body,
      moveFolderId,
      createdTaskId,
    },
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
    refresh,
    derived,
  }
}
