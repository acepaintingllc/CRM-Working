'use client'

import type { NotesFolderWithCount, NotesNoteRow } from '@/lib/notes/types'
import { useLockBodyScroll } from '@/lib/hooks/useLockBodyScroll'
import Link from 'next/link'
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { EllipsisVertical, FileText, Folder, FolderOpen, Star } from 'lucide-react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmChip } from '@/app/crm/_components/CrmChip'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmModalHeader } from '@/app/crm/_components/CrmModalHeader'
import { CrmModalSection } from '@/app/crm/_components/CrmModalSection'
import { CrmModalShell } from '@/app/crm/_components/CrmModalShell'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { crmInputClassName } from '@/app/crm/_components/crmStyles'

export type NotesBrowserStatus = 'active' | 'archived'

export function normalizeNotesStatus(value: string | null | undefined): NotesBrowserStatus {
  return value === 'archived' ? 'archived' : 'active'
}

export function buildNotesHref(
  path: string,
  status: NotesBrowserStatus,
  extraParams?: Record<string, string | null | undefined>
) {
  const params = new URLSearchParams()
  if (status === 'archived') params.set('status', status)
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function noteSnippet(body: string, fallback = 'No content yet.') {
  const compact = body.replace(/\s+/g, ' ').trim()
  return compact || fallback
}

export function formatNoteTimestamp(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Unknown update time'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function groupNotesByFolder(notes: NotesNoteRow[]) {
  const map = new Map<string, NotesNoteRow[]>()
  for (const note of notes) {
    if (!note.folder_id) continue
    const existing = map.get(note.folder_id) ?? []
    existing.push(note)
    map.set(note.folder_id, existing)
  }
  return map
}

function useCoarsePointer() {
  const [coarsePointer, setCoarsePointer] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(pointer: coarse)')
    const sync = () => setCoarsePointer(media.matches)
    sync()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }
    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  return coarsePointer
}

function handleExplorerKeyDown(
  event: ReactKeyboardEvent<HTMLElement>,
  onSelect: () => void,
  onOpen: () => void
) {
  if (event.key === 'Enter') {
    event.preventDefault()
    onOpen()
    return
  }
  if (event.key === ' ') {
    event.preventDefault()
    onSelect()
  }
}

function OverflowMenu(props: { label: string; children: ReactNode }) {
  return (
    <details className="relative">
      <summary
        className="ace-crm-btn ace-crm-btn-secondary flex size-9 cursor-pointer list-none items-center justify-center p-0 [&::-webkit-details-marker]:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <EllipsisVertical size={16} aria-hidden="true" />
        <span className="sr-only">{props.label}</span>
      </summary>
      <div
        className="ace-crm-surface absolute right-0 top-11 z-20 min-w-40 p-1.5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {props.children}
      </div>
    </details>
  )
}

