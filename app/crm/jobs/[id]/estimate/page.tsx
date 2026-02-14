'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

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

export default function JobEstimatePage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId

  const [estimateLocal, setEstimateLocal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || typeof id !== 'string') return
    const load = async () => {
      const res = await authedFetch(`/api/jobs/${id}`, { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? res.statusText)
        return
      }
      const existing = payload?.job?.estimate_date
      if (existing) {
        setEstimateLocal(toLocalInputValue(new Date(existing)))
      } else {
        setEstimateLocal(next8amLocalValue())
      }
    }
    void load()
  }, [id])

  const save = async () => {
    if (!id || typeof id !== 'string') return
    if (!estimateLocal) {
      setError('Pick a date/time')
      return
    }
    const iso = new Date(estimateLocal).toISOString()
    setSaving(true)
    setError(null)
    const res = await authedFetch(`/api/jobs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estimate_date: iso, status: 'estimate_scheduled' }),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(payload?.error ?? res.statusText)
      return
    }
    window.location.href = `/crm/jobs/${id}`
  }

  return (
    <div className="crm-page" style={{ maxWidth: 700, margin: '0 auto' }}>
      <div className="crm-topbar" style={{ marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>Set estimate date</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Pick the estimate time for this job.</div>
        </div>
        <Link href={`/crm/jobs/${id}`} style={{ ...actionButton, textDecoration: 'none' }}>
          Back to job
        </Link>
      </div>

      <div className="crm-card" style={{ borderRadius: 12, padding: 14 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <div style={label}>Estimate date/time</div>
            <input
              type="datetime-local"
              value={estimateLocal}
              onChange={(e) => setEstimateLocal(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>}

          <button
            onClick={() => void save()}
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
            {saving ? 'Saving...' : 'Save estimate date'}
          </button>
        </div>
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
}

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: 6,
}
