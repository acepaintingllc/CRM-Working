import type { CalendarEvent } from './types.ts'

export const selectedCalendarIdsStorageKey = 'acecrm.calendar.selected'

export function parseStoredCalendarIds(raw: string | null) {
  try {
    const parsed = raw ? JSON.parse(raw) : null
    if (!Array.isArray(parsed)) return null
    const ids = parsed.filter((value) => typeof value === 'string' && value.trim().length > 0)
    return ids.length > 0 ? (ids as string[]) : null
  } catch {
    return null
  }
}

export function readStoredCalendarIds() {
  if (typeof window === 'undefined') return null
  return parseStoredCalendarIds(window.localStorage.getItem(selectedCalendarIdsStorageKey))
}

export function monthKeyLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function isDateOnly(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

export function parseCalendarDate(value: string | null | undefined) {
  if (!value) return null
  if (isDateOnly(value)) {
    const [year, month, day] = value.split('-').map((part) => Number(part))
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function eventOccursToday(event: CalendarEvent, now: Date) {
  const start = parseCalendarDate(event.start)
  if (!start) return false

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  if (isDateOnly(event.start)) {
    const end = parseCalendarDate(event.end)
    const eventEnd = end ?? new Date(start.getTime() + 24 * 60 * 60 * 1000)
    return start < tomorrowStart && eventEnd > todayStart
  }

  const end = parseCalendarDate(event.end) ?? start
  return start < tomorrowStart && end >= todayStart
}

export function eventSortValue(event: CalendarEvent) {
  const start = parseCalendarDate(event.start)
  return start?.getTime() ?? Number.MAX_SAFE_INTEGER
}

export function formatEventWindow(start: string | null, end: string | null) {
  const startDate = parseCalendarDate(start)
  const endDate = parseCalendarDate(end)
  if (!startDate) return 'Time TBD'
  if (isDateOnly(start) && isDateOnly(end)) {
    return `${startDate.toLocaleDateString()} (all day)`
  }
  if (isDateOnly(start) && !end) {
    return `${startDate.toLocaleDateString()} (all day)`
  }
  if (endDate) {
    const sameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate()
    if (sameDay) {
      return `${startDate.toLocaleDateString()} | ${startDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    }
    return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`
  }
  return startDate.toLocaleString()
}
