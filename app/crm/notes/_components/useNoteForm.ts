'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import {
  createEmptyNoteFormValues,
  noteFormValuesToPayload,
  noteResponseToFormValues,
  withAvailableFolder,
  type NotesNoteFormValues,
} from '@/lib/notes/forms/noteForm'
import { mapNotesFormServerError, useNotesFormState } from '@/lib/notes/forms/shared'
import type {
  NotesFolderWithCount,
  NotesFoldersResponse,
  NotesNoteResponse,
} from '@/lib/notes/types'
import { useEffect, useState } from 'react'

type UseNoteFormParams = {
  open: boolean
  noteId?: string | null
  folderId?: string | null
  onSuccess: (noteId: string | null) => void
}

export function useNoteForm({ open, noteId, folderId: initialFolderId, onSuccess }: UseNoteFormParams) {
  const [folders, setFolders] = useState<NotesFolderWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [initialValues, setInitialValues] = useState<NotesNoteFormValues>(createEmptyNoteFormValues(initialFolderId))
  const form = useNotesFormState({
    initialValues,
    prepareSubmit: noteFormValuesToPayload,
    onSubmit: async (payload) => {
      const res = await authedFetch(noteId ? `/api/notes/notes/${noteId}` : '/api/notes/notes', {
        method: noteId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const responsePayload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(mapNotesFormServerError(responsePayload, 'Unable to save note.'))
      }

      const note = (responsePayload as NotesNoteResponse | null)?.note ?? null
      onSuccess(note?.id ?? null)
    },
    fallbackMessage: 'Unable to save note.',
  })
  const { setError } = form

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)
      const requests = [authedFetch('/api/notes/folders', { cache: 'no-store' })]
      if (noteId) requests.push(authedFetch(`/api/notes/notes/${noteId}`, { cache: 'no-store' }))

      const responses = await Promise.all(requests)
      const foldersRes = responses[0]
      const foldersPayload = await foldersRes.json().catch(() => null)
      if (cancelled) return
      if (!foldersRes.ok) {
        setError(mapNotesFormServerError(foldersPayload, 'Unable to load folders.'))
        setLoading(false)
        return
      }
      const nextFolders = (foldersPayload as NotesFoldersResponse | null)?.folders ?? []
      setFolders(nextFolders)

      if (noteId) {
        const noteRes = responses[1]
        const notePayload = await noteRes.json().catch(() => null)
        if (!noteRes.ok) {
          setError(mapNotesFormServerError(notePayload, 'Unable to load note.'))
          setLoading(false)
          return
        }
        const values = noteResponseToFormValues(notePayload as NotesNoteResponse | null)
        if (!values) {
          setError('Note not found.')
          setLoading(false)
          return
        }
        setInitialValues(withAvailableFolder(values, nextFolders))
      } else {
        setInitialValues(withAvailableFolder(createEmptyNoteFormValues(initialFolderId), nextFolders))
      }

      setLoading(false)
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [initialFolderId, noteId, open, setError])

  const values = form.values
  const updateField = <K extends keyof NotesNoteFormValues>(field: K, value: NotesNoteFormValues[K]) => {
    form.setValues((current) => ({ ...current, [field]: value }))
  }

  return {
    folders,
    loading,
    saving: form.saving,
    error: form.error,
    dirty: form.dirty,
    title: values.title,
    setTitle: (value: string) => updateField('title', value),
    body: values.body,
    setBody: (value: string) => updateField('body', value),
    folderId: values.folderId,
    setFolderId: (value: string) => updateField('folderId', value),
    starred: values.starred,
    setStarred: (value: boolean) => updateField('starred', value),
    handleSave: form.submit,
  }
}
