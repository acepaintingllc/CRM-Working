'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { FolderOpen, Plus, Settings2, Star, X } from 'lucide-react'
import {
  recurrenceOptions,
  recurrenceUnitOptions,
  toIsoFromLocal,
  toLocalDateInput,
  toLocalTimeInput,
  type FolderRow,
  type NoteRow,
  type RecurrenceFrequency,
  type RecurrenceUnit,
  type TaskRow,
} from './_lib'

type SearchLike = URLSearchParams | { toString(): string } | null

type OverlayShellProps = {
  open: boolean
  title: string
  description: string
  variant: 'task' | 'note'
  onClose: () => void
  children: ReactNode
}

type TaskComposerProps = {
  open: boolean
  taskId?: string | null
  closeHref: string
}

type NoteComposerProps = {
  open: boolean
  noteId?: string | null
  folderId?: string | null
  closeHref: string
}

function localDateTimeToIso(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }
    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [query])

  return matches
}

function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}

function overlayWidth(variant: OverlayShellProps['variant'], mobile: boolean) {
  if (mobile) return '100vw'
  return variant === 'task' ? 'min(42rem, calc(100vw - 2rem))' : 'min(64rem, calc(100vw - 2rem))'
}

function mergeSearchParams(searchParams: SearchLike, updates: Record<string, string | null | undefined>) {
  const params = new URLSearchParams(searchParams?.toString() ?? '')
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  return params
}

export function buildNotesModuleHref(
  pathname: string,
  searchParams: SearchLike,
  updates: Record<string, string | null | undefined>
) {
  const params = mergeSearchParams(searchParams, updates)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function buildNotesCloseHref(pathname: string, searchParams: SearchLike) {
  return buildNotesModuleHref(pathname, searchParams, {
    composer: null,
    taskId: null,
    noteId: null,
    folder: null,
  })
}

export function NotesModuleHeaderActions() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const folderId = pathname?.startsWith('/crm/notes/notes/folders/')
    ? pathname.split('/').at(-1) ?? null
    : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={buildNotesModuleHref(pathname ?? '/crm/notes', searchParams, {
          composer: 'task',
          taskId: null,
        })}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500 px-3 py-2 text-sm font-extrabold text-neutral-950 transition hover:bg-emerald-400"
      >
        <Plus size={16} aria-hidden="true" />
        <span>New Task</span>
      </Link>
      <Link
        href={buildNotesModuleHref(pathname ?? '/crm/notes', searchParams, {
          composer: 'note',
          noteId: null,
          folder: folderId,
        })}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm font-extrabold text-white transition hover:border-neutral-600 hover:bg-neutral-800"
      >
        <Plus size={16} aria-hidden="true" />
        <span>New Note</span>
      </Link>
      <Link
        href="/crm/notes/settings"
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-bold text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-900 hover:text-white"
      >
        <Settings2 size={16} aria-hidden="true" />
        <span>Settings</span>
      </Link>
    </div>
  )
}

export function NotesComposerMount() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const composer = searchParams.get('composer')
  const closeHref = buildNotesCloseHref(pathname ?? '/crm/notes', searchParams)

  return (
    <>
      <TaskComposerOverlay open={composer === 'task'} taskId={searchParams.get('taskId')} closeHref={closeHref} />
      <NoteComposerOverlay
        open={composer === 'note'}
        noteId={searchParams.get('noteId')}
        folderId={searchParams.get('folder')}
        closeHref={closeHref}
      />
    </>
  )
}

