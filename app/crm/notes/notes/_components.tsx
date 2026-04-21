'use client'

import type { NotesFolderWithCount, NotesNoteRow } from '@/lib/notes/types'
import { useLockBodyScroll } from '@/lib/hooks/useLockBodyScroll'
import Link from 'next/link'
import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { EllipsisVertical, FileText, Folder, FolderOpen, Star } from 'lucide-react'

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

export function filterNotesBySearch(notes: NotesNoteRow[], search: string) {
  const needle = search.trim().toLowerCase()
  if (!needle) return notes
  return notes.filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(needle))
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
        className="flex size-9 cursor-pointer list-none items-center justify-center rounded-xl border border-gray-200 bg-white text-[var(--crm-muted)] hover:bg-gray-50 [&::-webkit-details-marker]:hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <EllipsisVertical size={16} aria-hidden="true" />
        <span className="sr-only">{props.label}</span>
      </summary>
      <div
        className="absolute right-0 top-11 z-20 min-w-40 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl"
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
      ? 'text-red-700 hover:bg-red-50'
      : 'text-[var(--crm-text-soft)] hover:bg-gray-100'

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
    <div className="inline-flex rounded-2xl bg-neutral-900 p-1">
      {(['active', 'archived'] as NotesBrowserStatus[]).map((value) => (
        <Link
          key={value}
          href={props.buildHref(value)}
          className={`rounded-xl px-3 py-2 text-sm font-extrabold transition ${
            props.status === value ? 'bg-emerald-400 text-neutral-950 shadow-sm' : 'text-neutral-400'
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
    <Link
      href={props.href}
      className={`inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-extrabold transition ${
        props.primary
          ? 'bg-emerald-400 text-neutral-950 hover:bg-emerald-300'
          : 'border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800'
      }`}
    >
      {props.children}
    </Link>
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
      className={`relative rounded-[28px] border bg-neutral-950 p-5 shadow-sm transition ${
        props.selected
          ? 'border-emerald-400/60 ring-2 ring-emerald-400/20'
          : 'border-neutral-800 hover:border-neutral-700'
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
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300">
            {props.selected ? <FolderOpen size={28} aria-hidden="true" /> : <Folder size={28} aria-hidden="true" />}
          </div>
          <div className="rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1 text-xs font-bold text-neutral-500">
            {props.noteCount} {props.noteCount === 1 ? 'note' : 'notes'}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-extrabold text-white">{props.folder.name}</h3>
          <p className="mt-1 text-sm text-neutral-400">
            {props.latestNote
              ? `Last updated ${formatNoteTimestamp(props.latestNote.updated_at)}`
              : 'No notes in this view yet.'}
          </p>
          {props.latestNote && (
            <p className="mt-2 line-clamp-2 text-sm text-neutral-500">
              {props.latestNote.title}: {noteSnippet(props.latestNote.body)}
            </p>
          )}
        </div>
      </div>

      {props.manageMode && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={props.onMoveUp}
            disabled={!props.canMoveUp}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Move Up
          </button>
          <button
            type="button"
            onClick={props.onMoveDown}
            disabled={!props.canMoveDown}
            className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Move Down
          </button>
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
      className={`rounded-[24px] border bg-neutral-950 p-4 shadow-sm transition ${
        props.selected
          ? 'border-emerald-400/60 ring-2 ring-emerald-400/20'
          : 'border-neutral-800 hover:border-neutral-700'
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
          <div className="inline-flex size-10 items-center justify-center rounded-2xl bg-neutral-900 text-neutral-400">
            <FileText size={22} aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            {props.note.starred && <Star size={14} className="fill-current text-amber-500" aria-hidden="true" />}
            <span>{formatNoteTimestamp(props.note.updated_at)}</span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-white">{props.note.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-neutral-400">{noteSnippet(props.note.body)}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-semibold text-neutral-500">
          {props.contextLabel && (
            <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2.5 py-1">{props.contextLabel}</span>
          )}
          <span
            className={`rounded-full px-2.5 py-1 ${
              props.note.status === 'archived'
                ? 'bg-neutral-800 text-neutral-400'
                : 'bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {props.note.status === 'archived' ? 'Archived' : 'Active'}
          </span>
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
  useLockBodyScroll(props.open)

  useEffect(() => {
    if (!props.open || typeof window === 'undefined') return
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.onClose, props.open])

  if (!props.open || !props.mode) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-[28px] border border-neutral-800 bg-neutral-950 p-5 shadow-2xl">
        {props.mode === 'rename' && (
          <>
            <div>
              <h2 className="text-xl font-extrabold text-white">Rename Folder</h2>
              <p className="mt-1 text-sm text-neutral-400">Update the folder name without changing its notes.</p>
            </div>
            <div className="mt-4 grid gap-2">
              <label className="grid gap-1 text-sm font-semibold text-neutral-300">
                Folder name
                <input
                  value={props.renameValue}
                  onChange={(event) => props.onRenameValueChange(event.target.value)}
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
            </div>
          </>
        )}

        {props.mode === 'delete_choice' && (
          <>
            <div>
              <h2 className="text-xl font-extrabold text-white">Delete Folder</h2>
              <p className="mt-1 text-sm text-neutral-400">
                &quot;{props.folderName}&quot; still contains {props.noteCount}{' '}
                {props.noteCount === 1 ? 'note' : 'notes'}.
              </p>
            </div>
            <div className="mt-4 grid gap-3 rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4">
              <button
                type="button"
                onClick={props.onChooseUncategorize}
                disabled={props.saving}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 disabled:opacity-60"
              >
                Move notes to Uncategorized
              </button>
              <button
                type="button"
                onClick={props.onChooseMove}
                disabled={props.saving}
                className="rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm font-extrabold text-neutral-200 disabled:opacity-60"
              >
                Move notes into another folder
              </button>
            </div>
          </>
        )}

        {props.mode === 'delete_move' && (
          <>
            <div>
              <h2 className="text-xl font-extrabold text-white">Move Notes Before Delete</h2>
              <p className="mt-1 text-sm text-neutral-400">
                Choose where to move notes from &quot;{props.folderName}&quot; before the folder is deleted.
              </p>
            </div>
            <div className="mt-4 grid gap-2">
              <label className="grid gap-1 text-sm font-semibold text-neutral-300">
                Destination folder
                <select
                  value={props.selectedMoveTargetId}
                  onChange={(event) => props.onSelectedMoveTargetIdChange(event.target.value)}
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                >
                  <option value="">Select a folder</option>
                  {props.availableMoveTargets.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}

        {props.error && (
          <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {props.error}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={props.onClose}
            disabled={props.saving}
            className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-bold text-neutral-200 disabled:opacity-60"
          >
            Cancel
          </button>
          {props.mode === 'rename' && (
            <button
              type="button"
              onClick={props.onSubmitRename}
              disabled={props.saving}
              className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 disabled:opacity-60"
            >
              {props.saving ? 'Saving...' : 'Save Name'}
            </button>
          )}
          {props.mode === 'delete_move' && (
            <button
              type="button"
              onClick={props.onSubmitMove}
              disabled={props.saving}
              className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
            >
              {props.saving ? 'Deleting...' : 'Move Notes and Delete'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
