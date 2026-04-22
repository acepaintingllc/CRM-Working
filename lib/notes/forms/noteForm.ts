import type { NotesFolderWithCount, NotesNoteResponse, NotesNoteRow } from '../types.ts'
import type { NotesFormSubmitResult } from './shared.ts'

export type NotesNoteFormValues = {
  title: string
  body: string
  folderId: string
  starred: boolean
}

export type NotesNoteUpsertPayload = {
  title: string
  body: string
  folder_id: string | null
  starred: boolean
}

export function createEmptyNoteFormValues(folderId?: string | null): NotesNoteFormValues {
  return {
    title: '',
    body: '',
    folderId: folderId ?? '',
    starred: false,
  }
}

export function noteRowToFormValues(note: NotesNoteRow): NotesNoteFormValues {
  return {
    title: note.title,
    body: note.body,
    folderId: note.folder_id ?? '',
    starred: note.starred,
  }
}

export function noteResponseToFormValues(payload: NotesNoteResponse | null) {
  return payload?.note ? noteRowToFormValues(payload.note) : null
}

export function noteFormValuesToPayload(values: NotesNoteFormValues): NotesFormSubmitResult<NotesNoteUpsertPayload> {
  if (!values.title.trim()) {
    return { ok: false, error: 'Note title is required.' }
  }

  return {
    ok: true,
    payload: {
      title: values.title.trim(),
      body: values.body,
      folder_id: values.folderId || null,
      starred: values.starred,
    },
  }
}

export function withAvailableFolder(values: NotesNoteFormValues, folders: NotesFolderWithCount[]) {
  if (!values.folderId) return values
  return folders.some((folder) => folder.id === values.folderId)
    ? values
    : { ...values, folderId: '' }
}