export function NotesOverlayShell(props: OverlayShellProps) {
  const mobile = useMediaQuery('(max-width: 767px)')
  useLockBodyScroll(props.open)

  useEffect(() => {
    if (!props.open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [props])

  if (!props.open) return null

  const alignClass = mobile ? 'items-end' : 'items-stretch justify-end'

  return (
    <div className={`fixed inset-0 z-50 flex ${alignClass} bg-black/70 backdrop-blur-sm`} role="presentation">
      <button type="button" aria-label="Close composer" onClick={props.onClose} className="absolute inset-0 cursor-default" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`notes-composer-${props.variant}-title`}
        className={`relative grid max-h-screen w-full grid-rows-[auto_1fr] overflow-hidden border border-neutral-800 bg-neutral-950 text-white shadow-2xl ${
          mobile ? 'min-h-[100dvh] rounded-t-[28px]' : 'h-full rounded-l-[28px]'
        }`}
        style={{ width: overlayWidth(props.variant, mobile) }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-neutral-800 px-5 py-4">
          <div className="grid gap-1">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-emerald-300/80">
              {props.variant === 'task' ? 'Task Composer' : 'Note Composer'}
            </div>
            <div>
              <h2 id={`notes-composer-${props.variant}-title`} className="text-xl font-extrabold text-white">
                {props.title}
              </h2>
              <p className="mt-1 text-sm text-neutral-400">{props.description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-900 text-neutral-300 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto">{props.children}</div>
      </section>
    </div>
  )
}

export function TaskComposerOverlay(props: TaskComposerProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(Boolean(props.taskId))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderAtLocal, setReminderAtLocal] = useState('')
  const [reminderOffset, setReminderOffset] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | ''>('')
  const [starred, setStarred] = useState(false)
  const [recurrence, setRecurrence] = useState<RecurrenceFrequency | ''>('')
  const [customInterval, setCustomInterval] = useState('1')
  const [customUnit, setCustomUnit] = useState<RecurrenceUnit>('week')

  useEffect(() => {
    if (!props.open) return
    if (!props.taskId) {
      setLoading(false)
      setError(null)
      setTitle('')
      setDescription('')
      setDueDate('')
      setDueTime('')
      setAllDay(false)
      setReminderEnabled(false)
      setReminderAtLocal('')
      setReminderOffset('')
      setPriority('')
      setStarred(false)
      setRecurrence('')
      setCustomInterval('1')
      setCustomUnit('week')
      return
    }

    let cancelled = false
    const loadTask = async () => {
      setLoading(true)
      setError(null)
      const res = await authedFetch(`/api/notes/tasks/${props.taskId}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (cancelled) return
      if (!res.ok) {
        setError(payload?.error ?? 'Unable to load task.')
        setLoading(false)
        return
      }

      const task = (payload?.task ?? null) as TaskRow | null
      if (!task) {
        setError('Task not found.')
        setLoading(false)
        return
      }

      setTitle(task.title)
      setDescription(task.description ?? '')
      setDueDate(toLocalDateInput(task.due_at))
      setDueTime(toLocalTimeInput(task.due_at))
      setAllDay(task.is_all_day)
      setReminderEnabled(task.reminder_enabled)
      setReminderAtLocal(task.reminder_at ? task.reminder_at.slice(0, 16) : '')
      setReminderOffset(task.reminder_offset_minutes == null ? '' : String(task.reminder_offset_minutes))
      setPriority(task.priority ?? '')
      setStarred(task.starred)
      setRecurrence(task.recurrence_rule?.frequency ?? '')
      setCustomInterval(String(task.recurrence_rule?.interval ?? 1))
      setCustomUnit(task.recurrence_rule?.unit ?? 'week')
      setLoading(false)
    }

    void loadTask()
    return () => {
      cancelled = true
    }
  }, [props.open, props.taskId])

  const recurrencePayload = useMemo(() => {
    if (!recurrence) return null
    if (recurrence === 'custom') {
      return {
        frequency: 'custom' as const,
        interval: Math.max(1, Number(customInterval || '1')),
        unit: customUnit,
      }
    }
    return { frequency: recurrence }
  }, [customInterval, customUnit, recurrence])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Task title is required.')
      return
    }

    setSaving(true)
    setError(null)

    const dueAt = toIsoFromLocal({
      date: dueDate,
      time: dueTime,
      hasDueTime: !allDay && Boolean(dueTime),
      isAllDay: allDay,
    })

    const body = {
      title: title.trim(),
      description: description.trim() || null,
      due_at: dueAt,
      is_all_day: allDay,
      has_due_time: !allDay && Boolean(dueTime),
      reminder_enabled: reminderEnabled,
      reminder_at: localDateTimeToIso(reminderAtLocal),
      reminder_offset_minutes: reminderOffset.trim() ? Number(reminderOffset.trim()) : null,
      priority: priority || null,
      starred,
      recurrence_rule: recurrencePayload,
    }

    const res = await authedFetch(props.taskId ? `/api/notes/tasks/${props.taskId}` : '/api/notes/tasks', {
      method: props.taskId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)

    if (!res.ok) {
      setError(payload?.error ?? 'Unable to save task.')
      return
    }

    router.replace(props.closeHref)
    router.refresh()
  }

  return (
    <NotesOverlayShell
      open={props.open}
      onClose={() => router.replace(props.closeHref)}
      title={props.taskId ? 'Edit Task' : 'New Task'}
      description="Keep the essentials close and the secondary controls out of the way."
      variant="task"
    >
      <div className="grid gap-6 px-5 py-5">
        {loading && <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">Loading task...</div>}
        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {!loading && (
          <>
            <section className="grid gap-4 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-5">
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Call supplier about paint pricing"
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white outline-none focus:border-emerald-400"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional details, context, or next step."
                  className="min-h-32 rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                />
              </label>
            </section>

            <section className="grid gap-4 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="grid gap-1">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-300/80">Schedule</h3>
                <p className="text-sm text-neutral-400">Date, time, reminders, and recurrence stay grouped together.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Due Date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Due Time
                  <input
                    type="time"
                    value={dueTime}
                    disabled={allDay}
                    onChange={(event) => setDueTime(event.target.value)}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-50"
                  />
                </label>
              </div>
              <label className="inline-flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
                <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
                <span>All day task</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="inline-flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
                  <input type="checkbox" checked={reminderEnabled} onChange={(event) => setReminderEnabled(event.target.checked)} />
                  <span>Reminder enabled</span>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Reminder Offset (min)
                  <input
                    type="number"
                    min={0}
                    value={reminderOffset}
                    disabled={!reminderEnabled}
                    onChange={(event) => setReminderOffset(event.target.value)}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-50"
                  />
                </label>
              </div>
              <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                Reminder Time
                <input
                  type="datetime-local"
                  value={reminderAtLocal}
                  disabled={!reminderEnabled}
                  onChange={(event) => setReminderAtLocal(event.target.value)}
                  className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400 disabled:opacity-50"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200 sm:col-span-2">
                  Recurrence
                  <select
                    value={recurrence}
                    onChange={(event) => setRecurrence(event.target.value as RecurrenceFrequency | '')}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  >
                    <option value="">None</option>
                    {recurrenceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Priority
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as 'low' | 'medium' | 'high' | '')}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  >
                    <option value="">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>
              {recurrence === 'custom' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                    Every
                    <input
                      type="number"
                      min={1}
                      value={customInterval}
                      onChange={(event) => setCustomInterval(event.target.value)}
                      className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                    Unit
                    <select
                      value={customUnit}
                      onChange={(event) => setCustomUnit(event.target.value as RecurrenceUnit)}
                      className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                    >
                      {recurrenceUnitOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
            </section>

            <section className="grid gap-4 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-5">
              <div className="grid gap-1">
                <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-300/80">Visibility</h3>
                <p className="text-sm text-neutral-400">Keep starred tasks surfaced without overloading the main form.</p>
              </div>
              <label className="inline-flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
                <input type="checkbox" checked={starred} onChange={(event) => setStarred(event.target.checked)} />
                <span>Star this task</span>
              </label>
            </section>

            <div className="sticky bottom-0 z-10 flex flex-wrap gap-3 border-t border-neutral-800 bg-neutral-950/95 px-1 pb-1 pt-4 backdrop-blur">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex min-w-32 items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {saving ? 'Saving...' : props.taskId ? 'Save Task' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => router.replace(props.closeHref)}
                className="inline-flex min-w-24 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </NotesOverlayShell>
  )
}

export function NoteComposerOverlay(props: NoteComposerProps) {
  const router = useRouter()
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [folderId, setFolderId] = useState(props.folderId ?? '')
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    if (!props.open) return
    let cancelled = false

    const loadData = async () => {
      setLoading(true)
      setError(null)
      const requests = [authedFetch('/api/notes/folders', { cache: 'no-store' })]
      if (props.noteId) requests.push(authedFetch(`/api/notes/notes/${props.noteId}`, { cache: 'no-store' }))

      const responses = await Promise.all(requests)
      const foldersRes = responses[0]
      const foldersPayload = await foldersRes.json().catch(() => null)
      if (cancelled) return
      if (!foldersRes.ok) {
        setError(foldersPayload?.error ?? 'Unable to load folders.')
        setLoading(false)
        return
      }
      setFolders((foldersPayload?.folders ?? []) as FolderRow[])

      if (props.noteId) {
        const noteRes = responses[1]
        const notePayload = await noteRes.json().catch(() => null)
        if (!noteRes.ok) {
          setError(notePayload?.error ?? 'Unable to load note.')
          setLoading(false)
          return
        }
        const note = (notePayload?.note ?? null) as NoteRow | null
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
        setFolderId(props.folderId ?? '')
        setStarred(false)
      }

      setLoading(false)
    }

    void loadData()
    return () => {
      cancelled = true
    }
  }, [props.folderId, props.noteId, props.open])

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Note title is required.')
      return
    }

    setSaving(true)
    setError(null)
    const res = await authedFetch(props.noteId ? `/api/notes/notes/${props.noteId}` : '/api/notes/notes', {
      method: props.noteId ? 'PATCH' : 'POST',
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

    const note = (payload?.note ?? null) as NoteRow | null
    router.refresh()
    if (note?.id) {
      router.push(`/crm/notes/notes/${encodeURIComponent(note.id)}`)
      return
    }
    router.replace(props.closeHref)
  }

  return (
    <NotesOverlayShell
      open={props.open}
      onClose={() => router.replace(props.closeHref)}
      title={props.noteId ? 'Edit Note' : 'New Note'}
      description="Capture the idea quickly, then move into the dedicated note view when it is ready."
      variant="note"
    >
      <div className="grid gap-6 px-5 py-5">
        {loading && <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">Loading note composer...</div>}
        {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {!loading && (
          <>
            <section className="grid gap-4 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
              <div className="grid gap-4">
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="CRM feature idea"
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-base text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Body
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    placeholder="Capture the detail while it is fresh."
                    className="min-h-[24rem] rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400"
                  />
                </label>
              </div>
              <div className="grid content-start gap-4">
                <div className="grid gap-1">
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.18em] text-emerald-300/80">Organize</h3>
                  <p className="text-sm text-neutral-400">Keep filing lightweight so the writing area stays primary.</p>
                </div>
                <label className="grid gap-1.5 text-sm font-semibold text-neutral-200">
                  Folder
                  <select
                    value={folderId}
                    onChange={(event) => setFolderId(event.target.value)}
                    className="rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  >
                    <option value="">Uncategorized</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-neutral-200">
                    <FolderOpen size={16} aria-hidden="true" />
                    <span>{folderId ? folders.find((row) => row.id === folderId)?.name ?? 'Folder selected' : 'No folder selected'}</span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-400">
                    Notes stay easy to relocate later, so this can stay optional.
                  </p>
                </div>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-200">
                  <input type="checkbox" checked={starred} onChange={(event) => setStarred(event.target.checked)} />
                  <span>Star this note</span>
                  <Star size={15} className={starred ? 'fill-amber-400 text-amber-400' : 'text-neutral-500'} aria-hidden="true" />
                </label>
              </div>
            </section>

            <div className="sticky bottom-0 z-10 flex flex-wrap gap-3 border-t border-neutral-800 bg-neutral-950/95 px-1 pb-1 pt-4 backdrop-blur">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex min-w-32 items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-extrabold text-neutral-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {saving ? 'Saving...' : props.noteId ? 'Save Note' : 'Create Note'}
              </button>
              <button
                type="button"
                onClick={() => router.replace(props.closeHref)}
                className="inline-flex min-w-24 items-center justify-center rounded-2xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-sm font-bold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </NotesOverlayShell>
  )
}
