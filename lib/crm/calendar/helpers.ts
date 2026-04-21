import { isDateOnly, parseCalendarDate } from '../home/calendar.ts'

import type { CalendarEvent, MonthWeekRow, WeekSegment } from './types.ts'

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromLocalKey(key: string) {
  const [year, month, day] = key.split('-').map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

export function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function buildMonthWeeks(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const gridStart = addDays(first, -first.getDay())
  const gridEnd = addDays(last, 6 - last.getDay())
  const days: Date[] = []

  for (let day = gridStart; day.getTime() <= gridEnd.getTime(); day = addDays(day, 1)) {
    days.push(day)
  }

  const weeks: Date[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }
  return weeks
}

export function resolveSelectedDayKeyForMonth(selectedDayKey: string, month: Date) {
  const selectedDay = dateFromLocalKey(selectedDayKey)
  if (
    selectedDay &&
    selectedDay.getFullYear() === month.getFullYear() &&
    selectedDay.getMonth() === month.getMonth()
  ) {
    return selectedDayKey
  }

  return localDateKey(new Date(month.getFullYear(), month.getMonth(), 1))
}

export function eventTouchesDay(event: CalendarEvent, day: Date) {
  const start = parseCalendarDate(event.start)
  if (!start) return false

  const dayStart = startOfLocalDay(day)
  const dayEnd = addDays(dayStart, 1)
  const end = parseCalendarDate(event.end)

  if (isDateOnly(event.start)) {
    const exclusiveEnd = end ?? addDays(startOfLocalDay(start), 1)
    return startOfLocalDay(start).getTime() < dayEnd.getTime() && exclusiveEnd.getTime() > dayStart.getTime()
  }

  if (!end) return sameLocalDay(start, dayStart)
  return start.getTime() < dayEnd.getTime() && end.getTime() > dayStart.getTime()
}

export function eventSpansMultipleDays(event: CalendarEvent) {
  const start = parseCalendarDate(event.start)
  const end = parseCalendarDate(event.end)
  if (!start || !end) return false
  const adjustedEnd = isDateOnly(event.end) ? addDays(end, -1) : end
  return !sameLocalDay(startOfLocalDay(start), startOfLocalDay(adjustedEnd))
}

export function formatEventTime(start: string | null, end: string | null) {
  const startDate = parseCalendarDate(start)
  const endDate = parseCalendarDate(end)
  if (!startDate) return 'Time TBD'
  if (isDateOnly(start)) return 'All day'

  const startTime = startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (!endDate) return startTime

  if (sameLocalDay(startDate, endDate)) {
    return `${startTime} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  }

  return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`
}

export function eventLabel(event: CalendarEvent) {
  const title = event.summary ?? '(No title)'
  if (isDateOnly(event.start)) return title
  return `${formatEventTime(event.start, event.end).split(' - ')[0]} ${title}`
}

export function monthTitle(date: Date) {
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

export function dayNumberLabel(day: Date, month: Date) {
  const label = String(day.getDate())
  if (day.getDate() !== 1) return label
  if (day.getMonth() === month.getMonth()) return label
  return day.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function getContrastText(background: string | null | undefined) {
  if (!background || !/^#[0-9a-f]{6}$/i.test(background)) return 'white'
  const r = Number.parseInt(background.slice(1, 3), 16)
  const g = Number.parseInt(background.slice(3, 5), 16)
  const b = Number.parseInt(background.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#111827' : 'white'
}

export function computeWeekSegments(week: Date[], events: CalendarEvent[]) {
  const segments: WeekSegment[] = []
  const rows: Array<Array<{ start: number; end: number }>> = []

  for (const event of events) {
    const touched = week
      .map((day, index) => (eventTouchesDay(event, day) ? index : -1))
      .filter((index) => index >= 0)
    if (touched.length === 0) continue

    const startIndex = Math.min(...touched)
    const endIndex = Math.max(...touched)
    const bar = isDateOnly(event.start) || eventSpansMultipleDays(event)
    let row = 0

    while (rows[row]?.some((taken) => startIndex <= taken.end && endIndex >= taken.start)) {
      row += 1
    }

    rows[row] = rows[row] ?? []
    rows[row].push({ start: startIndex, end: endIndex })
    segments.push({ event, startIndex, endIndex, row, bar })
  }

  return segments
}

export function buildMonthWeekRows(monthWeeks: Date[][], events: CalendarEvent[]): MonthWeekRow[] {
  return monthWeeks.map((week) => {
    const segments = computeWeekSegments(week, events)
    const rowCount = Math.max(1, ...segments.map((segment) => segment.row + 1))

    return {
      week,
      weekKey: week.map((day) => localDateKey(day)).join(':'),
      rowCount,
      weekMinHeight: Math.max(132, 48 + rowCount * 24),
      segments,
    }
  })
}
