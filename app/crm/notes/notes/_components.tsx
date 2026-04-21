'use client'

import Link from 'next/link'
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { EllipsisVertical, FileText, Folder, FolderOpen, Star } from 'lucide-react'
import type { FolderRow, NoteRow } from '../_lib'

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

export function filterNotesBySearch(notes: NoteRow[], search: string) {
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

export function groupNotesByFolder(notes: NoteRow[]) {
  const map = new Map<string, NoteRow[]>()
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
  event: KeyboardEvent<HTMLElement>,
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
  folder: FolderRow
  noteCount: number
  latestNote: NoteRow | null
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
  note: NoteRow
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
