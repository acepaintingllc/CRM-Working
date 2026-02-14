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

export default function CalendarPage() {
  const searchParams = useSearchParams()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStatusAndCalendars = async () => {
    setLoading(true)
    setError(null)

    const statusRes = await authedFetch('/api/google-calendar/status', { cache: 'no-store' })
    const statusPayload = await statusRes.json().catch(() => null)
    if (!statusRes.ok) {
      setError(statusPayload?.error ?? statusRes.statusText)
      setConnected(false)
      setSelectedCalendarIds([])
      setLoading(false)
      return
    }

    const isConnected = Boolean(statusPayload?.connected)
    setConnected(isConnected)

    if (!isConnected) {
      setSelectedCalendarIds([])
      setLoading(false)
      return
    }

    const calRes = await authedFetch('/api/google-calendar/calendars', { cache: 'no-store' })
    const calPayload = await calRes.json().catch(() => null)
    if (!calRes.ok) {
      setError(calPayload?.error ?? calRes.statusText)
      setSelectedCalendarIds([])
      setLoading(false)
      return
    }

    const list: CalendarInfo[] = calPayload?.calendars ?? []

    // Keep selection stable (localStorage), default to "Austin's work" + primary.
    const stored = (() => {
      try {
        const raw = localStorage.getItem('acecrm.calendar.selected')
        const parsed = raw ? JSON.parse(raw) : null
        return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : null
      } catch {
        return null
      }
    })()

    const primary = list.find((c) => c.primary)?.id ?? 'primary'
    const austins = list.find((c) => (c.summary ?? '').toLowerCase() === "austin's work")?.id ?? null

    const initial = stored?.length
      ? stored
      : austins
        ? [austins, primary].filter((v, i, a) => a.indexOf(v) === i)
        : [primary]

    setSelectedCalendarIds(initial)
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
      localStorage.setItem('acecrm.calendar.selected', JSON.stringify(selectedCalendarIds))
    } catch {
      // ignore
    }
  }, [selectedCalendarIds])

  const connectHref = '/api/google-calendar/connect?next=/crm/calendar'

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
    await loadStatusAndCalendars()
  }

  const googleEmbedSrc = useMemo(() => {
    if (!selectedCalendarIds.length) return ''
    const url = new URL('https://calendar.google.com/calendar/embed')
    url.searchParams.set('mode', 'MONTH')
    url.searchParams.set('wkst', '1')
    url.searchParams.set('bgcolor', '#ffffff')
    for (const id of selectedCalendarIds) {
      url.searchParams.append('src', id)
    }
    return url.toString()
  }, [selectedCalendarIds])

  return (
    <div className="crm-page" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div className="crm-topbar">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Calendar</h1>
        </div>

        <div className="crm-actions">
          <button onClick={() => void loadStatusAndCalendars()} style={button}>
            Refresh
          </button>
          {connected ? (
            <button onClick={() => void disconnect()} style={button}>
              Disconnect
            </button>
          ) : (
            <a
              href={connectHref}
              style={{
                ...button,
                background: '#111',
                color: 'white',
                border: '1px solid #111',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Connect Google
            </a>
          )}
        </div>
      </div>

      {error && (
        <div
          style={{
            marginTop: 12,
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

      {!connected ? (
        <div style={{ marginTop: 12, color: '#6b7280' }}>
          Not connected. Click &quot;Connect Google&quot; to link your calendar.
        </div>
      ) : (
        <>
          {googleEmbedSrc ? (
            <div
              style={{
                marginTop: 12,
                background: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              <iframe
                title="Google Calendar"
                src={googleEmbedSrc}
                style={{ width: '100%', height: 900, border: 0 }}
              />
            </div>
          ) : null}
        </>
      )}

      {loading && (
        <div style={{ marginTop: 10, color: '#6b7280' }}>
          Syncing...
        </div>
      )}
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
