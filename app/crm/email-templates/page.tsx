'use client'

import { authedFetch } from '@/lib/auth/authedFetch'

import { useEffect, useMemo, useState } from 'react'

type Stage =
  | 'estimate_scheduled'
  | 'estimate_sent'
  | 'follow_up'
  | 'scheduled'
  | 'completed'

const stages: { key: Stage; label: string }[] = [
  { key: 'estimate_scheduled', label: 'Estimate scheduled' },
  { key: 'estimate_sent', label: 'Estimate sent' },
  { key: 'follow_up', label: 'Follow up' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'completed', label: 'Completed / review request' },
]

const availableVars = [
  '{{customerName}}',
  '{{customerEmail}}',
  '{{customerPhone}}',
  '{{customerAddress}}',
  '{{jobTitle}}',
  '{{estimateDate}}',
  '{{scheduledDate}}',
  '{{scheduledBlocks}}',
  '{{estimateFileName}}',
  '{{estimateFileLink}}',
  '{{scheduled_blocks}}',
  '{{reviewLink}}',
]

function keyFor(stage: Stage) {
  return `acecrm.emailTemplates.${stage}`
}

export default function EmailTemplatesPage() {
  const [active, setActive] = useState<Stage>('estimate_scheduled')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saved, setSaved] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Record<string, { subject: string; body: string }>>({})

  const storageKey = useMemo(() => keyFor(active), [active])

  useEffect(() => {
    const load = async () => {
      const res = await authedFetch('/api/email-templates', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setSaved(payload?.error ?? 'Failed to load templates')
        return
      }

      const map: Record<string, { subject: string; body: string }> = {}
      for (const row of payload?.templates ?? []) {
        map[row.stage] = { subject: row.subject ?? '', body: row.body ?? '' }
      }
      setTemplates(map)
    }

    void load()
  }, [])

  useEffect(() => {
    const current = templates[active] ?? { subject: '', body: '' }
    setSubject(current.subject)
    setBody(current.body)
    setSaved(null)
  }, [templates, active, storageKey])

  const save = async () => {
    const res = await authedFetch('/api/email-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: active, subject, body }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setSaved(payload?.error ?? 'Failed to save')
      return
    }
    setTemplates((prev) => ({ ...prev, [active]: { subject, body } }))
    setSaved('Saved')
    window.setTimeout(() => setSaved(null), 1200)
  }

  const insertVar = (v: string) => {
    setBody((prev) => (prev ? `${prev}\n${v}` : v))
  }

  return (
    <div className="crm-page" style={{ maxWidth: 900, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Email templates</h1>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Draft templates per job stage. Variables will be filled later from the customer/job.
        </div>
      </div>

      <div className="crm-columns" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 12, marginTop: 12 }}>
        <div className="crm-card" style={{ borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 10 }}>Stages</div>
          <div style={{ display: 'grid', gap: 8 }}>
            {stages.map((s) => (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: active === s.key ? '1px solid #111' : '1px solid #e5e7eb',
                  background: active === s.key ? '#111' : 'white',
                  color: active === s.key ? 'white' : '#111',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="crm-card" style={{ borderRadius: 12, padding: 12 }}>
          <div className="crm-topbar">
            <div style={{ fontWeight: 900 }}>{stages.find((s) => s.key === active)?.label}</div>
            <button onClick={save} style={button}>
              Save
            </button>
          </div>

          {saved && <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>{saved}</div>}

          <div style={{ marginTop: 12 }}>
            <div style={label}>Subject</div>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="ex: Your estimate is scheduled"
              style={input}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={label}>Body</div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the email template here..."
              style={{ ...input, height: 220, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
            For the Estimate sent stage, the latest estimate PDF is attached automatically. Use{' '}
            {'{{estimateFileName}}'} or {'{{estimateFileLink}}'} if you want to mention it.
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>Variables</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {availableVars.map((v) => (
                <button
                  key={v}
                  onClick={() => insertVar(v)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
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

const input: React.CSSProperties = {
  padding: '12px',
  borderRadius: 10,
  border: '1px solid #d1d5db',
  fontSize: 14,
  width: '100%',
}

const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#6b7280',
  textTransform: 'uppercase',
  marginBottom: 6,
}
