'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [folderId, setFolderId] = useState(initialFolderId ?? '')
  const [starred, setStarred] = useState(false)

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
        setError(foldersPayload?.error ?? 'Unable to load folders.')
        setLoading(false)
        return
      }
      setFolders((foldersPayload as NotesFoldersResponse | null)?.folders ?? [])

      if (noteId) {
        const noteRes = responses[1]
        const notePayload = await noteRes.json().catch(() => null)
        if (!noteRes.ok) {
          setError(notePayload?.error ?? 'Unable to load note.')
          setLoading(false)
          return
        }
        const note = (notePayload as NotesNoteResponse | null)?.note ?? null
        if (!note) {
          setError('Note not found.')
          setLoading(false)
          return
        }
        setTitle(note.title)
        setBody(note.body)
        setFolderId(note.folder_id ?? '')
        setStarred(note.starred)
      } else {
        setTitle('')
        setBody('')
        setFolderId(initialFolderId ?? '')
        setStarred(false)
      }

      setLoading(false)
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [initialFolderId, noteId, open])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Note title is required.')
      return
    }

    setSaving(true)
    setError(null)
    const res = await authedFetch(noteId ? `/api/notes/notes/${noteId}` : '/api/notes/notes', {
      method: noteId ? 'PATCH' : 'POST',
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
      setError(payload?.error ?? 'Unable to save note.')
      return
    }

    const note = (payload as NotesNoteResponse | null)?.note ?? null
    onSuccess(note?.id ?? null)
  }

  return {
    folders,
    loading,
    saving,
    error,
    title,
    setTitle,
    body,
    setBody,
    folderId,
    setFolderId,
    starred,
    setStarred,
    handleSave,
  }
}
