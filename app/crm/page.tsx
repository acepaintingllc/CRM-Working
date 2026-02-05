'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function CRMHome() {
  const [counts, setCounts] = useState<{ won: number; lost: number; total: number; winRate: number } | null>(null)

  useEffect(() => {
    const load = async () => {
      const res = await authedFetch('/api/jobs', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setCounts(null)
        return
      }
      const jobs = payload?.jobs ?? []
      const won = jobs.filter((j: any) => j.status === 'completed').length
      const lost = jobs.filter((j: any) => j.status === 'lost').length
      const total = won + lost
      const winRate = total > 0 ? Math.round((won / total) * 100) : 0
      setCounts({ won, lost, total, winRate })
    }
    void load()
  }, [])

  return (
    <div
      className="crm-page"
      style={{
        padding: 12,
        display: 'grid',
        gap: 16,
        maxWidth: 960,
        margin: '0 auto',
      }}
    >
      <div
        className="crm-card"
        style={{
          borderRadius: 16,
          padding: 20,
          display: 'grid',
          gap: 6,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: '#6b7280',
            fontWeight: 800,
          }}
        >
          Dashboard
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>ACE Painting Home</h1>
        <div style={{ color: '#4b5563', lineHeight: 1.5, fontSize: 14 }}>
          Jump back into customers, jobs, calendar, or templates.
        </div>
        {counts && (
          <div style={{ display: 'grid', gap: 10, marginTop: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <div style={statCard}>
              <div style={statLabel}>Win rate</div>
              <div style={statValue}>{counts.winRate}%</div>
              <div style={statSub}>{counts.total} total decisions</div>
            </div>
            <div style={statCard}>
              <div style={statLabel}>Estimates won</div>
              <div style={statValue}>{counts.won}</div>
              <div style={statSub}>Completed jobs</div>
            </div>
            <div style={statCard}>
              <div style={statLabel}>Estimates lost</div>
              <div style={statValue}>{counts.lost}</div>
              <div style={statSub}>Marked lost</div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <Link href="/crm/customers" style={{ ...card, border: '1px solid #111' }}>
          <div style={cardTitle}>Customers</div>
          <div style={cardSub}>Profiles, contact info, and history.</div>
        </Link>

        <Link href="/crm/jobs" style={card}>
          <div style={cardTitle}>Jobs</div>
          <div style={cardSub}>Estimates, scheduling, and completion tracking.</div>
        </Link>

        <Link href="/crm/calendar" style={card}>
          <div style={cardTitle}>Calendar</div>
          <div style={cardSub}>Google Calendar view and event management.</div>
        </Link>

        <Link href="/crm/email-templates" style={card}>
          <div style={cardTitle}>Email templates</div>
          <div style={cardSub}>Stage-based emails with smart variables.</div>
        </Link>
      </div>

      <div
        className="crm-card crm-actions"
        style={{
          borderRadius: 16,
          padding: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontWeight: 800 }}>Quick actions</div>
        <div className="crm-actions">
          <Link href="/crm/customers/new" style={action}>
            + New customer
          </Link>
          <Link href="/crm/jobs/new" style={action}>
            + New job
          </Link>
          <Link href="/crm/calendar" style={actionAlt}>
            Open calendar
          </Link>
        </div>
      </div>
    </div>
  )
}

const card: React.CSSProperties = {
  display: 'block',
  padding: 16,
  borderRadius: 14,
  border: '1px solid #d1d5db',
  background: 'white',
  textDecoration: 'none',
  color: '#111',
}

const cardTitle: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 16,
}

const cardSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: '#4b5563',
  lineHeight: 1.4,
}

const action: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  background: '#111',
  color: 'white',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 13,
}

const actionAlt: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 10,
  background: '#f3f4f6',
  color: '#111',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: 13,
  border: '1px solid #d1d5db',
}

const statCard: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  background: '#f9fafb',
}

const statLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  color: '#6b7280',
}

const statValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 800,
  color: '#111',
}

const statSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: '#6b7280',
}
