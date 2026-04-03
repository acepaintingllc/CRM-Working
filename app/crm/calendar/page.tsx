'use client'

import { authedFetch } from '@/lib/auth/authedFetch'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

type CalendarInfo = {
  id: string
  summary: string | null
  primary: boolean
  backgroundColor: string | null
  foregroundColor: string | null
}

type CalendarViewMode = 'MONTH' | 'WEEK' | 'AGENDA'

type CalendarEvent = {
  id: string
  calendarId: string
  summary: string | null
  start: string | null
  end: string | null
  htmlLink: string | null
}

const selectedStorageKey = 'acecrm.calendar.selected'
const viewModeStorageKey = 'acecrm.calendar.viewMode'

function isViewMode(value: string | null): value is CalendarViewMode {
  return value === 'MONTH' || value === 'WEEK' || value === 'AGENDA'
}

function readStoredCalendarIds() {
  try {
    const raw = localStorage.getItem(selectedStorageKey)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : null
  } catch {
    return null
  }
}

function isDateOnly(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function parseEventDate(value: string | null | undefined) {
  if (!value) return null
  if (isDateOnly(value)) {
    const [year, month, day] = value.split('-').map((part) => Number(part))
    if (!year || !month || !day) return null
    return new Date(year, month - 1, day)
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function formatEventWindow(start: string | null, end: string | null) {
  const startDate = parseEventDate(start)
  const endDate = parseEventDate(end)
  if (!startDate) return 'Time TBD'

  if (isDateOnly(start) && isDateOnly(end)) {
    return `${startDate.toLocaleDateString()} (all day)`
  }

  if (endDate) {
    const sameDay =
      startDate.getFullYear() === endDate.getFullYear() &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getDate() === endDate.getDate()
    if (sameDay) {
      return `${startDate.toLocaleDateString()} · ${startDate.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })} - ${endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    }
    return `${startDate.toLocaleString()} - ${endDate.toLocaleString()}`
  }

  return startDate.toLocaleString()
}

function eventSortValue(event: CalendarEvent) {
  const start = parseEventDate(event.start)
  return start?.getTime() ?? Number.MAX_SAFE_INTEGER
}

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<CalendarViewMode>('MONTH')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [eventsRefreshNonce, setEventsRefreshNonce] = useState(0)

  const selectedIdsParam = useMemo(() => selectedCalendarIds.join(','), [selectedCalendarIds])
  const calendarById = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar])),
    [calendars]
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
    try {
      const storedMode = localStorage.getItem(viewModeStorageKey)
      if (isViewMode(storedMode)) {
        setViewMode(storedMode)
      }
    } catch {
      // ignore
    }
    void loadStatusAndCalendars()
  }, [])

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) setError(err)
  }, [searchParams])

  useEffect(() => {
    try {
      localStorage.setItem(selectedStorageKey, JSON.stringify(selectedCalendarIds))
    } catch {
      // ignore
    }
  }, [selectedCalendarIds])

  useEffect(() => {
    try {
      localStorage.setItem(viewModeStorageKey, viewMode)
    } catch {
      // ignore
    }
  }, [viewMode])

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
      params.set('limit', '20')
      params.set('days', '30')
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
      const sorted = [...rows].sort((a, b) => eventSortValue(a) - eventSortValue(b))
      setEvents(sorted.slice(0, 20))
      setEventsLoading(false)
    }

    void loadEvents()
    return () => {
      cancelled = true
    }
  }, [connected, selectedCalendarIds, selectedIdsParam, eventsRefreshNonce])

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

  const googleEmbedSrc = useMemo(() => {
    if (!selectedCalendarIds.length) return ''
    const url = new URL('https://calendar.google.com/calendar/embed')
    url.searchParams.set('mode', viewMode)
    url.searchParams.set('wkst', '1')
    url.searchParams.set('bgcolor', '#ffffff')
    for (const id of selectedCalendarIds) {
      url.searchParams.append('src', id)
    }
    return url.toString()
  }, [selectedCalendarIds, viewMode])

  const openGoogleUrl = useMemo(() => {
    const url = new URL('https://calendar.google.com/calendar/u/0/r')
    for (const id of selectedCalendarIds) {
      url.searchParams.append('cid', id)
    }
    return url.toString()
  }, [selectedCalendarIds])

  return (
    <div className="crm-page" style={{ maxWidth: 1300, margin: '0 auto' }}>
      <div className="crm-topbar" style={{ marginBottom: 10 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Calendar</h1>
          <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>
            Google embed with calendar filters and upcoming event visibility.
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
              style={{ ...button, background: '#111', color: 'white', border: '1px solid #111' }}
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
            background: '#fff',
            border: '1px solid #fecaca',
            borderRadius: 12,
            padding: 12,
            color: '#991b1b',
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          marginBottom: 10,
          background: 'white',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 10,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase' }}>
          View
        </div>
        {(['MONTH', 'WEEK', 'AGENDA'] as CalendarViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            disabled={!connected}
            style={
              viewMode === mode
                ? { ...pillButton, background: '#111', color: 'white', border: '1px solid #111' }
                : pillButton
            }
          >
            {mode}
          </button>
        ))}
      </div>

      {!connected ? (
        <div style={{ marginTop: 12, color: '#6b7280' }}>
          Not connected. Click &quot;Connect Google&quot; to link your calendar.
        </div>
      ) : (
        <>
          <div
            style={{
              marginBottom: 10,
              background: 'white',
              border: '1px solid #e5e7eb',
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
              <div style={{ fontSize: 12, color: '#6b7280' }}>
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
                      border: active ? '1px solid #111' : '1px solid #e5e7eb',
                      borderRadius: 10,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      background: active ? '#f9fafb' : 'white',
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
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>
                      {calendar.summary ?? calendar.id}
                      {calendar.primary ? ' (Primary)' : ''}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="calendar-grid">
            <div
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                overflow: 'hidden',
                minHeight: 680,
              }}
            >
              {googleEmbedSrc ? (
                <iframe
                  title="Google Calendar"
                  src={googleEmbedSrc}
                  style={{ width: '100%', height: 900, border: 0 }}
                />
              ) : (
                <div style={{ padding: 16, color: '#6b7280' }}>
                  Select at least one calendar to load the embed.
                </div>
              )}
            </div>

            <div
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: 12,
                minHeight: 680,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800 }}>Upcoming events</div>
                <button
                  onClick={() => setEventsRefreshNonce((prev) => prev + 1)}
                  style={pillButton}
                >
                  Retry
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                {selectedCalendarIds.length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: 13 }}>
                    Choose calendars above to show upcoming events.
                  </div>
                ) : eventsLoading ? (
                  <div style={{ color: '#6b7280', fontSize: 13 }}>Loading events...</div>
                ) : eventsError ? (
                  <div
                    style={{
                      border: '1px solid #fecaca',
                      background: '#fff1f2',
                      color: '#991b1b',
                      borderRadius: 10,
                      padding: 10,
                      fontSize: 13,
                    }}
                  >
                    {eventsError}
                  </div>
                ) : events.length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: 13 }}>
                    No upcoming events in the current selection.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {events.map((event) => {
                      const calendar = calendarById.get(event.calendarId)
                      return (
                        <div
                          key={`${event.calendarId}:${event.id}`}
                          style={{
                            border: '1px solid #e5e7eb',
                            borderRadius: 10,
                            padding: 10,
                            background: '#fff',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span
                                aria-hidden="true"
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  background: calendar?.backgroundColor ?? '#9ca3af',
                                  flexShrink: 0,
                                  border: '1px solid rgba(0,0,0,0.1)',
                                }}
                              />
                              <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                                {event.summary ?? '(No title)'}
                              </div>
                            </div>
                            {event.htmlLink ? (
                              <a
                                href={event.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                style={{ fontSize: 12, color: '#111', textDecoration: 'underline', whiteSpace: 'nowrap' }}
                              >
                                Open
                              </a>
                            ) : null}
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: '#374151' }}>
                            {formatEventWindow(event.start, event.end)}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
                            {calendar?.summary ?? event.calendarId}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {loading && <div style={{ marginTop: 10, color: '#6b7280' }}>Syncing...</div>}

      <style jsx>{`
        .calendar-grid {
          display: grid;
          gap: 10px;
          grid-template-columns: minmax(0, 1fr);
        }

        @media (min-width: 1100px) {
          .calendar-grid {
            grid-template-columns: minmax(0, 1fr) 340px;
          }
        }
      `}</style>
    </div>
  )
}

const button: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: 'white',
  color: '#111',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
}

const pillButton: React.CSSProperties = {
  height: 32,
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid #d1d5db',
  background: 'white',
  color: '#111',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
}