function MenuButton(props: {
  variant?: 'default' | 'danger'
  children: ReactNode
  onClick: () => void
}) {
  const color =
    props.variant === 'danger'
      ? 'text-[color:var(--crm-ui-danger-text)] hover:bg-[color:var(--crm-ui-danger-bg)]'
      : 'text-[color:var(--crm-ui-text)] hover:bg-[color:var(--crm-ui-surface-muted)]'

  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-semibold ${color}`}
    >
      {props.children}
    </button>
  )
}

export function NotesStatusTabs(props: {
  status: NotesBrowserStatus
  buildHref: (status: NotesBrowserStatus) => string
}) {
  return (
    <div className="ace-crm-surface-muted inline-flex rounded-2xl p-1">
      {(['active', 'archived'] as NotesBrowserStatus[]).map((value) => (
        <Link
          key={value}
          href={props.buildHref(value)}
          aria-current={props.status === value ? 'page' : undefined}
          className={`rounded-xl px-3 py-2 text-sm font-extrabold no-underline transition ${
            props.status === value
              ? 'bg-[color:var(--crm-ui-accent)] text-black shadow-sm'
              : 'text-[color:var(--crm-ui-muted)] hover:text-[color:var(--crm-ui-text)]'
          }`}
        >
          {value === 'active' ? 'Active' : 'Archived'}
        </Link>
      ))}
    </div>
  )
}

export function NotesToolbarLink(props: {
  href: string
  primary?: boolean
  children: ReactNode
}) {
  return (
    <CrmButton href={props.href} tone={props.primary ? 'primary' : 'secondary'}>
      {props.children}
    </CrmButton>
  )
}

export function FolderTile(props: {
  folder: NotesFolderWithCount
  noteCount: number
  latestNote: NotesNoteRow | null
  selected: boolean
  manageMode: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onSelect: () => void
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const coarsePointer = useCoarsePointer()

  return (
    <article
      className={`ace-crm-surface relative p-5 transition ${
        props.selected
          ? 'border-[color:var(--crm-ui-accent-border)] ring-2 ring-[color:var(--crm-ui-accent-border)]'
          : 'hover:border-[color:var(--crm-ui-accent-border)]'
      }`}
    >
      <div className="absolute right-4 top-4">
        <OverflowMenu label={`Folder actions for ${props.folder.name}`}>
          <MenuButton onClick={props.onRename}>Rename</MenuButton>
          <MenuButton variant="danger" onClick={props.onDelete}>
            Delete
          </MenuButton>
        </OverflowMenu>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (coarsePointer) {
            props.onOpen()
            return
          }
          props.onSelect()
        }}
        onDoubleClick={props.onOpen}
        onKeyDown={(event) => handleExplorerKeyDown(event, props.onSelect, props.onOpen)}
        className="grid gap-4 pr-12 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="ace-crm-surface-muted inline-flex size-14 items-center justify-center text-[color:var(--crm-ui-accent)]">
            {props.selected ? <FolderOpen size={28} aria-hidden="true" /> : <Folder size={28} aria-hidden="true" />}
          </div>
          <CrmChip className="text-xs">
            {props.noteCount} {props.noteCount === 1 ? 'note' : 'notes'}
          </CrmChip>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-[color:var(--crm-ui-text)]">{props.folder.name}</h3>
          <p className="mt-1 text-sm text-[color:var(--crm-ui-muted)]">
            {props.latestNote
              ? `Last updated ${formatNoteTimestamp(props.latestNote.updated_at)}`
              : 'No notes in this view yet.'}
          </p>
          {props.latestNote && (
            <p className="mt-2 line-clamp-2 text-sm text-[color:var(--crm-ui-muted)]">
              {props.latestNote.title}: {noteSnippet(props.latestNote.body)}
            </p>
          )}
        </div>
      </div>

      {props.manageMode && (
        <div className="mt-4 flex gap-2">
          <CrmButton
            type="button"
            onClick={props.onMoveUp}
            disabled={!props.canMoveUp}
            className="px-3 py-2 text-xs"
          >
            Move Up
          </CrmButton>
          <CrmButton
            type="button"
            onClick={props.onMoveDown}
            disabled={!props.canMoveDown}
            className="px-3 py-2 text-xs"
          >
            Move Down
          </CrmButton>
        </div>
      )}
    </article>
  )
}

export function NotePreviewCard(props: {
  note: NotesNoteRow
  selected: boolean
  onSelect: () => void
  onOpen: () => void
  contextLabel?: string | null
}) {
  const coarsePointer = useCoarsePointer()

  return (
    <article
      className={`ace-crm-surface p-4 transition ${
        props.selected
          ? 'border-[color:var(--crm-ui-accent-border)] ring-2 ring-[color:var(--crm-ui-accent-border)]'
          : 'hover:border-[color:var(--crm-ui-accent-border)]'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (coarsePointer) {
            props.onOpen()
            return
          }
          props.onSelect()
        }}
        onDoubleClick={props.onOpen}
        onKeyDown={(event) => handleExplorerKeyDown(event, props.onSelect, props.onOpen)}
        className="grid gap-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="ace-crm-surface-muted inline-flex size-10 items-center justify-center text-[color:var(--crm-ui-muted)]">
            <FileText size={22} aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2 text-xs text-[color:var(--crm-ui-muted)]">
            {props.note.starred && <Star size={14} className="fill-current text-amber-500" aria-hidden="true" />}
            <span>{formatNoteTimestamp(props.note.updated_at)}</span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-[color:var(--crm-ui-text)]">{props.note.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-[color:var(--crm-ui-muted)]">{noteSnippet(props.note.body)}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-[color:var(--crm-ui-muted)]">
          {props.contextLabel && (
            <CrmChip className="text-xs">{props.contextLabel}</CrmChip>
          )}
          <CrmChip tone={props.note.status === 'archived' ? 'default' : 'accent'} className="text-xs">
            {props.note.status === 'archived' ? 'Archived' : 'Active'}
          </CrmChip>
        </div>
      </div>
    </article>
  )
}

