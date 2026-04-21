'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import {
  eventSortValue,
  isDateOnly,
  monthKeyLocal,
  parseCalendarDate,
  readStoredCalendarIds,
  selectedCalendarIdsStorageKey,
} from '@/lib/crm/home/calendar'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type CalendarInfo = {
  id: string
  summary: string | null
  primary: boolean
  backgroundColor: string | null
  foregroundColor: string | null
}

type CalendarEvent = {
  id: string
  calendarId: string
  summary: string | null
  start: string | null
  end: string | null
  htmlLink: string | null
}

type WeekSegment = {
  event: CalendarEvent
  startIndex: number
  endIndex: number
  row: number
  bar: boolean
}

type GoogleEmbedMode = 'MONTH' | 'WEEK' | 'AGENDA'

const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromLocalKey(key: string) {
  const [year, month, day] = key.split('-').map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function sameLocalDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function buildMonthWeeks(month: Date) {
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

function eventTouchesDay(event: CalendarEvent, day: Date) {
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

function eventSpansMultipleDays(event: CalendarEvent) {
  const start = parseCalendarDate(event.start)
  const end = parseCalendarDate(event.end)
  if (!start || !end) return false
  const adjustedEnd = isDateOnly(event.end) ? addDays(end, -1) : end
  return !sameLocalDay(startOfLocalDay(start), startOfLocalDay(adjustedEnd))
}

function formatEventTime(start: string | null, end: string | null) {
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

function eventLabel(event: CalendarEvent) {
  const title = event.summary ?? '(No title)'
  if (isDateOnly(event.start)) return title
  return `${formatEventTime(event.start, event.end).split(' - ')[0]} ${title}`
}

function monthTitle(date: Date) {
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function dayNumberLabel(day: Date, month: Date) {
  const label = String(day.getDate())
  if (day.getDate() !== 1) return label
  if (day.getMonth() === month.getMonth()) return label
  return day.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function getContrastText(background: string | null | undefined) {
  if (!background || !/^#[0-9a-f]{6}$/i.test(background)) return 'white'
  const r = Number.parseInt(background.slice(1, 3), 16)
  const g = Number.parseInt(background.slice(3, 5), 16)
  const b = Number.parseInt(background.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#111827' : 'white'
}

function computeWeekSegments(week: Date[], events: CalendarEvent[]) {
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

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const today = useMemo(() => startOfLocalDay(new Date()), [])
  const [connected, setConnected] = useState<boolean | null>(null)
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDayKey, setSelectedDayKey] = useState(localDateKey(today))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventsRefreshNonce, setEventsRefreshNonce] = useState(0)
  const [showGoogleEmbed, setShowGoogleEmbed] = useState(false)
  const [embedMode, setEmbedMode] = useState<GoogleEmbedMode>('MONTH')

  const selectedIdsParam = useMemo(() => selectedCalendarIds.join(','), [selectedCalendarIds])
  const calendarById = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar])),
    [calendars]
  )
  const monthWeeks = useMemo(() => buildMonthWeeks(visibleMonth), [visibleMonth])
  const selectedDay = useMemo(() => dateFromLocalKey(selectedDayKey) ?? today, [selectedDayKey, today])
  const selectedDayEvents = useMemo(
    () => events.filter((event) => eventTouchesDay(event, selectedDay)).sort((a, b) => eventSortValue(a) - eventSortValue(b)),
    [events, selectedDay]
  )

  const loadStatusAndCalendars = async () => {
    setLoading(true)
    setError(null)

    const statusRes = await authedFetch('/api/google-calendar/status', { cache: 'no-store' })
    const statusPayload = await statusRes.json().catch(() => null)
    if (!statusRes.ok) {
      setError(statusPayload?.error ?? statusRes.statusText)
      setConnected(false)
      setCalendars([])
      setSelectedCalendarIds([])
      setEvents([])
      setLoading(false)
      return
    }

    const isConnected = Boolean(statusPayload?.connected)
    setConnected(isConnected)

    if (!isConnected) {
      setCalendars([])
      setSelectedCalendarIds([])
      setEvents([])
      setEventsError(null)
      setLoading(false)
      return
    }

    const calRes = await authedFetch('/api/google-calendar/calendars', { cache: 'no-store' })
    const calPayload = await calRes.json().catch(() => null)
    if (!calRes.ok) {
      setError(calPayload?.error ?? calRes.statusText)
      setCalendars([])
      setSelectedCalendarIds([])
      setEvents([])
      setLoading(false)
      return
    }

    const list: CalendarInfo[] = calPayload?.calendars ?? []
    setCalendars(list)

    const stored = readStoredCalendarIds()
    const validStored = (stored ?? []).filter((id) => list.some((calendar) => calendar.id === id))

    const primary = list.find((calendar) => calendar.primary)?.id ?? 'primary'
    const austins =
      list.find((calendar) => (calendar.summary ?? '').toLowerCase() === "austin's work")?.id ?? null
    const defaultSelection = austins
      ? [austins, primary].filter((value, index, arr) => arr.indexOf(value) === index)
      : [primary]

    const initialSelection = validStored.length > 0 ? validStored : defaultSelection
    setSelectedCalendarIds(initialSelection)
    setLoading(false)
  }

  useEffect(() => {
    void loadStatusAndCalendars()
  }, [])

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) setError(err)
  }, [searchParams])

  useEffect(() => {
    try {
      localStorage.setItem(selectedCalendarIdsStorageKey, JSON.stringify(selectedCalendarIds))
    } catch {
      // ignore
    }
  }, [selectedCalendarIds])

  useEffect(() => {
    if (!connected || selectedCalendarIds.length === 0) {
      setEvents([])
      setEventsError(null)
      setEventsLoading(false)
      return
    }

    let cancelled = false
    const loadEvents = async () => {
      setEventsLoading(true)
      setEventsError(null)
      const params = new URLSearchParams()
      params.set('calendar_ids', selectedIdsParam)
      params.set('limit', '250')
      params.set('month', monthKeyLocal(visibleMonth))
      const res = await authedFetch(`/api/google-calendar/events?${params.toString()}`, {
        cache: 'no-store',
      })
      const payload = await res.json().catch(() => null)
      if (cancelled) return

      if (!res.ok) {
        setEvents([])
        setEventsError(payload?.error ?? res.statusText)
        setEventsLoading(false)
        return
      }

      const rows = (payload?.events ?? []) as CalendarEvent[]
      setEvents([...rows].sort((a, b) => eventSortValue(a) - eventSortValue(b)))
      setEventsLoading(false)
    }

    void loadEvents()
    return () => {
      cancelled = true
    }
  }, [connected, selectedCalendarIds, selectedIdsParam, visibleMonth, eventsRefreshNonce])

  const connect = async () => {
    setLoading(true)
    setError(null)
    const res = await authedFetch('/api/google-calendar/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ next: '/crm/calendar' }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      setLoading(false)
      return
    }
    const url = typeof payload?.url === 'string' ? payload.url : null
    if (!url) {
      setError('Failed to start Google connection')
      setLoading(false)
      return
    }
    window.location.href = url
  }

  const disconnect = async () => {
    setLoading(true)
    setError(null)
    const res = await authedFetch('/api/google-calendar/disconnect', { method: 'POST' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      setLoading(false)
      return
    }

    setCalendars([])
    setSelectedCalendarIds([])
    setEvents([])
    setEventsError(null)
    await loadStatusAndCalendars()
  }

  const refreshAll = async () => {
    await loadStatusAndCalendars()
    setEventsRefreshNonce((prev) => prev + 1)
  }

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    )
  }

  const goToToday = () => {
    const nextToday = startOfLocalDay(new Date())
    setVisibleMonth(new Date(nextToday.getFullYear(), nextToday.getMonth(), 1))
    setSelectedDayKey(localDateKey(nextToday))
  }

  const googleEmbedSrc = useMemo(() => {
    if (!selectedCalendarIds.length) return ''
    const url = new URL('https://calendar.google.com/calendar/embed')
    url.searchParams.set('mode', embedMode)
    url.searchParams.set('wkst', '1')
    url.searchParams.set('bgcolor', '#ffffff')
    for (const id of selectedCalendarIds) {
      url.searchParams.append('src', id)
    }
    return url.toString()
  }, [embedMode, selectedCalendarIds])

  const openGoogleUrl = useMemo(() => {
    const url = new URL('https://calendar.google.com/calendar/u/0/r')
    for (const id of selectedCalendarIds) {
      url.searchParams.append('cid', id)
    }
    return url.toString()
  }, [selectedCalendarIds])

  return (
    <div className="crm-page" style={{ maxWidth: 1460, margin: '0 auto' }}>
      <div className="crm-topbar" style={{ marginBottom: 10 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Calendar</h1>
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--crm-muted)' }}>
            Month board from Google Calendar. Use Google for editing.
          </div>
        </div>

        <div className="crm-actions" style={{ gap: 8 }}>
          <button onClick={() => void refreshAll()} style={button}>
            Refresh
          </button>
          {connected ? (
            <button onClick={() => void disconnect()} style={button}>
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => void connect()}
              style={{ ...button, background: 'var(--crm-accent)', color: 'var(--crm-accent-text)', border: '1px solid var(--crm-accent)' }}
            >
              Connect Google
            </button>
          )}
          <a
            href={openGoogleUrl}
            target="_blank"
            rel="noreferrer"
            style={{ ...button, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
          >
            Open in Google
          </a>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 10,
            background: 'var(--crm-card)',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: 12,
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      {connected === false ? (
        <div
          style={{
            marginTop: 12,
            background: 'var(--crm-card)',
            border: '1px solid var(--crm-border-soft)',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--crm-text)' }}>Connect Google Calendar</div>
          <div style={{ marginTop: 6, color: 'var(--crm-muted)', fontSize: 14 }}>
            Link Google to show your month view here without relying on the embedded Google calendar.
          </div>
          <button
            onClick={() => void connect()}
            style={{ ...button, marginTop: 14, background: 'var(--crm-accent)', color: 'var(--crm-accent-text)', border: '1px solid var(--crm-accent)' }}
          >
            Connect Google
          </button>
        </div>
      ) : connected === null ? (
        <div style={{ marginTop: 12, color: 'var(--crm-muted)' }}>Loading calendar...</div>
      ) : (
        <>
          <div
            style={{
              marginBottom: 10,
              background: 'var(--crm-card)',
              border: '1px solid var(--crm-border-soft)',
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800 }}>Calendars</div>
              <div style={{ fontSize: 12, color: 'var(--crm-muted)' }}>
                {selectedCalendarIds.length} selected
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {calendars.map((calendar) => {
                const active = selectedCalendarIds.includes(calendar.id)
                return (
                  <label
                    key={calendar.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: active ? '1px solid var(--crm-accent)' : '1px solid var(--crm-border-soft)',
                      borderRadius: 10,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      background: active ? 'var(--crm-bg-soft)' : 'var(--crm-card)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleCalendar(calendar.id)}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: calendar.backgroundColor ?? '#9ca3af',
                        border: '1px solid rgba(0,0,0,0.1)',
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--crm-text)' }}>
                      {calendar.summary ?? calendar.id}
                      {calendar.primary ? ' (Primary)' : ''}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="calendar-shell">
            <main className="month-panel">
              <div className="month-toolbar">
                <div className="month-title-block">
                  <div className="month-title">{monthTitle(visibleMonth)}</div>
                  <div className="month-subtitle">
                    {eventsLoading ? 'Loading events...' : `${events.length} event${events.length === 1 ? '' : 's'} loaded`}
                  </div>
                </div>
                <div className="month-actions">
                  <button type="button" onClick={() => setVisibleMonth((prev) => addMonths(prev, -1))} style={pillButton}>
                    Prev
                  </button>
                  <button type="button" onClick={goToToday} style={pillButton}>
                    Today
                  </button>
                  <button type="button" onClick={() => setVisibleMonth((prev) => addMonths(prev, 1))} style={pillButton}>
                    Next
                  </button>
                </div>
              </div>

              {selectedCalendarIds.length === 0 ? (
                <div style={emptyState}>Choose calendars above to show your month board.</div>
              ) : eventsError ? (
                <div
                  style={{
                    border: '1px solid var(--crm-danger-border)',
                    background: 'var(--crm-danger-bg)',
                    color: 'var(--crm-danger-text)',
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 13,
                  }}
                >
                  {eventsError}
                </div>
              ) : (
                <div className="month-board" aria-busy={eventsLoading}>
                  <div className="month-weekday-row">
                    {weekDays.map((weekday) => (
                      <div key={weekday} className="weekday-label">
                        {weekday}
                      </div>
                    ))}
                  </div>

                  {monthWeeks.map((week) => {
                    const segments = computeWeekSegments(week, events)
                    const rowCount = Math.max(1, ...segments.map((segment) => segment.row + 1))
                    const weekMinHeight = Math.max(132, 48 + rowCount * 24)

                    return (
                      <div
                        key={week.map((day) => localDateKey(day)).join(':')}
                        className="month-week"
                        style={{ minHeight: weekMinHeight }}
                      >
                        {week.map((day) => {
                          const dayKey = localDateKey(day)
                          const selected = selectedDayKey === dayKey
                          const isToday = sameLocalDay(day, today)
                          const inMonth = day.getMonth() === visibleMonth.getMonth()

                          return (
                            <button
                              key={dayKey}
                              type="button"
                              className="day-cell"
                              onClick={() => setSelectedDayKey(dayKey)}
                              data-selected={selected ? 'true' : 'false'}
                              data-muted={inMonth ? 'false' : 'true'}
                            >
                              <span className={isToday ? 'day-number today-number' : 'day-number'}>
                                {dayNumberLabel(day, visibleMonth)}
                              </span>
                            </button>
                          )
                        })}

                        <div className="event-layer" style={{ gridTemplateRows: `repeat(${rowCount}, 20px)` }}>
                          {segments.map((segment) => {
                            const calendar = calendarById.get(segment.event.calendarId)
                            const color = calendar?.backgroundColor ?? '#0ea5e9'
                            const textColor = getContrastText(color)
                            const timedDotStyle = segment.bar
                              ? undefined
                              : ({ '--event-color': color } as React.CSSProperties)

                            return segment.event.htmlLink ? (
                              <a
                                key={`${segment.event.calendarId}:${segment.event.id}:${segment.event.start ?? ''}:${segment.row}`}
                                href={segment.event.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                className={segment.bar ? 'event-segment event-bar' : 'event-segment event-dot'}
                                style={{
                                  gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                                  gridRow: `${segment.row + 1}`,
                                  background: segment.bar ? color : 'transparent',
                                  color: segment.bar ? textColor : 'var(--crm-text)',
                                  ...timedDotStyle,
                                }}
                                title={`${eventLabel(segment.event)} - ${calendar?.summary ?? segment.event.calendarId}`}
                              >
                                {eventLabel(segment.event)}
                              </a>
                            ) : (
                              <button
                                key={`${segment.event.calendarId}:${segment.event.id}:${segment.event.start ?? ''}:${segment.row}`}
                                type="button"
                                onClick={() => setSelectedDayKey(localDateKey(week[segment.startIndex]))}
                                className={segment.bar ? 'event-segment event-bar' : 'event-segment event-dot'}
                                style={{
                                  gridColumn: `${segment.startIndex + 1} / ${segment.endIndex + 2}`,
                                  gridRow: `${segment.row + 1}`,
                                  background: segment.bar ? color : 'transparent',
                                  color: segment.bar ? textColor : 'var(--crm-text)',
                                  ...timedDotStyle,
                                }}
                                title={`${eventLabel(segment.event)} - ${calendar?.summary ?? segment.event.calendarId}`}
                              >
                                {eventLabel(segment.event)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </main>

            <aside className="calendar-side-panel">
              <section className="selected-day-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--crm-text)' }}>
                      {selectedDay.toLocaleDateString([], { weekday: 'long' })}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 12, color: 'var(--crm-muted)', fontWeight: 700 }}>
                      {selectedDay.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--crm-muted)', fontWeight: 800 }}>
                    {selectedDayEvents.length} item{selectedDayEvents.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {selectedDayEvents.length === 0 ? (
                    <div style={emptyState}>No calendar items for this day.</div>
                  ) : (
                    selectedDayEvents.map((event) => {
                      const calendar = calendarById.get(event.calendarId)
                      return (
                        <div key={`${event.calendarId}:${event.id}:${event.start ?? ''}`} className="detail-event">
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  background: calendar?.backgroundColor ?? '#0ea5e9',
                                  border: '1px solid rgba(0,0,0,0.1)',
                                  flexShrink: 0,
                                }}
                              />
                              <div style={{ fontSize: 13, fontWeight: 850, color: 'var(--crm-text)', minWidth: 0 }}>
                                {event.summary ?? '(No title)'}
                              </div>
                            </div>
                            {event.htmlLink ? (
                              <a
                                href={event.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 12, color: 'var(--crm-text)', fontWeight: 800, textDecoration: 'underline' }}
                              >
                                Open
                              </a>
                            ) : null}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--crm-muted-strong)', fontWeight: 700 }}>
                            {formatEventTime(event.start, event.end)}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: 'var(--crm-muted)' }}>
                            {calendar?.summary ?? event.calendarId}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>

              <section className="selected-day-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--crm-text)' }}>Google embed</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: 'var(--crm-muted)', lineHeight: 1.45 }}>
                      Optional fallback. If Safari blocks Google cookies, use the month board.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowGoogleEmbed((prev) => !prev)}
                    style={pillButton}
                  >
                    {showGoogleEmbed ? 'Hide' : 'Try embed'}
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {(['MONTH', 'WEEK', 'AGENDA'] as GoogleEmbedMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setEmbedMode(mode)}
                      disabled={!connected}
                      style={
                        embedMode === mode
                          ? { ...pillButton, background: 'var(--crm-accent)', color: 'var(--crm-accent-text)', border: '1px solid var(--crm-accent)' }
                          : pillButton
                      }
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <a
                  href={openGoogleUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ ...button, marginTop: 10, textDecoration: 'none', display: 'inline-flex' }}
                >
                  Open Google Calendar
                </a>

                {showGoogleEmbed ? (
                  <div className="embed-frame-wrap">
                    {googleEmbedSrc ? (
                      <iframe
                        title="Google Calendar"
                        src={googleEmbedSrc}
                        style={{ width: '100%', height: 680, border: 0 }}
                      />
                    ) : (
                      <div style={{ padding: 16, color: 'var(--crm-muted)' }}>
                        Select at least one calendar to load the embed.
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            </aside>
          </div>
        </>
      )}

      {loading && <div style={{ marginTop: 10, color: 'var(--crm-muted)' }}>Syncing...</div>}

      <style jsx>{`
        .calendar-shell {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }

        .month-panel,
        .selected-day-card {
          background: var(--crm-card);
          border: 1px solid var(--crm-border-soft);
          border-radius: 16px;
          padding: 12px;
        }

        .month-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .month-title {
          font-size: 22px;
          font-weight: 900;
          color: var(--crm-text);
        }

        .month-subtitle {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 700;
          color: var(--crm-muted);
        }

        .month-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          justify-content: flex-end;
        }

        .month-board {
          border: 1px solid var(--crm-border-soft);
          border-radius: 14px;
          overflow-x: auto;
          background: var(--crm-card);
        }

        .month-weekday-row {
          display: grid;
          grid-template-columns: repeat(7, minmax(138px, 1fr));
          min-width: 966px;
          border-bottom: 1px solid var(--crm-border-soft);
        }

        .weekday-label {
          height: 30px;
          display: grid;
          place-items: center;
          font-size: 11px;
          font-weight: 900;
          color: var(--crm-text);
          border-left: 1px solid var(--crm-border-soft);
        }

        .weekday-label:first-child {
          border-left: 0;
        }

        .month-week {
          position: relative;
          display: grid;
          grid-template-columns: repeat(7, minmax(138px, 1fr));
          min-width: 966px;
          border-bottom: 1px solid var(--crm-border-soft);
        }

        .month-week:last-child {
          border-bottom: 0;
        }

        .day-cell {
          appearance: none;
          border: 0;
          border-left: 1px solid var(--crm-border-soft);
          background: transparent;
          align-self: stretch;
          display: block;
          height: 100%;
          min-height: inherit;
          padding: 8px 8px 6px;
          text-align: center;
          cursor: pointer;
          position: relative;
        }

        .day-cell:first-child {
          border-left: 0;
        }

        .day-cell[data-muted='true'] {
          background: var(--crm-bg-soft);
          color: var(--crm-muted);
        }

        .day-cell[data-selected='true'] {
          box-shadow: inset 0 0 0 2px var(--crm-accent);
        }

        .day-number {
          display: grid;
          place-items: center;
          min-width: 24px;
          height: 24px;
          padding: 0 6px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          color: var(--crm-text);
          left: 50%;
          position: absolute;
          top: 8px;
          transform: translateX(-50%);
        }

        .day-cell[data-muted='true'] .day-number {
          color: var(--crm-muted);
        }

        .today-number {
          background: #2563eb;
          color: white;
        }

        .event-layer {
          position: absolute;
          left: 0;
          right: 0;
          top: 38px;
          display: grid;
          grid-template-columns: repeat(7, minmax(138px, 1fr));
          grid-auto-rows: 20px;
          gap: 4px 0;
          padding: 0 7px;
          pointer-events: none;
        }

        .event-segment {
          min-width: 0;
          height: 20px;
          border: 0;
          border-radius: 5px;
          padding: 0 8px;
          font-size: 12px;
          font-weight: 850;
          line-height: 20px;
          text-align: left;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          text-decoration: none;
          pointer-events: auto;
          cursor: pointer;
        }

        .event-bar {
          box-shadow: 0 1px 1px rgba(15, 23, 42, 0.08);
        }

        .event-dot {
          position: relative;
          background: transparent;
          color: var(--crm-text);
          padding-left: 18px;
        }

        .event-dot::before {
          content: '';
          position: absolute;
          left: 7px;
          top: 7px;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: var(--event-color, #0ea5e9);
        }

        .calendar-side-panel {
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .detail-event {
          border: 1px solid var(--crm-border-soft);
          border-radius: 12px;
          padding: 10px;
          background: var(--crm-card);
        }

        .embed-frame-wrap {
          margin-top: 12px;
          border: 1px solid var(--crm-border-soft);
          border-radius: 12px;
          overflow: hidden;
          min-height: 480px;
        }

        @media (max-width: 760px) {
          .month-toolbar {
            align-items: flex-start;
            flex-direction: column;
          }

          .month-actions {
            justify-content: flex-start;
          }

          .month-board {
            margin-left: -4px;
            margin-right: -4px;
            border-radius: 12px;
          }
        }

        @media (min-width: 1180px) {
          .calendar-shell {
            grid-template-columns: minmax(0, 1fr) 340px;
            align-items: start;
          }

          .calendar-side-panel {
            position: sticky;
            top: 12px;
          }
        }
      `}</style>
    </div>
  )
}

const button: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--crm-border-soft)',
  background: 'var(--crm-card)',
  color: 'var(--crm-text)',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
}

const pillButton: React.CSSProperties = {
  height: 32,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid var(--crm-border)',
  background: 'var(--crm-card)',
  color: 'var(--crm-text)',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}

const emptyState: React.CSSProperties = {
  border: '1px dashed #d1d5db',
  borderRadius: 12,
  padding: 12,
  color: 'var(--crm-muted)',
  fontSize: 13,
  background: 'var(--crm-bg-soft)',
}
