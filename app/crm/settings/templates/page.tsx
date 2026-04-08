'use client'

import Link from 'next/link'
import { ArrowLeft, FileText, MessageSquareText, NotebookPen, Shapes } from 'lucide-react'

export default function TemplatesLibraryPage() {
  return (
    <div className="crm-page" style={{ maxWidth: 860, margin: '0 auto', display: 'grid', gap: 14 }}>
      <div className="crm-card" style={{ borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--crm-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          <Shapes size={16} aria-hidden="true" />
          Templates library
        </div>
        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 900 }}>Templates Library</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--crm-muted-strong)', fontSize: 14 }}>
          Central place for reusable customer communication templates.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <Link href="/crm/email-templates" style={tile}>
          <div style={tileTitle}>
            <FileText size={18} aria-hidden="true" />
            <span>Email templates</span>
          </div>
          <div style={tileSub}>Edit stage-based email templates and merge variables.</div>
        </Link>

        <div style={{ ...tile, cursor: 'default' }}>
          <div style={tileTitle}>
            <MessageSquareText size={18} aria-hidden="true" />
            <span>SMS templates (planned)</span>
          </div>
          <div style={tileSub}>Create short follow-up templates for text messaging.</div>
        </div>

        <div style={{ ...tile, cursor: 'default' }}>
          <div style={tileTitle}>
            <NotebookPen size={18} aria-hidden="true" />
            <span>Internal note templates (planned)</span>
          </div>
          <div style={tileSub}>Reusable notes/checklists for team workflows.</div>
        </div>
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
  border: '1px solid var(--crm-border)',
  borderRadius: 12,
  background: 'var(--crm-card)',
  padding: 14,
  textDecoration: 'none',
  color: 'var(--crm-text)',
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
  color: 'var(--crm-muted-strong)',
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
  background: 'var(--crm-accent)',
  color: 'var(--crm-accent-text)',
  textDecoration: 'none',
  fontWeight: 700,
}
