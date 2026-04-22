'use client'

import type { NotesNoteRow } from '@/lib/notes/types'
import { useNotesExplorer } from '@/lib/notes/client/useNotesExplorer'
import { useState } from 'react'
import {
  buildNotesHref,
  FolderActionModal,
  FolderTile,
  normalizeNotesStatus,
  NotePreviewCard,
  NotesStatusTabs,
} from './_components'
import { useRouter, useSearchParams } from 'next/navigation'

function latestNote(notes: NotesNoteRow[]) {
  return [...notes].sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())[0] ?? null
}

export default function NotesExplorerHomePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = normalizeNotesStatus(searchParams.get('status'))
  const [manageFolders, setManageFolders] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const {
    folders,
    allNotes,
    loading,
    loadingMore,
    saving,
    error,
    hasMore,
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
    loadMore,
    modalState,
    closeModal,
    submitRename,
    submitDelete,
    beginMoveDelete,
    setDeleteTargetFolderId,
    setRenameValue,
    availableMoveTargets,
    folderNameById,
    starredNotes,
    recentNotes,
    looseNotes,
    searchResults,
  } = useNotesExplorer({ status })

  return (
    <div className="grid gap-4">
      <section className="rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-2">
            <div className="text-xs font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">
              Notes Explorer
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-white">Browse notes like a workspace</h2>
              <p className="mt-1 max-w-2xl text-sm text-neutral-400">
                Search first, skim dense previews, then open the note editor as a dedicated destination.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <NotesStatusTabs
              status={status}
              buildHref={(nextStatus) => buildNotesHref('/crm/notes/notes', nextStatus)}
            />
            <button
              type="button"
              onClick={() => setCreateFolderOpen((current) => !current)}
              className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
            >
              New Folder
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search all notes..."
            className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
          />
          <button
            type="button"
            onClick={() => setManageFolders((current) => !current)}
            className={`rounded-2xl px-4 py-3 text-sm font-extrabold transition ${
              manageFolders
                ? 'bg-emerald-400 text-neutral-950'
                : 'border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800'
            }`}
          >
            {manageFolders ? 'Done Managing Folders' : 'Manage Folders'}
          </button>
        </div>

        {createFolderOpen && (
          <div className="mt-4 grid gap-3 rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Folder name"
              className="rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
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

      {loading && <div className="text-sm text-neutral-400">Loading notes explorer...</div>}
      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
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

      {!loading && (
        <>
          <section className="grid gap-3 rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-[0.2em] text-neutral-500">Folders</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  Open folders for deeper navigation. Management stays secondary unless you turn it on.
                </p>
              </div>
              <div className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-bold text-neutral-500">
                {folders.length} folders
              </div>
            </div>

            {folders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-6 text-sm text-neutral-500">
                No folders yet. Create one or start with uncategorized notes.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {folders.map((folder, index) => {
                  const folderNotes = allNotes.filter((note) => note.folder_id === folder.id)
                  return (
                    <FolderTile
                      key={folder.id}
                      folder={folder}
                      noteCount={folderNotes.length}
                      latestNote={latestNote(folderNotes)}
                      selected={selectedFolderId === folder.id}
                      manageMode={manageFolders}
                      canMoveUp={index > 0}
                      canMoveDown={index < folders.length - 1}
                      onSelect={() => setSelectedFolderId(folder.id)}
                      onOpen={() => router.push(buildNotesHref(`/crm/notes/notes/folders/${folder.id}`, status))}
                      onRename={() => void renameFolder(folder)}
                      onDelete={() => void deleteFolder(folder)}
                      onMoveUp={() => void reorderFolder(folder.id, 'up')}
                      onMoveDown={() => void reorderFolder(folder.id, 'down')}
                    />
                  )
                })}
              </div>
            )}
          </section>

          {search.trim() ? (
            <ExplorerSection
              title="Search Results"
              description={
                searchResults.length === 0
                  ? `No notes matched "${search.trim()}".`
                  : `${searchResults.length} notes matched "${search.trim()}".`
              }
              notes={searchResults}
              selectedNoteId={selectedNoteId}
              onSelect={setSelectedNoteId}
              onOpen={(noteId) => router.push(buildNotesHref(`/crm/notes/notes/${noteId}`, status))}
              getContextLabel={(note) => (note.folder_id ? folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized')}
            />
          ) : (
            <>
              <div className="grid gap-4 xl:grid-cols-3">
                <ExplorerSection
                  title="Pinned Notes"
                  description="Starred notes that should stay in easy reach."
                  notes={starredNotes}
                  selectedNoteId={selectedNoteId}
                  onSelect={setSelectedNoteId}
                  onOpen={(noteId) => router.push(buildNotesHref(`/crm/notes/notes/${noteId}`, status))}
                  getContextLabel={(note) => (note.folder_id ? folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized')}
                />
                <ExplorerSection
                  title="Recent Notes"
                  description="Most recently updated notes across the module."
                  notes={recentNotes}
                  selectedNoteId={selectedNoteId}
                  onSelect={setSelectedNoteId}
                  onOpen={(noteId) => router.push(buildNotesHref(`/crm/notes/notes/${noteId}`, status))}
                  getContextLabel={(note) => (note.folder_id ? folderNameById.get(note.folder_id) ?? 'Folder' : 'Uncategorized')}
                />
                <ExplorerSection
                  title="Loose Notes"
                  description="Uncategorized notes that still need filing."
                  notes={looseNotes}
                  selectedNoteId={selectedNoteId}
                  onSelect={setSelectedNoteId}
                  onOpen={(noteId) => router.push(buildNotesHref(`/crm/notes/notes/${noteId}`, status))}
                  getContextLabel={() => 'Uncategorized'}
                />
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
          {search.trim() && hasMore && (
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
    </div>
  )
}

function ExplorerSection(props: {
  title: string
  description: string
  notes: NotesNoteRow[]
  selectedNoteId: string | null
  onSelect: (noteId: string) => void
  onOpen: (noteId: string) => void
  getContextLabel: (note: NotesNoteRow) => string
}) {
  return (
    <section className="grid gap-3 rounded-[30px] border border-neutral-800 bg-neutral-950 p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-extrabold text-white">{props.title}</h3>
        <p className="mt-1 text-sm text-neutral-400">{props.description}</p>
      </div>

      {props.notes.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/70 p-6 text-sm text-neutral-500">
          Nothing to show here yet.
        </div>
      ) : (
        <div className="grid gap-3">
          {props.notes.map((note) => (
            <NotePreviewCard
              key={note.id}
              note={note}
              selected={props.selectedNoteId === note.id}
              onSelect={() => props.onSelect(note.id)}
              onOpen={() => props.onOpen(note.id)}
              contextLabel={props.getContextLabel(note)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
