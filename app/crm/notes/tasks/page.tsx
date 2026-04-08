'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  formatDue,
  recurrenceLabel,
  recurrenceOptions,
  recurrenceUnitOptions,
  toIsoFromLocal,
  toLocalDateInput,
  toLocalTimeInput,
  type RecurrenceFrequency,
  type RecurrenceUnit,
  type TaskRow,
} from '../_lib'

type StatusFilter = 'active' | 'completed' | 'archived'
type DueFilter = 'all' | 'overdue' | 'today' | 'upcoming'

export default function NotesTasksPage() {
  const searchParams = useSearchParams()
  const focusId = searchParams.get('focus')

  const [status, setStatus] = useState<StatusFilter>('active')
  const [due, setDue] = useState<DueFilter>('all')
  const [search, setSearch] = useState('')
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

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

  const load = async () => {
    setLoading(true)
    setError(null)
    const query = new URLSearchParams()
    query.set('status', status)
    if (status === 'active') query.set('due', due)
    if (search.trim()) query.set('search', search.trim())
    const res = await authedFetch(`/api/notes/tasks?${query.toString()}`, { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to load tasks.')
      setLoading(false)
      return
    }
    setTasks((payload?.tasks ?? []) as TaskRow[])
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, due])

  useEffect(() => {
    const t = setTimeout(() => void load(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  useEffect(() => {
    if (!focusId || tasks.length === 0) return
    const task = tasks.find((row) => row.id === focusId)
    if (!task) return
    openEditor(task)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, tasks.length])

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])
  const editingTask = editId ? taskById.get(editId) ?? null : null

  const openEditor = (task: TaskRow) => {
    setEditId(task.id)
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
  }

  const closeEditor = () => {
    setEditId(null)
  }

  const saveEdit = async () => {
    if (!editingTask) return
    const dueAt = toIsoFromLocal({
      date: dueDate,
      time: dueTime,
      hasDueTime: !allDay && Boolean(dueTime),
      isAllDay: allDay,
    })
    const reminderAt = reminderAtLocal ? new Date(reminderAtLocal).toISOString() : null
    const recurrencePayload =
      recurrence === ''
        ? null
        : recurrence === 'custom'
        ? {
            frequency: 'custom' as const,
            interval: Math.max(1, Number(customInterval || '1')),
            unit: customUnit,
          }
        : { frequency: recurrence }

    setSaving(true)
    const res = await authedFetch(`/api/notes/tasks/${editingTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        due_at: dueAt,
        is_all_day: allDay,
        has_due_time: !allDay && Boolean(dueTime),
        reminder_enabled: reminderEnabled,
        reminder_at: reminderAt,
        reminder_offset_minutes: reminderOffset.trim() ? Number(reminderOffset.trim()) : null,
        priority: priority || null,
        starred,
        recurrence_rule: recurrencePayload,
      }),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to save task.')
      return
    }
    closeEditor()
    await load()
  }

  const runAction = async (path: string, method: 'POST' | 'DELETE' = 'POST', body?: Record<string, unknown>) => {
    const res = await authedFetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Action failed.')
      return false
    }
    await load()
    return true
  }

  return (
    <div className="grid gap-4 pb-14">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(['active', 'completed', 'archived'] as StatusFilter[]).map((value) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className={`rounded-xl px-3 py-2 text-sm font-extrabold ${
                status === value ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'
              }`}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
          <Link href="/crm/notes/quick-add" className="ml-auto rounded-xl border border-gray-300 px-3 py-2 text-sm font-bold">
            Quick Add
          </Link>
        </div>

        {status === 'active' && (
          <div className="mb-3 flex flex-wrap gap-2">
            {(['all', 'overdue', 'today', 'upcoming'] as DueFilter[]).map((value) => (
              <button
                key={value}
                onClick={() => setDue(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  due === value ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
          </div>
        )}

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search tasks..."
          className="w-full rounded-xl border border-gray-300 px-3 py-2"
        />
      </section>

      {status === 'completed' && (
        <button
          onClick={() => void runAction('/api/notes/tasks/completed', 'DELETE')}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-extrabold text-red-700"
        >
          Bulk Delete Completed Tasks
        </button>
      )}

      {editingTask && (
        <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-extrabold text-gray-900">Edit Task</h2>
          <label className="grid gap-1 text-sm font-semibold">
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2" />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-24 rounded-xl border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">
              Due Date
              <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-xl border border-gray-300 px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Due Time
              <input
                type="time"
                value={dueTime}
                disabled={allDay}
                onChange={(event) => setDueTime(event.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
            </label>
            <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
              <span>All day</span>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(event) => setReminderEnabled(event.target.checked)}
              />
              <span>Reminder email</span>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Reminder Time
              <input
                type="datetime-local"
                value={reminderAtLocal}
                onChange={(event) => setReminderAtLocal(event.target.value)}
                disabled={!reminderEnabled}
                className="rounded-xl border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Reminder Offset (min)
              <input
                type="number"
                min={0}
                value={reminderOffset}
                onChange={(event) => setReminderOffset(event.target.value)}
                disabled={!reminderEnabled}
                className="rounded-xl border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">
              Recurrence
              <select
                value={recurrence}
                onChange={(event) => setRecurrence(event.target.value as RecurrenceFrequency | '')}
                className="rounded-xl border border-gray-300 px-3 py-2"
              >
                <option value="">None</option>
                {recurrenceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {recurrence === 'custom' && (
              <>
                <label className="grid gap-1 text-sm font-semibold">
                  Every
                  <input
                    type="number"
                    min={1}
                    value={customInterval}
                    onChange={(event) => setCustomInterval(event.target.value)}
                    className="rounded-xl border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold">
                  Unit
                  <select
                    value={customUnit}
                    onChange={(event) => setCustomUnit(event.target.value as RecurrenceUnit)}
                    className="rounded-xl border border-gray-300 px-3 py-2"
                  >
                    {recurrenceUnitOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold">
              Priority
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as 'low' | 'medium' | 'high' | '')}
                className="rounded-xl border border-gray-300 px-3 py-2"
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={starred} onChange={(event) => setStarred(event.target.checked)} />
              <span>Starred</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button disabled={saving} onClick={() => void saveEdit()} className="rounded-xl bg-black px-4 py-2 text-sm font-extrabold text-white">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={closeEditor} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-bold text-gray-800">
              Cancel
            </button>
          </div>
        </section>
      )}

      {loading && <div className="text-sm text-gray-500">Loading tasks...</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {!loading && (
        <section className="grid gap-2">
          {tasks.length === 0 && <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">No tasks found.</div>}
          {tasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-extrabold text-gray-900">
                    {task.starred ? '★ ' : ''}
                    {task.title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDue(task.due_at, task.is_all_day, task.has_due_time)} · Priority: {task.priority ?? 'none'} ·
                    Recurrence: {recurrenceLabel(task.recurrence_rule)}
                  </div>
                  {task.description && <div className="mt-1 text-sm text-gray-600">{task.description}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => openEditor(task)}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-bold text-gray-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      void runAction(`/api/notes/tasks/${task.id}`, 'DELETE')
                    }
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {task.status === 'active' && (
                  <>
                    <button
                      onClick={() => void runAction(`/api/notes/tasks/${task.id}/complete`)}
                      className="rounded-lg bg-black px-2.5 py-1.5 text-xs font-extrabold text-white"
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => void runAction(`/api/notes/tasks/${task.id}/archive`)}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-bold"
                    >
                      Archive
                    </button>
                    <button
                      onClick={() => void runAction(`/api/notes/tasks/${task.id}/snooze`, 'POST', { action: 'later_today' })}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-bold"
                    >
                      Snooze Later Today
                    </button>
                    <button
                      onClick={() => void runAction(`/api/notes/tasks/${task.id}/snooze`, 'POST', { action: 'tomorrow' })}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-bold"
                    >
                      Snooze Tomorrow
                    </button>
                    <button
                      onClick={() => void runAction(`/api/notes/tasks/${task.id}/snooze`, 'POST', { action: 'next_week' })}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-bold"
                    >
                      Snooze Next Week
                    </button>
                  </>
                )}
                {task.status === 'completed' && (
                  <button
                    onClick={() => void runAction(`/api/notes/tasks/${task.id}/reopen`)}
                    className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-bold"
                  >
                    Reopen
                  </button>
                )}
                {task.status === 'archived' && (
                  <button
                    onClick={() => void runAction(`/api/notes/tasks/${task.id}/unarchive`)}
                    className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-bold"
                  >
                    Unarchive
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}
