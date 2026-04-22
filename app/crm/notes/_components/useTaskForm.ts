'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import {
  createEmptyTaskFormValues,
  taskFormValuesToPayload,
  taskResponseToFormValues,
  type NotesTaskFormValues,
} from '@/lib/notes/forms/taskForm'
import { mapNotesFormServerError, useNotesFormState } from '@/lib/notes/forms/shared'
import type { NotesTaskResponse, RecurrenceFrequency, RecurrenceUnit } from '@/lib/notes/types'
import { useEffect, useState } from 'react'

type UseTaskFormParams = {
  open: boolean
  taskId?: string | null
  onSuccess: () => void
}

export function useTaskForm({ open, taskId, onSuccess }: UseTaskFormParams) {
  const [loading, setLoading] = useState(Boolean(taskId))
  const [initialValues, setInitialValues] = useState<NotesTaskFormValues>(createEmptyTaskFormValues())
  const form = useNotesFormState({
    initialValues,
    prepareSubmit: taskFormValuesToPayload,
    onSubmit: async (payload) => {
      const res = await authedFetch(taskId ? `/api/notes/tasks/${taskId}` : '/api/notes/tasks', {
        method: taskId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const responsePayload = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(mapNotesFormServerError(responsePayload, 'Unable to save task.'))
      }
      onSuccess()
    },
    fallbackMessage: 'Unable to save task.',
  })
  const { setError } = form

  useEffect(() => {
    if (!open) return
    if (!taskId) {
      setLoading(false)
      setInitialValues(createEmptyTaskFormValues())
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
        setError(mapNotesFormServerError(payload, 'Unable to load task.'))
        setLoading(false)
        return
      }

      const values = taskResponseToFormValues(payload as NotesTaskResponse | null)
      if (!values) {
        setError('Task not found.')
        setLoading(false)
        return
      }

      setInitialValues(values)
      setLoading(false)
    }

    void loadTask()
    return () => {
      cancelled = true
    }
  }, [open, setError, taskId])

  const values = form.values
  const updateField = <K extends keyof NotesTaskFormValues>(field: K, value: NotesTaskFormValues[K]) => {
    form.setValues((current) => ({ ...current, [field]: value }))
  }

  return {
    loading,
    error: form.error,
    saving: form.saving,
    dirty: form.dirty,
    title: values.title,
    setTitle: (value: string) => updateField('title', value),
    description: values.description,
    setDescription: (value: string) => updateField('description', value),
    dueDate: values.dueDate,
    setDueDate: (value: string) => updateField('dueDate', value),
    dueTime: values.dueTime,
    setDueTime: (value: string) => updateField('dueTime', value),
    allDay: values.allDay,
    setAllDay: (value: boolean) => updateField('allDay', value),
    reminderEnabled: values.reminderEnabled,
    setReminderEnabled: (value: boolean) => updateField('reminderEnabled', value),
    reminderAtLocal: values.reminderAtLocal,
    setReminderAtLocal: (value: string) => updateField('reminderAtLocal', value),
    reminderOffset: values.reminderOffset,
    setReminderOffset: (value: string) => updateField('reminderOffset', value),
    priority: values.priority,
    setPriority: (value: 'low' | 'medium' | 'high' | '') => updateField('priority', value),
    starred: values.starred,
    setStarred: (value: boolean) => updateField('starred', value),
    recurrence: values.recurrence,
    setRecurrence: (value: RecurrenceFrequency | '') => updateField('recurrence', value),
    customInterval: values.customInterval,
    setCustomInterval: (value: string) => updateField('customInterval', value),
    customUnit: values.customUnit,
    setCustomUnit: (value: RecurrenceUnit) => updateField('customUnit', value),
    handleSave: form.submit,
  }
}
