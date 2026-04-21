'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { toIsoFromLocal, toLocalDateInput, toLocalTimeInput } from '@/lib/notes/time'
import type {
  NotesTaskResponse,
  NotesTaskRow,
  RecurrenceFrequency,
  RecurrenceUnit,
} from '@/lib/notes/types'
import { useEffect, useMemo, useState } from 'react'

type UseTaskFormParams = {
  open: boolean
  taskId?: string | null
  onSuccess: () => void
}

function localDateTimeToIso(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function useTaskForm({ open, taskId, onSuccess }: UseTaskFormParams) {
  const [loading, setLoading] = useState(Boolean(taskId))
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
    if (!open) return
    if (!taskId) {
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
      const res = await authedFetch(`/api/notes/tasks/${taskId}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (cancelled) return
      if (!res.ok) {
        setError(payload?.error ?? 'Unable to load task.')
        setLoading(false)
        return
      }

      const task = (payload as NotesTaskResponse | null)?.task ?? null
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
  }, [open, taskId])

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

    const res = await authedFetch(taskId ? `/api/notes/tasks/${taskId}` : '/api/notes/tasks', {
      method: taskId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)

    if (!res.ok) {
      setError(payload?.error ?? 'Unable to save task.')
      return
    }

    onSuccess()
  }

  return {
    loading,
    error,
    saving,
    title,
    setTitle,
    description,
    setDescription,
    dueDate,
    setDueDate,
    dueTime,
    setDueTime,
    allDay,
    setAllDay,
    reminderEnabled,
    setReminderEnabled,
    reminderAtLocal,
    setReminderAtLocal,
    reminderOffset,
    setReminderOffset,
    priority,
    setPriority,
    starred,
    setStarred,
    recurrence,
    setRecurrence,
    customInterval,
    setCustomInterval,
    customUnit,
    setCustomUnit,
    handleSave,
  }
}
