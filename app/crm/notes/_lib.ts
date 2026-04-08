'use client'

export type RecurrenceFrequency =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom'

export type RecurrenceUnit = 'day' | 'week' | 'month' | 'year'

export type RecurrenceRule = {
  frequency: RecurrenceFrequency
  interval?: number
  unit?: RecurrenceUnit
}

export type TaskRow = {
  id: string
  title: string
  description: string | null
  status: 'active' | 'completed' | 'archived'
  due_at: string | null
  is_all_day: boolean
  has_due_time: boolean
  reminder_enabled: boolean
  reminder_at: string | null
  reminder_offset_minutes: number | null
  recurrence_rule: RecurrenceRule | null
  recurrence_series_id: string | null
  priority: 'low' | 'medium' | 'high' | null
  starred: boolean
  source_note_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  archived_at: string | null
}

export type NoteRow = {
  id: string
  title: string
  body: string
  folder_id: string | null
  status: 'active' | 'archived'
  starred: boolean
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type FolderRow = {
  id: string
  name: string
  sort_order: number
  note_count?: number
}

export type SettingsRow = {
  org_id: string
  sender_user_id: string | null
  daily_summary_email_to: string | null
  daily_summary_time_local: string
  timezone: string
  show_upcoming_days: number
  last_daily_summary_attempted_on: string | null
  last_daily_summary_sent_on: string | null
}

export const recurrenceOptions: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
]

export const recurrenceUnitOptions: Array<{ value: RecurrenceUnit; label: string }> = [
  { value: 'day', label: 'Days' },
  { value: 'week', label: 'Weeks' },
  { value: 'month', label: 'Months' },
  { value: 'year', label: 'Years' },
]

export function toLocalDateInput(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toLocalTimeInput(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function toIsoFromLocal(params: {
  date: string
  time: string
  hasDueTime: boolean
  isAllDay: boolean
}) {
  if (!params.date) return null
  const timeValue = params.isAllDay || !params.hasDueTime ? '09:00' : params.time || '09:00'
  const localDate = new Date(`${params.date}T${timeValue}`)
  if (Number.isNaN(localDate.getTime())) return null
  return localDate.toISOString()
}

export function formatDue(iso: string | null, allDay: boolean, hasDueTime: boolean) {
  if (!iso) return 'No due date'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (allDay || !hasDueTime) return d.toLocaleDateString()
  return d.toLocaleString()
}

export function recurrenceLabel(rule: RecurrenceRule | null) {
  if (!rule) return 'None'
  const interval = Math.max(1, Math.trunc(rule.interval ?? 1))
  if (rule.frequency === 'weekdays') return interval === 1 ? 'Weekdays' : `Every ${interval} weekdays`
  if (rule.frequency === 'quarterly') return interval === 1 ? 'Quarterly' : `Every ${interval} quarters`
  if (rule.frequency === 'custom') {
    const unit = rule.unit ?? 'day'
    return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`
  }
  if (rule.frequency === 'daily') return interval === 1 ? 'Daily' : `Every ${interval} days`
  if (rule.frequency === 'weekly') return interval === 1 ? 'Weekly' : `Every ${interval} weeks`
  if (rule.frequency === 'monthly') return interval === 1 ? 'Monthly' : `Every ${interval} months`
  return interval === 1 ? 'Yearly' : `Every ${interval} years`
}
