export type NotesTaskStatus = 'active' | 'completed' | 'archived'
export type NotesNoteStatus = 'active' | 'archived'
export type NotesPriority = 'low' | 'medium' | 'high'

export type NotesReminderType =
  | 'daily_summary'
  | 'single_task_reminder'
  | 'recurring_task_reminder'

export type RecurrenceFrequency =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom'

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'

export type NotesRecurrenceRule = {
  frequency: RecurrenceFrequency
  interval?: number
  unit?: RecurrenceUnit
}

export type NotesTaskRow = {
  id: string
  org_id: string
  title: string
  description: string | null
  status: NotesTaskStatus
  due_at: string | null
  is_all_day: boolean
  has_due_time: boolean
  reminder_enabled: boolean
  reminder_at: string | null
  reminder_offset_minutes: number | null
  reminder_sent_at: string | null
  recurrence_rule: NotesRecurrenceRule | null
  recurrence_series_id: string | null
  priority: NotesPriority | null
  starred: boolean
  source_note_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  archived_at: string | null
}

export type NotesNoteRow = {
  id: string
  org_id: string
  title: string
  body: string
  folder_id: string | null
  status: NotesNoteStatus
  starred: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type NotesFolderRow = {
  id: string
  org_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export type NotesFolderWithCount = NotesFolderRow & {
  note_count: number
}

export type NotesSettingsRow = {
  org_id: string
  sender_user_id: string | null
  daily_summary_email_to: string | null
  daily_summary_time_local: string
  timezone: string
  show_upcoming_days: number
  last_daily_summary_attempted_on: string | null
  last_daily_summary_sent_on: string | null
  created_at: string
  updated_at: string
}

export type NotesTaskResponse = {
  ok?: true
  task: NotesTaskRow
}

export type NotesTasksResponse = {
  tasks: NotesTaskRow[]
  filters: {
    status: NotesTaskStatus
    due: string
    starred: boolean
    priority: NotesPriority | null
  }
}

export type NotesNoteResponse = {
  ok?: true
  note: NotesNoteRow
}

export type NotesNotesResponse = {
  notes: NotesNoteRow[]
  filters: {
    status: NotesNoteStatus
    folder_id: string | null
    search: string
  }
}

export type NotesFolderResponse = {
  ok?: true
  folder: NotesFolderRow
}

export type NotesFoldersResponse = {
  folders: NotesFolderWithCount[]
}

export type NotesFolderDeleteResponse = {
  error?: string
  notes_count?: number
  required?: boolean
}

export type NotesDashboardResponse = {
  today: {
    timezone: string
    date_key: string
  }
  settings: {
    upcoming_days: number
  }
  tasks: {
    overdue: NotesTaskRow[]
    due_today: NotesTaskRow[]
    upcoming: NotesTaskRow[]
    untimed_today: NotesTaskRow[]
  }
  notes: {
    starred: NotesNoteRow[]
    recent: NotesNoteRow[]
  }
}

export type NotesConvertToTaskResponse = {
  ok?: true
  task?: {
    id: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}

export function parseRecurrenceRule(value: unknown): NotesRecurrenceRule | null {
  if (!isRecord(value)) return null

  const frequency = typeof value.frequency === 'string' ? value.frequency : ''
  const allowedFrequency: RecurrenceFrequency[] = [
    'daily',
    'weekdays',
    'weekly',
    'monthly',
    'quarterly',
    'yearly',
    'custom',
  ]
  if (!allowedFrequency.includes(frequency as RecurrenceFrequency)) return null

  const intervalRaw = value.interval
  const interval =
    typeof intervalRaw === 'number' && Number.isInteger(intervalRaw) && intervalRaw > 0
      ? intervalRaw
      : undefined

  const unitRaw = typeof value.unit === 'string' ? value.unit : undefined
  const allowedUnit: RecurrenceUnit[] = ['day', 'week', 'month', 'year']
  const unit =
    unitRaw && allowedUnit.includes(unitRaw as RecurrenceUnit)
      ? (unitRaw as RecurrenceUnit)
      : undefined

  if (frequency === 'custom' && !unit) return null

  return {
    frequency: frequency as RecurrenceFrequency,
    interval,
    unit,
  }
}
