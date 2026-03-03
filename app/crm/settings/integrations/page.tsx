'use client'

import Link from 'next/link'
import { ArrowLeft, CalendarCheck, Link2, ShieldCheck } from 'lucide-react'

export default function IntegrationsSettingsPage() {
  return (
    <div className="crm-page" style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gap: 14 }}>
      <div className="crm-card" style={{ borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          <Link2 size={16} aria-hidden="true" />
          Integrations
        </div>
        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 900 }}>Integrations</h1>
        <p style={{ margin: '6px 0 0', color: '#4b5563', fontSize: 14 }}>
          Manage connection health and provider controls.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Link href="/crm/calendar" style={tile}>
          <div style={tileTitle}>
            <CalendarCheck size={18} aria-hidden="true" />
            <span>Google Calendar</span>
          </div>
          <div style={tileSub}>Connect/disconnect and manage event sync behavior.</div>
        </Link>

        <Link href="/env-check" style={tile}>
          <div style={tileTitle}>
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Environment health</span>
          </div>
          <div style={tileSub}>Validate required environment keys and setup status.</div>
        </Link>
      </div>

      <Link href="/crm/settings" style={backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Back to settings</span>
      </Link>
    </div>
  )
}

const tile: React.CSSProperties = {
  display: 'block',
  border: '1px solid #d1d5db',
  borderRadius: 12,
  background: 'white',
  padding: 14,
  textDecoration: 'none',
  color: '#111',
}

const tileTitle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 800,
  fontSize: 16,
}

const tileSub: React.CSSProperties = {
  marginTop: 6,
  color: '#4b5563',
  fontSize: 13,
  lineHeight: 1.4,
}

const backLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  width: 'fit-content',
  padding: '10px 14px',
  borderRadius: 10,
  background: '#111',
  color: 'white',
  textDecoration: 'none',
  fontWeight: 700,
}