export function FolderActionModal(props: {
  open: boolean
  mode: 'rename' | 'delete_choice' | 'delete_move' | null
  folderName: string
  renameValue: string
  noteCount: number
  availableMoveTargets: NotesFolderWithCount[]
  selectedMoveTargetId: string
  saving: boolean
  error: string | null
  onClose: () => void
  onRenameValueChange: (value: string) => void
  onSelectedMoveTargetIdChange: (value: string) => void
  onSubmitRename: () => void
  onChooseUncategorize: () => void
  onChooseMove: () => void
  onSubmitMove: () => void
}) {
  const { open, onClose } = props

  useLockBodyScroll(open)

  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open || !props.mode) return null
  const labelledBy = 'notes-folder-action-title'

  return (
    <CrmModalShell labelledBy={labelledBy} onClose={props.onClose} widthClassName="max-w-lg">
      <div className="max-h-[88vh] overflow-auto">
        {props.mode === 'rename' && (
          <>
            <CrmModalHeader
              title="Rename Folder"
              description="Update the folder name without changing its notes."
              labelledBy={labelledBy}
              onClose={props.onClose}
              closeLabel="Close folder rename"
            />
            <CrmModalSection className="m-5" title="Folder name">
              <CrmField label="Folder name">
                <input
                  value={props.renameValue}
                  onChange={(event) => props.onRenameValueChange(event.target.value)}
                  className={crmInputClassName()}
                />
              </CrmField>
            </CrmModalSection>
          </>
        )}

        {props.mode === 'delete_choice' && (
          <>
            <CrmModalHeader
              title="Delete Folder"
              description={`"${props.folderName}" still contains ${props.noteCount} ${props.noteCount === 1 ? 'note' : 'notes'}.`}
              labelledBy={labelledBy}
              onClose={props.onClose}
              closeLabel="Close folder delete"
            />
            <CrmModalSection className="m-5" tone="muted">
              <div className="grid gap-3">
                <CrmButton
                  type="button"
                  onClick={props.onChooseUncategorize}
                  disabled={props.saving}
                  tone="primary"
                >
                  Move notes to Uncategorized
                </CrmButton>
                <CrmButton
                  type="button"
                  onClick={props.onChooseMove}
                  disabled={props.saving}
                >
                  Move notes into another folder
                </CrmButton>
              </div>
            </CrmModalSection>
          </>
        )}

        {props.mode === 'delete_move' && (
          <>
            <CrmModalHeader
              title="Move Notes Before Delete"
              description={`Choose where to move notes from "${props.folderName}" before the folder is deleted.`}
              labelledBy={labelledBy}
              onClose={props.onClose}
              closeLabel="Close folder move"
            />
            <CrmModalSection className="m-5" title="Destination folder">
              <CrmField label="Destination folder">
                <select
                  value={props.selectedMoveTargetId}
                  onChange={(event) => props.onSelectedMoveTargetIdChange(event.target.value)}
                  className={crmInputClassName()}
                >
                  <option value="">Select a folder</option>
                  {props.availableMoveTargets.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </CrmField>
            </CrmModalSection>
          </>
        )}

        {props.error && (
          <div className="px-5">
            <CrmNotice tone="error" compact>
              {props.error}
            </CrmNotice>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--crm-ui-border)] px-5 py-4">
          <CrmButton
            type="button"
            onClick={props.onClose}
            disabled={props.saving}
          >
            Cancel
          </CrmButton>
          {props.mode === 'rename' && (
            <CrmButton
              type="button"
              onClick={props.onSubmitRename}
              disabled={props.saving}
              tone="primary"
            >
              {props.saving ? 'Saving...' : 'Save Name'}
            </CrmButton>
          )}
          {props.mode === 'delete_move' && (
            <CrmButton
              type="button"
              onClick={props.onSubmitMove}
              disabled={props.saving}
              tone="danger"
            >
              {props.saving ? 'Deleting...' : 'Move Notes and Delete'}
            </CrmButton>
          )}
        </div>
      </div>
    </CrmModalShell>
  )
}
