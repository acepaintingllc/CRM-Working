'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { FolderRow, RecurrenceFrequency, RecurrenceRule, RecurrenceUnit } from '../_lib'
import { recurrenceOptions, recurrenceUnitOptions, toIsoFromLocal } from '../_lib'
import { useSearchParams } from 'next/navigation'

type Mode = 'task' | 'note'

function localDateTimeToIso(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export default function NotesQuickAddPage() {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('task')
  const [folders, setFolders] = useState<FolderRow[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [taskTitle, setTaskTitle] = useState('')
  const [taskDescription, setTaskDescription] = useState('')
  const [taskDate, setTaskDate] = useState('')
  const [taskTime, setTaskTime] = useState('')
  const [taskAllDay, setTaskAllDay] = useState(false)
  const [taskReminderEnabled, setTaskReminderEnabled] = useState(false)
  const [taskReminderAtLocal, setTaskReminderAtLocal] = useState('')
  const [taskReminderOffset, setTaskReminderOffset] = useState('')
  const [taskRecurrence, setTaskRecurrence] = useState<RecurrenceFrequency | ''>('')
  const [taskCustomInterval, setTaskCustomInterval] = useState('1')
  const [taskCustomUnit, setTaskCustomUnit] = useState<RecurrenceUnit>('week')
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high' | ''>('')
  const [taskStarred, setTaskStarred] = useState(false)

  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [noteFolderId, setNoteFolderId] = useState('')
  const [noteStarred, setNoteStarred] = useState(false)

  useEffect(() => {
    const loadFolders = async () => {
      const res = await authedFetch('/api/notes/folders', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) return
      setFolders((payload?.folders ?? []) as FolderRow[])
    }
    void loadFolders()
  }, [])

  useEffect(() => {
    const requestedMode = searchParams.get('mode')
    const requestedFolderId = searchParams.get('folder')

    if (requestedMode === 'note') {
      setMode('note')
    }
    if (requestedFolderId) {
      setMode('note')
      setNoteFolderId(requestedFolderId)
    }
  }, [searchParams])

  const taskRecurrencePayload = useMemo(() => {
    if (!taskRecurrence) return null
    const base: RecurrenceRule = { frequency: taskRecurrence }
    if (taskRecurrence === 'custom') {
      const interval = Math.max(1, Number(taskCustomInterval || '1'))
      base.interval = interval
      base.unit = taskCustomUnit
    }
    return base
  }, [taskCustomInterval, taskCustomUnit, taskRecurrence])

  const saveTask = async () => {
    const dueAt = toIsoFromLocal({
      date: taskDate,
      time: taskTime,
      hasDueTime: Boolean(taskTime) && !taskAllDay,
      isAllDay: taskAllDay,
    })
    const reminderOffsetMinutes = taskReminderOffset.trim() ? Number(taskReminderOffset.trim()) : null
    const payload = {
      title: taskTitle.trim(),
      description: taskDescription.trim() || null,
      due_at: dueAt,
      is_all_day: taskAllDay,
      has_due_time: !taskAllDay && Boolean(taskTime),
      reminder_enabled: taskReminderEnabled,
      reminder_at: localDateTimeToIso(taskReminderAtLocal),
      reminder_offset_minutes:
        reminderOffsetMinutes != null && Number.isFinite(reminderOffsetMinutes) && reminderOffsetMinutes >= 0
          ? Math.trunc(reminderOffsetMinutes)
          : null,
      recurrence_rule: taskRecurrencePayload,
      priority: taskPriority || null,
      starred: taskStarred,
    }

    const res = await authedFetch('/api/notes/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(json?.error ?? 'Unable to create task.')
    }

    setTaskTitle('')
    setTaskDescription('')
    setTaskDate('')
    setTaskTime('')
    setTaskAllDay(false)
    setTaskReminderEnabled(false)
    setTaskReminderAtLocal('')
    setTaskReminderOffset('')
    setTaskRecurrence('')
    setTaskCustomInterval('1')
    setTaskPriority('')
    setTaskStarred(false)
  }

  const saveNote = async () => {
    const payload = {
      title: noteTitle.trim(),
      body: noteBody,
      folder_id: noteFolderId || null,
      starred: noteStarred,
    }
    const res = await authedFetch('/api/notes/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(json?.error ?? 'Unable to create note.')
    }

    setNoteTitle('')
    setNoteBody('')
    setNoteFolderId('')
    setNoteStarred(false)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'task') {
        if (!taskTitle.trim()) throw new Error('Task title is required.')
        await saveTask()
        setMessage('Task saved.')
      } else {
        if (!noteTitle.trim()) throw new Error('Note title is required.')
        await saveNote()
        setMessage('Note saved.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="grid gap-4 pb-14" onSubmit={submit}>
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('task')}
            className={`rounded-xl px-4 py-2 text-sm font-extrabold ${
              mode === 'task' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'
            }`}
          >
            Task
          </button>
          <button
            type="button"
            onClick={() => setMode('note')}
            className={`rounded-xl px-4 py-2 text-sm font-extrabold ${
              mode === 'note' ? 'bg-black text-white' : 'bg-gray-100 text-gray-800'
            }`}
          >
            Note
          </button>
        </div>
        <div className="text-sm text-gray-600">Capture first, organize later.</div>
      </section>

      {mode === 'task' ? (
        <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold text-gray-800">
            Title
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2"
              placeholder="Call supplier about paint pricing"
              required
            />
          </label>

          <label className="grid gap-1 text-sm font-semibold text-gray-800">
            Description
            <textarea
              value={taskDescription}
              onChange={(event) => setTaskDescription(event.target.value)}
              className="min-h-24 rounded-xl border border-gray-300 px-3 py-2"
              placeholder="Optional detail..."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-gray-800">
              Due Date
              <input
                type="date"
                value={taskDate}
                onChange={(event) => setTaskDate(event.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-gray-800">
              Due Time
              <input
                type="time"
                value={taskTime}
                onChange={(event) => setTaskTime(event.target.value)}
                disabled={taskAllDay}
                className="rounded-xl border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
            </label>
            <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input type="checkbox" checked={taskAllDay} onChange={(event) => setTaskAllDay(event.target.checked)} />
              <span>All day</span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input
                type="checkbox"
                checked={taskReminderEnabled}
                onChange={(event) => setTaskReminderEnabled(event.target.checked)}
              />
              <span>Reminder email</span>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-gray-800">
              Reminder Time
              <input
                type="datetime-local"
                value={taskReminderAtLocal}
                onChange={(event) => setTaskReminderAtLocal(event.target.value)}
                disabled={!taskReminderEnabled}
                className="rounded-xl border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-gray-800">
              Reminder Offset (min)
              <input
                type="number"
                min={0}
                value={taskReminderOffset}
                onChange={(event) => setTaskReminderOffset(event.target.value)}
                disabled={!taskReminderEnabled}
                className="rounded-xl border border-gray-300 px-3 py-2 disabled:bg-gray-100"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm font-semibold text-gray-800">
              Recurrence
              <select
                value={taskRecurrence}
                onChange={(event) => setTaskRecurrence(event.target.value as RecurrenceFrequency | '')}
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
            {taskRecurrence === 'custom' && (
              <>
                <label className="grid gap-1 text-sm font-semibold text-gray-800">
                  Every
                  <input
                    type="number"
                    min={1}
                    value={taskCustomInterval}
                    onChange={(event) => setTaskCustomInterval(event.target.value)}
                    className="rounded-xl border border-gray-300 px-3 py-2"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-gray-800">
                  Unit
                  <select
                    value={taskCustomUnit}
                    onChange={(event) => setTaskCustomUnit(event.target.value as RecurrenceUnit)}
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
            <label className="grid gap-1 text-sm font-semibold text-gray-800">
              Priority
              <select
                value={taskPriority}
                onChange={(event) => setTaskPriority(event.target.value as 'low' | 'medium' | 'high' | '')}
                className="rounded-xl border border-gray-300 px-3 py-2"
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input type="checkbox" checked={taskStarred} onChange={(event) => setTaskStarred(event.target.checked)} />
              <span>Starred</span>
            </label>
          </div>
        </section>
      ) : (
        <section className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <label className="grid gap-1 text-sm font-semibold text-gray-800">
            Title
            <input
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              className="rounded-xl border border-gray-300 px-3 py-2"
              placeholder="CRM feature idea"
              required
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-gray-800">
            Body
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              className="min-h-32 rounded-xl border border-gray-300 px-3 py-2"
              placeholder="Capture detail..."
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold text-gray-800">
              Folder (optional)
              <select
                value={noteFolderId}
                onChange={(event) => setNoteFolderId(event.target.value)}
                className="rounded-xl border border-gray-300 px-3 py-2"
              >
                <option value="">Uncategorized</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input type="checkbox" checked={noteStarred} onChange={(event) => setNoteStarred(event.target.checked)} />
              <span>Starred</span>
            </label>
          </div>
        </section>
      )}

      <div className="sticky bottom-3 z-10">
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-black px-4 py-3 text-base font-extrabold text-white disabled:opacity-60"
        >
          {saving ? 'Saving...' : `Save ${mode === 'task' ? 'Task' : 'Note'}`}
        </button>
      </div>

      {message && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    </form>
  )
}
