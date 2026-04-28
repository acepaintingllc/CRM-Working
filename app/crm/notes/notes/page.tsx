'use client'

import type { NotesNoteRow } from '@/lib/notes/types'
import { useNotesExplorer } from '@/lib/notes/client/useNotesExplorer'
import { useState } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmEmptyState } from '@/app/crm/_components/CrmEmptyState'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSearchBar } from '@/app/crm/_components/CrmSearchBar'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'
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
      <CrmSectionCard
        eyebrow="Notes Explorer"
        title="Browse notes like a workspace"
        description="Search first, skim dense previews, then open the note editor as a dedicated destination."
        actions={
          <>
            <NotesStatusTabs
              status={status}
              buildHref={(nextStatus) => buildNotesHref('/crm/notes/notes', nextStatus)}
            />
            <CrmButton
              type="button"
              onClick={() => setCreateFolderOpen((current) => !current)}
            >
              New Folder
            </CrmButton>
          </>
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <CrmSearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search all notes..."
          />
          <CrmButton
            type="button"
            onClick={() => setManageFolders((current) => !current)}
            tone={manageFolders ? 'primary' : 'secondary'}
          >
            {manageFolders ? 'Done Managing Folders' : 'Manage Folders'}
          </CrmButton>
        </div>

        {createFolderOpen && (
          <div className="ace-crm-surface-muted mt-4 grid gap-3 border-dashed p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              placeholder="Folder name"
              className={crmInputClassName()}
            />
            <CrmButton
              type="button"
              disabled={saving}
              onClick={async () => {
                const ok = await createFolder(newFolderName)
                if (!ok) return
                setNewFolderName('')
                setCreateFolderOpen(false)
              }}
              tone="primary"
            >
              {saving ? 'Creating...' : 'Create Folder'}
            </CrmButton>
          </div>
        )}
      </CrmSectionCard>

      {loading && <CrmSectionCard title="Loading notes explorer">Loading notes explorer...</CrmSectionCard>}
      {error && (
        <CrmNotice tone="error" title="Unable to load notes explorer">
          {error}
        </CrmNotice>
      )}
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
          <CrmSectionCard
            title="Folders"
            description="Open folders for deeper navigation. Management stays secondary unless you turn it on."
            badge={<CrmChip>{folders.length} folders</CrmChip>}
          >
            {folders.length === 0 ? (
              <CrmEmptyState
                title="No folders yet"
                description="Create one or start with uncategorized notes."
                compact
              />
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
          </CrmSectionCard>

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
                  <CrmButton
                    type="button"
                    onClick={() => void loadMore()}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading...' : 'Load More Notes'}
                  </CrmButton>
                </div>
              )}
            </>
          )}
          {search.trim() && hasMore && (
            <div className="flex justify-center">
              <CrmButton
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More Notes'}
              </CrmButton>
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
    <CrmSectionCard title={props.title} description={props.description}>
      {props.notes.length === 0 ? (
        <CrmEmptyState
          title="Nothing to show"
          description="Nothing to show here yet."
          compact
        />
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
    </CrmSectionCard>
  )
}
