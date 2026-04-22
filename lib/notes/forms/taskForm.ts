import { toIsoFromLocal, toLocalDateInput, toLocalTimeInput } from '../time.ts'
import type {
  NotesPriority,
  NotesRecurrenceRule,
  NotesTaskResponse,
  NotesTaskRow,
  RecurrenceFrequency,
  RecurrenceUnit,
} from '../types.ts'
import type { NotesFormSubmitResult } from './shared'

export type NotesTaskFormValues = {
  title: string
  description: string
  dueDate: string
  dueTime: string
  allDay: boolean
  reminderEnabled: boolean
  reminderAtLocal: string
  reminderOffset: string
  priority: NotesPriority | ''
  starred: boolean
  recurrence: RecurrenceFrequency | ''
  customInterval: string
  customUnit: RecurrenceUnit
}

export type NotesTaskUpsertPayload = {
  title: string
  description: string | null
  due_at: string | null
  is_all_day: boolean
  has_due_time: boolean
  reminder_enabled: boolean
  reminder_at: string | null
  reminder_offset_minutes: number | null
  priority: NotesPriority | null
  starred: boolean
  recurrence_rule: NotesRecurrenceRule | null
}

function localDateTimeToIso(value: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function createEmptyTaskFormValues(): NotesTaskFormValues {
  return {
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    allDay: false,
    reminderEnabled: false,
    reminderAtLocal: '',
    reminderOffset: '',
    priority: '',
    starred: false,
    recurrence: '',
    customInterval: '1',
    customUnit: 'week',
  }
}

export function taskRowToFormValues(task: NotesTaskRow): NotesTaskFormValues {
  return {
    title: task.title,
    description: task.description ?? '',
    dueDate: toLocalDateInput(task.due_at),
    dueTime: toLocalTimeInput(task.due_at),
    allDay: task.is_all_day,
    reminderEnabled: task.reminder_enabled,
    reminderAtLocal: task.reminder_at ? task.reminder_at.slice(0, 16) : '',
    reminderOffset: task.reminder_offset_minutes == null ? '' : String(task.reminder_offset_minutes),
    priority: task.priority ?? '',
    starred: task.starred,
    recurrence: task.recurrence_rule?.frequency ?? '',
    customInterval: String(task.recurrence_rule?.interval ?? 1),
    customUnit: task.recurrence_rule?.unit ?? 'week',
  }
}

export function taskResponseToFormValues(payload: NotesTaskResponse | null) {
  return payload?.task ? taskRowToFormValues(payload.task) : null
}

export function taskFormValuesToPayload(values: NotesTaskFormValues): NotesFormSubmitResult<NotesTaskUpsertPayload> {
  if (!values.title.trim()) {
    return { ok: false, error: 'Task title is required.' }
  }

  const recurrenceRule: NotesRecurrenceRule | null =
    !values.recurrence
      ? null
      : values.recurrence === 'custom'
        ? {
            frequency: 'custom',
            interval: Math.max(1, Number(values.customInterval || '1')),
            unit: values.customUnit,
          }
        : { frequency: values.recurrence }

  return {
    ok: true,
    payload: {
      title: values.title.trim(),
      description: values.description.trim() || null,
      due_at: toIsoFromLocal({
        date: values.dueDate,
        time: values.dueTime,
        hasDueTime: !values.allDay && Boolean(values.dueTime),
        isAllDay: values.allDay,
      }),
      is_all_day: values.allDay,
      has_due_time: !values.allDay && Boolean(values.dueTime),
      reminder_enabled: values.reminderEnabled,
      reminder_at: localDateTimeToIso(values.reminderAtLocal),
      reminder_offset_minutes: values.reminderOffset.trim() ? Number(values.reminderOffset.trim()) : null,
      priority: values.priority || null,
      starred: values.starred,
      recurrence_rule: recurrenceRule,
    },
  }
}
