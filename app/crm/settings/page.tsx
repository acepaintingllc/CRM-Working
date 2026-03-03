'use client'

import Link from 'next/link'
import { Building2, FileStack, Link2, Settings as SettingsIcon } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="crm-page" style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 14 }}>
      <div className="crm-card" style={{ borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#6b7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          <SettingsIcon size={16} aria-hidden="true" />
          Settings
        </div>
        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 900 }}>CRM Settings</h1>
        <p style={{ margin: '6px 0 0', color: '#4b5563', fontSize: 14 }}>
          Manage your company profile, integrations, and templates in one place.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        <Link href="/crm/settings/company" style={tile}>
          <div style={tileTitle}>
            <Building2 size={18} aria-hidden="true" />
            <span>Company profile</span>
          </div>
          <div style={tileSub}>Business details, defaults, and brand information.</div>
        </Link>

        <Link href="/crm/settings/integrations" style={tile}>
          <div style={tileTitle}>
            <Link2 size={18} aria-hidden="true" />
            <span>Integrations</span>
          </div>
          <div style={tileSub}>Connection status and provider setup controls.</div>
        </Link>

        <Link href="/crm/settings/templates" style={tile}>
          <div style={tileTitle}>
            <FileStack size={18} aria-hidden="true" />
            <span>Templates library</span>
          </div>
          <div style={tileSub}>Email templates now, with room for SMS and notes templates later.</div>
        </Link>
      </div>
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
