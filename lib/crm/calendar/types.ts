export type CalendarInfo = {
  id: string
  summary: string | null
  primary: boolean
  backgroundColor: string | null
  foregroundColor: string | null
}

export type CalendarEvent = {
  id: string
  calendarId: string
  summary: string | null
  start: string | null
  end: string | null
  htmlLink: string | null
}

export type WeekSegment = {
  event: CalendarEvent
  startIndex: number
  endIndex: number
  row: number
  bar: boolean
}

export type CalendarLoadPhase = 'idle' | 'loading' | 'ready' | 'error'

export type MonthWeekRow = {
  week: Date[]
  weekKey: string
  rowCount: number
  weekMinHeight: number
  segments: WeekSegment[]
}
