'use client'

import { useNotesExplorer } from '@/lib/notes/client/useNotesExplorer'
import { useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  buildNotesHref,
  FolderActionModal,
  normalizeNotesStatus,
  NotePreviewCard,
  NotesStatusTabs,
  NotesToolbarLink,
} from '../../_components'

export default function FolderNotesPage() {
  const params = useParams<{ id: string }>()
  const folderId = typeof params?.id === 'string' ? params.id : ''
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = normalizeNotesStatus(searchParams.get('status'))
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const {
    folder,
    notes,
    loading,
    loadingMore,
    saving,
    error,
    hasMore,
    search,
    setSearch,
    selectedNoteId,
    setSelectedNoteId,
    createFolder,
    renameFolder,
    deleteFolder,
    loadMore,
    modalState,
    closeModal,
    submitRename,
    submitDelete,
    beginMoveDelete,
    setDeleteTargetFolderId,
    setRenameValue,
    availableMoveTargets,
  } = useNotesExplorer({ status, folderId })

  return (
    <div className="grid gap-4">
      <section className="rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">
              Folder Browser
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <NotesToolbarLink href={buildNotesHref('/crm/notes/notes', status)}>
                All Notes
              </NotesToolbarLink>
              <span>/</span>
              <span className="font-bold text-white">{folder?.name ?? 'Loading...'}</span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">{folder?.name ?? 'Folder'}</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Scan previews first, then open the note you want to review or edit.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NotesStatusTabs
              status={status}
              buildHref={(nextStatus) =>
                buildNotesHref(`/crm/notes/notes/folders/${folderId}`, nextStatus)
              }
            />
            <button
              type="button"
              onClick={() => setCreateFolderOpen((current) => !current)}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800"
            >
              New Folder
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => folder && void renameFolder(folder)}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-sm font-bold text-neutral-200"
          >
            Rename Folder
          </button>
          <button
            type="button"
            onClick={() => folder && void deleteFolder(folder)}
            className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700"
          >
            Delete Folder
          </button>
        </div>

        <div className="mt-4">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search inside this folder..."
            className="w-full rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white"
          />
        </div>

        {createFolderOpen && (
          <div className="mt-4 grid gap-3 rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Folder name"
              className="rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white"
            />
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                const ok = await createFolder(newFolderName)
                if (!ok) return
                setNewFolderName('')
                setCreateFolderOpen(false)
              }}
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 disabled:opacity-60"
            >
              {saving ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        )}
      </section>

      {loading && <div className="text-sm text-neutral-400">Loading folder...</div>}
      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
      <FolderActionModal
        open={modalState.open}
        mode={modalState.mode}
        folderName={modalState.folder?.name ?? ''}
        renameValue={modalState.renameValue}
        noteCount={modalState.noteCount}
        availableMoveTargets={availableMoveTargets}
        selectedMoveTargetId={modalState.deleteTargetFolderId}
        saving={saving}
        error={error}
        onClose={closeModal}
        onRenameValueChange={setRenameValue}
        onSelectedMoveTargetIdChange={setDeleteTargetFolderId}
        onSubmitRename={() => void submitRename()}
        onChooseUncategorize={() => void submitDelete('uncategorize')}
        onChooseMove={beginMoveDelete}
        onSubmitMove={() => void submitDelete('move_to_folder')}
      />

      {!loading && !folder && (
        <div className="rounded-[30px] border border-neutral-800 bg-neutral-950 p-6 text-sm text-neutral-400 shadow-sm">
          Folder not found.
        </div>
      )}

      {!loading && folder && (
        <section className="grid gap-4 rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-white">Notes in {folder.name}</h3>
              <p className="mt-1 text-sm text-neutral-400">
                {notes.length} {notes.length === 1 ? 'note' : 'notes'} in this view.
              </p>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-6 text-sm text-neutral-500">
              {search.trim()
                ? 'No notes in this folder match the current search.'
                : 'No notes in this folder yet.'}
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {notes.map((note) => (
                  <NotePreviewCard
                    key={note.id}
                    note={note}
                    selected={selectedNoteId === note.id}
                    onSelect={() => setSelectedNoteId(note.id)}
                    onOpen={() => router.push(buildNotesHref(`/crm/notes/notes/${note.id}`, status))}
                  />
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-extrabold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {loadingMore ? 'Loading...' : 'Load More Notes'}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
