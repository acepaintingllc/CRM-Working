import type { NotesRecurrenceRule } from '@/lib/notes/types'

function isWeekend(day: number) {
  return day === 0 || day === 6
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime())
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function addMonthsKeepingDay(date: Date, months: number) {
  const sourceDay = date.getUTCDate()
  const next = new Date(date.getTime())
  next.setUTCDate(1)
  next.setUTCMonth(next.getUTCMonth() + months)

  const maxDay = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0, next.getUTCHours(), next.getUTCMinutes(), next.getUTCSeconds())
  ).getUTCDate()
  next.setUTCDate(Math.min(sourceDay, maxDay))
  return next
}

function addWeekdays(date: Date, count: number) {
  let remaining = Math.max(1, count)
  let cursor = new Date(date.getTime())
  while (remaining > 0) {
    cursor = addDays(cursor, 1)
    if (!isWeekend(cursor.getUTCDay())) {
      remaining -= 1
    }
  }
  return cursor
}

export function getRecurrenceInterval(rule: NotesRecurrenceRule) {
  return Math.max(1, Math.trunc(rule.interval ?? 1))
}

export function getNextRecurrenceDate(baseDate: Date, rule: NotesRecurrenceRule) {
  const interval = getRecurrenceInterval(rule)

  switch (rule.frequency) {
    case 'daily':
      return addDays(baseDate, interval)
    case 'weekdays':
      return addWeekdays(baseDate, interval)
    case 'weekly':
      return addDays(baseDate, interval * 7)
    case 'monthly':
      return addMonthsKeepingDay(baseDate, interval)
    case 'quarterly':
      return addMonthsKeepingDay(baseDate, interval * 3)
    case 'yearly':
      return addMonthsKeepingDay(baseDate, interval * 12)
    case 'custom': {
      const unit = rule.unit ?? 'day'
      if (unit === 'day') return addDays(baseDate, interval)
      if (unit === 'week') return addDays(baseDate, interval * 7)
      if (unit === 'month') return addMonthsKeepingDay(baseDate, interval)
      return addMonthsKeepingDay(baseDate, interval * 12)
    }
    default:
      return addDays(baseDate, 1)
  }
}

export function computeNextDueAtIso(params: {
  currentDueAtIso: string | null
  completedAt?: Date
  recurrenceRule: NotesRecurrenceRule
}) {
  const completedAt = params.completedAt ?? new Date()
  const baseDate = params.currentDueAtIso ? new Date(params.currentDueAtIso) : completedAt
  if (Number.isNaN(baseDate.getTime())) return null

  const next = getNextRecurrenceDate(baseDate, params.recurrenceRule)
  return next.toISOString()
}

export function recurrenceLabel(rule: NotesRecurrenceRule | null | undefined) {
  if (!rule) return 'No recurrence'
  const interval = getRecurrenceInterval(rule)
  if (rule.frequency === 'weekdays') return interval === 1 ? 'Weekdays' : `Every ${interval} weekdays`
  if (rule.frequency === 'quarterly') return interval === 1 ? 'Quarterly' : `Every ${interval} quarters`
  if (rule.frequency === 'custom') {
    const unit = rule.unit ?? 'day'
    return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`
  }
  return interval === 1
    ? `Every ${rule.frequency.replace('_', ' ')}`
    : `Every ${interval} ${rule.frequency.replace('_', ' ')}s`
}
