'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { ArrowLeft, FileText, MessageSquareText, NotebookPen, Shapes } from 'lucide-react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { templatePresets } from '@/lib/customer-estimates/presets'

type TemplateSettings = {
  default_template_key: string
  quote_validity_days: string
  terms_text: string
}

const emptySettings: TemplateSettings = {
  default_template_key: 'default',
  quote_validity_days: '90',
  terms_text:
    'This estimate is valid for 90 days from the date shown above.\n\nA deposit may be required for scheduling or special-order materials.\n\nCredit card payments are subject to a processing fee.\n\nAcceptance confirms the scope, pricing, schedule, and terms shown on this page.',
}

export default function TemplatesLibraryPage() {
  const [settings, setSettings] = useState<TemplateSettings>(emptySettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const res = await authedFetch('/api/settings/templates', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!alive) return
      if (!res.ok) {
        setError(payload?.error ?? 'Failed to load template settings')
        setLoading(false)
        return
      }
      const next = payload?.settings ?? {}
      setSettings({
        default_template_key: String(next.default_template_key ?? emptySettings.default_template_key),
        quote_validity_days: String(next.quote_validity_days ?? emptySettings.quote_validity_days),
        terms_text: String(next.terms_text ?? emptySettings.terms_text),
      })
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [])
  const save = async () => {
    setSaving(true)
    setError(null)
    setSaved(null)
    const res = await authedFetch('/api/settings/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          default_template_key: settings.default_template_key,
          quote_validity_days: settings.quote_validity_days,
          terms_text: settings.terms_text,
        },
      }),
    })
    const payload = await res.json().catch(() => null)
    setSaving(false)
    if (!res.ok) {
      setError(payload?.error ?? 'Failed to save template settings')
      return
    }
    setSaved('Saved')
    window.setTimeout(() => setSaved(null), 1200)
  }

  return (
    <div className="crm-page" style={{ maxWidth: 980, margin: '0 auto', display: 'grid', gap: 14 }}>
      <div className="crm-card" style={{ borderRadius: 14, padding: 18 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--crm-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          <Shapes size={16} aria-hidden="true" />
          Templates library
        </div>
        <h1 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 900 }}>Templates Library</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--crm-muted-strong)', fontSize: 14 }}>
          Central place for reusable customer communication templates and estimate-send defaults.
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

      <div className="crm-card" style={{ borderRadius: 14, padding: 18, display: 'grid', gap: 14 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--crm-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            <Shapes size={16} aria-hidden="true" />
            Estimate send defaults v2
          </div>
          <h2 style={{ margin: '8px 0 0', fontSize: 20, fontWeight: 900 }}>Estimate Send Defaults</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--crm-muted-strong)', fontSize: 14 }}>
            These defaults drive the send/review flow and the customer-facing terms page.
          </p>
        </div>

        {error && <div style={notice(false)}>{error}</div>}
        {saved && <div style={notice(true)}>{saved}</div>}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <label style={field}>
            <span style={labelStyle}>Default template preset</span>
            <select
              value={settings.default_template_key}
              onChange={(event) => setSettings((prev) => ({ ...prev, default_template_key: event.target.value }))}
              disabled={loading || saving}
              style={input}
            >
              {templatePresets.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
            </select>
            <span style={help}>Used when opening the estimate send page.</span>
          </label>

          <label style={field}>
            <span style={labelStyle}>Quote validity days</span>
            <input
              type="number"
              min={1}
              value={settings.quote_validity_days}
              onChange={(event) => setSettings((prev) => ({ ...prev, quote_validity_days: event.target.value }))}
              disabled={loading || saving}
              style={input}
            />
            <span style={help}>Rendered on the customer terms page.</span>
          </label>
        </div>

        <label style={field}>
          <span style={labelStyle}>Terms &amp; Conditions</span>
          <textarea
            value={settings.terms_text}
            onChange={(event) => setSettings((prev) => ({ ...prev, terms_text: event.target.value }))}
            disabled={loading || saving}
            rows={8}
            style={{ ...input, minHeight: 180, resize: 'vertical' }}
          />
          <span style={help}>
            Use one paragraph per term. The estimate preview will format this into a clean page 2.
          </span>
        </label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <button onClick={() => void save()} disabled={loading || saving} style={button}>
            {saving ? 'Saving...' : 'Save v2 defaults'}
          </button>
          <div style={{ fontSize: 12, color: 'var(--crm-muted-strong)' }}>
            These settings are shared across estimate send flows.
          </div>
        </div>
      </div>

      <Link href="/crm/settings" style={backLink}>
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Back to settings</span>
      </Link>
    </div>
  )
}

const tile: CSSProperties = {
  display: 'block',
  border: '1px solid var(--crm-border)',
  borderRadius: 12,
  background: 'var(--crm-card)',
  padding: 14,
  textDecoration: 'none',
  color: 'var(--crm-text)',
}

const tileTitle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontWeight: 800,
  fontSize: 16,
}

const tileSub: CSSProperties = {
  marginTop: 6,
  color: 'var(--crm-muted-strong)',
  fontSize: 13,
  lineHeight: 1.4,
}

const backLink: CSSProperties = {
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

const field: CSSProperties = {
  display: 'grid',
  gap: 6,
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: 'var(--crm-muted)',
  textTransform: 'uppercase',
}

const input: CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--crm-border)',
  padding: '10px 12px',
  background: 'var(--crm-bg-soft)',
  color: 'var(--crm-text)',
  fontSize: 14,
  width: '100%',
}

const help: CSSProperties = {
  fontSize: 12,
  color: 'var(--crm-muted-strong)',
  lineHeight: 1.4,
}

const button: CSSProperties = {
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--crm-border-soft)',
  background: 'var(--crm-card)',
  color: 'var(--crm-text)',
  fontWeight: 800,
  fontSize: 14,
  cursor: 'pointer',
}

function notice(ok: boolean): React.CSSProperties {
  return {
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 13,
    border: ok ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
    background: ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
    color: ok ? '#166534' : '#991b1b',
  }
}
