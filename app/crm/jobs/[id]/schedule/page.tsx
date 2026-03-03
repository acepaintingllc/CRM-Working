'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, CalendarCheck, CalendarClock, Mail, Trash2 } from 'lucide-react'

type ScheduleRow = {
  id: string
  start_at: string
  end_at: string
  notes: string | null
  calendar_event_id: string | null
  calendar_added_at: string | null
}

type CalendarAddResult = {
  scheduleId: string
  eventId?: string | null
  skipped?: boolean
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toLocalInputValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`
}

function next8amLocalValue() {
  const now = new Date()
  const next = new Date(now)
  if (now.getHours() >= 8) next.setDate(next.getDate() + 1)
  next.setHours(8, 0, 0, 0)
  return toLocalInputValue(next)
}

const iconSizeSm = 16
const iconSizeMd = 18

function iconLabel(Icon: LucideIcon, label: string, size = iconSizeSm) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Icon size={size} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}

export default function JobSchedulePage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const [rows, setRows] = useState<ScheduleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [addingCalendar, setAddingCalendar] = useState(false)

  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    const load = async () => {
      setLoading(true)
      setError(null)
      const res = await authedFetch(`/api/jobs/${id}/schedules`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        setRows([])
        setLoading(false)
        return
      }
      setRows(payload?.schedules ?? [])
      setLoading(false)
    }
    void load()
  }, [id])

  useEffect(() => {
    if (!startLocal) setStartLocal(next8amLocalValue())
    if (!endLocal) {
      const start = startLocal ? new Date(startLocal) : new Date(next8amLocalValue())
      const end = new Date(start)
      end.setHours(end.getHours() + 8)
      setEndLocal(toLocalInputValue(end))
    }
  }, [startLocal, endLocal])

  const addSchedule = async () => {
    if (!id || typeof id !== 'string') return
    if (!startLocal || !endLocal) {
      setError('Start and end are required')
      return
    }
    const startIso = new Date(startLocal).toISOString()
    const endIso = new Date(endLocal).toISOString()
    if (Number.isNaN(new Date(startIso).getTime()) || Number.isNaN(new Date(endIso).getTime())) {
      setError('Invalid date/time')
      return
    }
    setSaving(true)
    setError(null)
    const res = await authedFetch(`/api/jobs/${id}/schedules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_at: startIso, end_at: endIso, notes: notes.trim() || null }),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    setRows((prev) => [payload.schedule, ...prev])
    setNotes('')
  }

  const deleteSchedule = async (scheduleId: string) => {
    if (!id || typeof id !== 'string') return
    const ok = window.confirm('Delete this scheduled block?')
    if (!ok) return
    const res = await authedFetch(`/api/jobs/${id}/schedules/${scheduleId}`, { method: 'DELETE' })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== scheduleId))
  }

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => a.start_at.localeCompare(b.start_at))
  }, [rows])

  const addToCalendar = async () => {
    if (!sorted.length) {
      setError('Add at least one scheduled block first.')
      return
    }
    setAddingCalendar(true)
    setError(null)
    const res = await authedFetch(`/api/jobs/${id}/schedules/add-to-calendar`, { method: 'POST' })
    const payload = await res.json().catch(() => null)
    setAddingCalendar(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    if (payload?.events) {
      setRows((prev) =>
        prev.map((row) => {
          const found = (payload.events as CalendarAddResult[]).find((e) => e.scheduleId === row.id)
          if (!found || found.skipped) return row
          return { ...row, calendar_event_id: found.eventId ?? row.calendar_event_id, calendar_added_at: new Date().toISOString() }
        })
      )
    }
  }

  return (
    <div className="crm-page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="crm-topbar" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Schedule job</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            Add one or more scheduled date ranges for this job.
          </div>
        </div>
        <div className="crm-actions">
          <Link href={`/crm/jobs/${id}`} style={{ ...actionButton, textDecoration: 'none' }}>
            {iconLabel(ArrowLeft, 'Back to job', iconSizeMd)}
          </Link>
        </div>
      </div>

      <div className="crm-card" style={{ borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div className="crm-columns" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={label}>Start</div>
              <input
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <div style={label}>End</div>
              <input
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <div style={label}>Notes (optional)</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Crew, materials, access notes, etc."
              style={{ ...inputStyle, height: 90, resize: 'vertical' }}
            />
          </div>

          {error && <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>}

          <button
            onClick={() => void addSchedule()}
            disabled={saving}
            style={{
              padding: '12px',
              borderRadius: 10,
              background: '#111',
              color: 'white',
              border: 'none',
              fontWeight: 800,
              cursor: 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving
              ? iconLabel(CalendarClock, 'Saving...')
              : iconLabel(CalendarClock, 'Add scheduled block')}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        {loading && <div style={{ color: '#6b7280' }}>Loading schedule...</div>}
        {!loading && sorted.length === 0 && (
          <div style={{ color: '#6b7280' }}>No schedule blocks yet.</div>
        )}
        {!loading && sorted.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {sorted.map((row) => (
              <div
                key={row.id}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  padding: 12,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>
                    {new Date(row.start_at).toLocaleString()} - {new Date(row.end_at).toLocaleString()}
                  </div>
                  {row.notes && (
                    <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>{row.notes}</div>
                  )}
                  {row.calendar_event_id && (
                    <div style={{ marginTop: 4, fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                      Added to calendar
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void deleteSchedule(row.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 10,
                    border: '1px solid #fecaca',
                    background: '#fee2e2',
                    color: '#991b1b',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                    height: 'fit-content',
                  }}
                >
                  {iconLabel(Trash2, 'Delete')}
                </button>
              </div>
            ))}
          </div>
        )}
        {!loading && sorted.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div className="crm-actions">
              <button
                onClick={() => void addToCalendar()}
                disabled={addingCalendar}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#111',
                  color: 'white',
                  fontWeight: 800,
                  cursor: 'pointer',
                  opacity: addingCalendar ? 0.7 : 1,
                }}
              >
                {addingCalendar
                  ? iconLabel(CalendarCheck, 'Adding to calendar...')
                  : iconLabel(CalendarCheck, 'Add scheduled blocks to Google Calendar')}
              </button>
              <Link
                href={`/crm/jobs/${id}?compose=scheduled`}
                style={{ ...actionButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                {iconLabel(Mail, 'Edit & send scheduled email')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 14,
  width: '100%',
}

const actionButton: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #e5e7eb',
  background: 'white',
  color: '#111',
  fontWeight: 800,
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: 6,
}
