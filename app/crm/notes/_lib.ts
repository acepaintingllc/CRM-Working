'use client'

import type { NotesRecurrenceRule, RecurrenceFrequency, RecurrenceUnit } from '@/lib/notes/types'

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

export function recurrenceLabel(rule: NotesRecurrenceRule | null) {
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
