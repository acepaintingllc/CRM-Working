'use client'

import { useNoteDetail } from '@/lib/notes/client/useNoteDetail'
import { useParams, useSearchParams } from 'next/navigation'
import {
  normalizeNotesStatus,
} from '../_components'
import {
  NoteActions,
  ConvertToTask,
  FolderAssignment,
  NoteEditor,
  NoteHeader,
  NoteViewer,
} from './_components'

export default function NoteDetailPage() {
  const params = useParams<{ id: string }>()
  const noteId = typeof params?.id === 'string' ? params.id : ''
  const searchParams = useSearchParams()
  const requestedStatus = normalizeNotesStatus(searchParams.get('status'))
  const {
    note,
    folders,
    loading,
    saving,
    error,
    message,
    editState,
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
    derived,
  } = useNoteDetail(noteId, requestedStatus)
  const folderName = note?.folder_id ? derived.folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized'

  return (
    <div className="grid gap-4 pb-16">
      <section className="rounded-[30px] border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3">
          <NoteHeader note={note} effectiveStatus={derived.effectiveStatus} folderName={note?.folder_id ? folderName : null} />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <NoteActions
                note={note}
                saving={saving}
                editMode={editState.editMode}
                backHref={derived.backHref}
                onToggleEdit={() => setEditMode((current) => !current)}
                onToggleStar={() => void toggleStar()}
                onToggleArchive={() => void toggleArchive()}
                onDelete={() => void deleteNote()}
              />
              <ConvertToTask
                note={note}
                saving={saving}
                createdTaskId={editState.createdTaskId}
                onConvert={() => void convertToTask()}
              />
            </div>
          </div>

          <FolderAssignment
            note={note}
            folders={folders}
            moveFolderId={editState.moveFolderId}
            saving={saving}
            onChangeFolderId={setMoveFolderId}
            onMove={() => void moveNote()}
          />
        </div>
      </section>

      {loading && <div className="text-sm text-gray-500">Loading note...</div>}
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}

      {!loading && !note && (
        <div className="rounded-[30px] border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Note not found.
        </div>
      )}

      {!loading && note && (
        <section className="grid gap-4 rounded-[30px] border border-gray-200 bg-white p-5 shadow-sm">
          {editState.editMode ? (
            <NoteEditor
              title={editState.title}
              body={editState.body}
              saving={saving}
              onTitleChange={setTitle}
              onBodyChange={setBody}
              onSave={() => void saveEdit()}
              onCancel={() => {
                if (!note) return
                setTitle(note.title)
                setBody(note.body)
                setEditMode(false)
              }}
            />
          ) : (
            <NoteViewer note={note} folderName={folderName} />
          )}
        </section>
      )}
    </div>
  )
}
