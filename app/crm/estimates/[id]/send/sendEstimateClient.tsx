'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { authedFetch } from '@/lib/auth/authedFetch'
import { buildCustomerEstimateDocument } from '@/lib/customer-estimates/build'
import { CustomerEstimateDocumentView } from '@/lib/customer-estimates/view'
import type {
  CompanyProfile,
  CustomerEstimateDocument,
  CustomerEstimateSectionKey,
  Unsafe,
} from '@/lib/customer-estimates/types'

type DraftState = {
  to_email: string
  cc_email: string
  bcc_email: string
  subject: string
  body: string
  template_key: string
  title: string
  quote_validity_days: string
  scope_text_edits: Record<CustomerEstimateSectionKey, string>
}

type VersionState = {
  status: string
  sent_at: string | null
  viewed_at: string | null
  accepted_at: string | null
  declined_at: string | null
  public_token: string | null
}

type SendPageData = {
  estimate: Unsafe
  job: {
    customer_name?: string | null
    customer_address?: string | null
    customer_email?: string | null
    customer_phone?: string | null
    title?: string | null
    estimate_date?: string | null
  }
  customer?: {
    name?: string | null
    company_name?: string | null
    email?: string | null
    phone?: string | null
    address?: string | null
    street?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
  } | null
  company: CompanyProfile
  inputs: {
    rooms?: Unsafe[]
    room_wall_scopes?: Unsafe[]
    room_ceiling_scopes?: Unsafe[]
    room_trim_scopes?: Unsafe[]
    trim_items?: Unsafe[]
    other?: Unsafe[]
    jobsettings?: Unsafe | null
  }
  catalogs?: Unsafe | null
  pricing_summary?: { finalTotal: number | null } | null
  draft: Record<string, unknown>
  version: Record<string, unknown> | null
  public_url: string | null
  document: CustomerEstimateDocument
  versions: Record<string, unknown>[]
}

type TemplatePreset = {
  key: string
  label: string
  subject: string
  body: string
}

const templatePresets: TemplatePreset[] = [
  {
    key: 'default',
    label: 'Default',
    subject: 'Your estimate is ready',
    body:
      'Hello,\n\nYour estimate is ready. Please review the secure link below and let us know if you have any questions.\n\nThank you.',
  },
  {
    key: 'concise',
    label: 'Concise',
    subject: 'Attached: estimate for your project',
    body: 'Hello,\n\nYour estimate is ready for review.\n\nThank you.',
  },
  {
    key: 'friendly',
    label: 'Friendly',
    subject: 'Here is your estimate',
    body:
      'Hello,\n\nIt was great talking with you. Your estimate is ready to review at the secure link below.\n\nPlease reach out if you want to discuss anything before you accept.',
  },
]

const shellBg =
  'radial-gradient(circle at top left, rgba(133,199,155,0.08), transparent 28%), radial-gradient(circle at bottom right, rgba(255,255,255,0.05), transparent 24%), linear-gradient(180deg, #111 0%, #090909 100%)'

const C = {
  bg: '#0b0b0b',
  shell: '#111111',
  card: '#171717',
  card2: '#202020',
  border: '#2a2a2a',
  borderSoft: '#373737',
  ink: '#f4f4f4',
  ink2: '#c4c4c4',
  ink3: '#8f8f8f',
  green: '#85c79b',
}

const shellCard: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
}

const inputBase: CSSProperties = {
  width: '100%',
  borderRadius: 10,
  border: `1px solid ${C.borderSoft}`,
  background: '#101010',
  color: C.ink,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
}

const textareaBase: CSSProperties = {
  ...inputBase,
  minHeight: 110,
  resize: 'vertical',
  lineHeight: 1.5,
}

const actionButton: CSSProperties = {
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  border: `1px solid rgba(133,199,155,0.28)`,
  background: 'rgba(133,199,155,0.12)',
  color: '#d7f3df',
}

const secondaryButton: CSSProperties = {
  ...actionButton,
  border: `1px solid ${C.borderSoft}`,
  background: '#101010',
  color: C.ink,
}

function asText(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function sectionDraftText(
  draft: Record<string, unknown> | null | undefined,
  key: CustomerEstimateSectionKey
) {
  const scope = (draft?.scope_text_edits as Record<string, unknown> | null | undefined) ?? {}
  return asText(scope[key])
}

function buildInitialDraft(data: SendPageData): DraftState {
  return buildDraftFromData(data, data.draft ?? {}, true)
}

function buildDraftFromData(
  data: SendPageData,
  draft: Record<string, unknown>,
  keepScopeWordingDrafts: boolean
): DraftState {
  const scopeTextEdits = {
    walls: keepScopeWordingDrafts ? sectionDraftText(draft, 'walls') : '',
    ceilings: keepScopeWordingDrafts ? sectionDraftText(draft, 'ceilings') : '',
    trim: keepScopeWordingDrafts ? sectionDraftText(draft, 'trim') : '',
    doors: keepScopeWordingDrafts ? sectionDraftText(draft, 'doors') : '',
    cabinets: keepScopeWordingDrafts ? sectionDraftText(draft, 'cabinets') : '',
    other: keepScopeWordingDrafts ? sectionDraftText(draft, 'other') : '',
  }

  return {
    to_email: asText(draft.to_email) || asText(data.job.customer_email) || asText(data.document.customer.email),
    cc_email: asText(draft.cc_email),
    bcc_email: asText(draft.bcc_email),
    subject:
      asText(draft.subject) ||
      `${asText(data.document.meta.title) || 'Estimate'} from ${asText(data.company.business_name) || 'ACE Painting'}`,
    body:
      asText(draft.body) ||
      `Hello ${asText(data.document.customer.name) || 'there'},\n\nYour estimate is ready for review.\n\nThank you.`,
    template_key: asText(draft.template_key) || 'default',
    title: asText(draft.title) || asText(data.document.meta.title),
    quote_validity_days: asText(draft.quote_validity_days) || String(data.document.quote_validity_days ?? 90),
    scope_text_edits: scopeTextEdits,
  }
}

function draftPayload(form: DraftState) {
  return {
    to_email: form.to_email,
    cc_email: form.cc_email,
    bcc_email: form.bcc_email,
    subject: form.subject,
    body: form.body,
    template_key: form.template_key,
    title: form.title,
    quote_validity_days: form.quote_validity_days,
    scope_text_edits: form.scope_text_edits,
  }
}

function customerSendUrl(estimateId: string, catalogSource?: 'estimate' | 'v2') {
  const url = `/api/estimates/${estimateId}/customer-send`
  return catalogSource === 'v2' ? `${url}?v2=1` : url
}

function StatusChip({ status }: { status: string }) {
  const normalized = status.toLowerCase()
  const tone =
    normalized === 'accepted'
      ? { border: 'rgba(133,199,155,0.3)', bg: 'rgba(133,199,155,0.12)', fg: '#d7f3df' }
      : normalized === 'sent' || normalized === 'viewed'
        ? { border: 'rgba(96,165,250,0.24)', bg: 'rgba(96,165,250,0.1)', fg: '#dbeafe' }
        : { border: C.borderSoft, bg: '#101010', fg: C.ink2 }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.fg,
        padding: '6px 10px',
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: '0.01em',
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 800, color: C.ink2, marginBottom: 6 }}>
      {children}
    </div>
  )
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.ink3, fontWeight: 700 }}>
        {title}
      </div>
      {subtitle ? <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.5 }}>{subtitle}</div> : null}
    </div>
  )
}

export default function SendEstimateClient({
  estimateId,
  catalogSource,
}: {
  estimateId: string
  catalogSource?: 'estimate' | 'v2'
}) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SendPageData | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [version, setVersion] = useState<VersionState | null>(null)
  const [form, setForm] = useState<DraftState | null>(null)
  const mountedRef = useRef(true)

  const loadSendPage = useCallback(async (options?: { hard?: boolean }) => {
    setLoading(true)
    if (options?.hard) {
      setMessage(null)
      setError(null)
    } else {
      setError(null)
    }

    const res = await authedFetch(customerSendUrl(estimateId, catalogSource), { cache: 'no-store' })
    const payload = await res.json().catch(() => null)
    if (!mountedRef.current) return false
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to load estimate send page')
      setLoading(false)
      return false
    }

    setData(payload as SendPageData)
    setPublicUrl((payload?.public_url as string | null) ?? null)
    setVersion(
      payload?.version
        ? {
            status: asText(payload.version.status) || 'draft',
            sent_at: (payload.version.sent_at as string | null) ?? null,
            viewed_at: (payload.version.viewed_at as string | null) ?? null,
            accepted_at: (payload.version.accepted_at as string | null) ?? null,
            declined_at: (payload.version.declined_at as string | null) ?? null,
            public_token: (payload.version.public_token as string | null) ?? null,
          }
        : {
            status: 'draft',
            sent_at: null,
            viewed_at: null,
            accepted_at: null,
            declined_at: null,
            public_token: null,
          }
    )
    setForm(
      buildDraftFromData(
        payload as SendPageData,
        (payload?.draft as Record<string, unknown> | null | undefined) ?? {},
        !options?.hard
      )
    )
    setLoading(false)
    return true
  }, [catalogSource, estimateId])

  useEffect(() => {
    mountedRef.current = true
    void loadSendPage()

    return () => {
      mountedRef.current = false
    }
  }, [loadSendPage])

  const liveDocument = useMemo(() => {
    if (!data || !form) return null
    return buildCustomerEstimateDocument({
      estimate: data.estimate,
      job: data.job,
      customer: data.customer ?? null,
      company: data.company,
      inputs: data.inputs,
      catalogs: data.catalogs ?? null,
      pricingSummary: data.pricing_summary ? { finalTotal: data.pricing_summary.finalTotal ?? null } : null,
      overrides: {
        title: form.title,
        scope_text_edits: form.scope_text_edits,
        quote_validity_days: form.quote_validity_days,
      },
      publicMeta: {
        status: version?.status ?? 'draft',
        sent_at: version?.sent_at ?? null,
        viewed_at: version?.viewed_at ?? null,
        accepted_at: version?.accepted_at ?? null,
        declined_at: version?.declined_at ?? null,
        public_token: version?.public_token ?? null,
      },
    })
  }, [data, form, version])

  const currentTemplate = useMemo(() => {
    return templatePresets.find((preset) => preset.key === form?.template_key) ?? templatePresets[0]
  }, [form?.template_key])
  const isV2Quote = data?.document.meta.flow_version === 'v2'
  const documentLabel = isV2Quote ? 'Quote' : 'Estimate'
  const documentLabelLower = documentLabel.toLowerCase()
  const shellLabel = isV2Quote ? 'Customer Quote' : 'Customer Estimate'
  const actionLabel = isV2Quote ? 'Send Quote' : 'Send Estimate'

  const isLive = asText(version?.status) !== 'draft'
  const hasLiveLink = Boolean(publicUrl)

  const setDraftField = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const applyTemplate = (templateKey: string) => {
    const next = templatePresets.find((preset) => preset.key === templateKey) ?? templatePresets[0]
    setForm((prev) =>
      prev
        ? {
            ...prev,
            template_key: next.key,
            subject: next.subject,
            body: next.body,
          }
        : prev
    )
  }

  const persistDraft = async () => {
    if (!form) return
    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await authedFetch(customerSendUrl(estimateId, catalogSource), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: draftPayload(form) }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? 'Unable to save draft')
      setBusy(false)
      return
    }

    setMessage('Draft saved.')
    setPublicUrl((payload?.public_url as string | null) ?? publicUrl)
    if (payload?.version) {
      setVersion({
        status: asText(payload.version.status) || 'draft',
        sent_at: (payload.version.sent_at as string | null) ?? null,
        viewed_at: (payload.version.viewed_at as string | null) ?? null,
        accepted_at: (payload.version.accepted_at as string | null) ?? null,
        declined_at: (payload.version.declined_at as string | null) ?? null,
        public_token: (payload.version.public_token as string | null) ?? null,
      })
    }
    setBusy(false)
  }

  const submitEstimate = async (mode: 'test' | 'send') => {
    if (!form) return
    if (mode === 'test' && !form.to_email.trim()) {
      setError('To email is required for a test send.')
      return
    }

    setBusy(true)
    setError(null)
    setMessage(null)
    const res = await authedFetch(customerSendUrl(estimateId, catalogSource), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, draft: draftPayload(form) }),
    })
    const payload = await res.json().catch(() => null)
    if (!res.ok) {
      setError(payload?.error ?? `Unable to send ${documentLabelLower}`)
      setBusy(false)
      return
    }

    setMessage(mode === 'test' ? 'Test message sent.' : `${documentLabel} sent.`)
    setPublicUrl((payload?.public_url as string | null) ?? publicUrl)
    if (payload?.version) {
      setVersion({
        status: asText(payload.version.status) || (mode === 'send' ? 'sent' : 'draft'),
        sent_at: (payload.version.sent_at as string | null) ?? null,
        viewed_at: (payload.version.viewed_at as string | null) ?? null,
        accepted_at: (payload.version.accepted_at as string | null) ?? null,
        declined_at: (payload.version.declined_at as string | null) ?? null,
        public_token: (payload.version.public_token as string | null) ?? null,
      })
    }
    setBusy(false)
  }

  const copyLink = async () => {
    if (!publicUrl) {
      setError(`Send the ${documentLabelLower} first to create a live link.`)
      return
    }
    await navigator.clipboard.writeText(publicUrl)
    setMessage('Customer link copied.')
  }

  const hardRefresh = async () => {
    if (busy) return
    const hasUnsavedChanges = !!form && !!data
      ? JSON.stringify(form) !== JSON.stringify(buildInitialDraft(data))
      : false
    if (hasUnsavedChanges) {
      const shouldDiscard = window.confirm(
        'Reload the latest estimate data from the server? This will discard unsaved changes on this page.'
      )
      if (!shouldDiscard) return
    }
    await loadSendPage({ hard: true })
    setMessage('Reloaded latest estimate data.')
  }

  const downloadPdf = () => {
    if (publicUrl) {
      window.open(`${publicUrl}?print=1`, '_blank', 'noopener,noreferrer')
      return
    }
    window.print()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ minHeight: '100vh', background: shellBg, padding: 20 }}>
          <div style={{ maxWidth: 1580, margin: '0 auto', display: 'grid', gap: 18 }}>
            <div style={{ ...shellCard, padding: '16px 18px' }}>
              <div style={{ height: 16, width: 180, background: '#222', borderRadius: 8 }} />
              <div style={{ marginTop: 10, height: 28, width: 340, background: '#222', borderRadius: 8 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 430px) minmax(0, 1fr)', gap: 18 }}>
              <div style={{ ...shellCard, minHeight: 700, background: C.card }} />
              <div style={{ ...shellCard, minHeight: 900, background: C.card }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ minHeight: '100vh', background: shellBg, padding: 20 }}>
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <div style={{ ...shellCard, padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{actionLabel}</div>
              <div style={{ marginTop: 10, color: C.ink2 }}>{error}</div>
              <div style={{ marginTop: 16 }}>
                <Link href={`/crm/estimates/${estimateId}/v2/summary`} style={{ color: '#d7f3df', fontWeight: 800 }}>
                  Return to internal review
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!data || !form || !liveDocument) return null

  return (
    <div
      className="send-shell"
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.ink,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div className="send-page" style={{ minHeight: '100vh', background: shellBg, padding: 20 }}>
        <div style={{ maxWidth: 1580, margin: '0 auto', display: 'grid', gap: 18 }}>
          <div
            className="send-topbar"
            style={{
              ...shellCard,
              padding: '16px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              alignItems: 'center',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.ink3, fontWeight: 700 }}>
                {shellLabel}
              </div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em' }}>{actionLabel}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: C.ink2 }}>
                {asText(data.document.customer.name) || 'Customer'} - {asText(data.document.meta.title) || documentLabel}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <StatusChip status={version?.status ?? 'draft'} />
              <button type="button" onClick={hardRefresh} className="send-buttons" style={secondaryButton}>
                Reload latest
              </button>
              <Link
                href={`/crm/estimates/${estimateId}/v2/summary`}
                style={{
                  ...secondaryButton,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
              >
                Back to review
              </Link>
              <button type="button" onClick={downloadPdf} className="send-buttons" style={secondaryButton}>
                Download PDF
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(360px, 430px) minmax(0, 1fr)',
              gap: 18,
              alignItems: 'start',
            }}
          >
            <aside
              className="send-controls"
              style={{
                ...shellCard,
                padding: 18,
                display: 'grid',
                gap: 16,
                position: 'sticky',
                top: 18,
                maxHeight: 'calc(100vh - 56px)',
                overflow: 'auto',
              }}
            >
              {message ? (
                <div
                  style={{
                    border: '1px solid rgba(133,199,155,0.24)',
                    background: 'rgba(133,199,155,0.08)',
                    color: '#cdeed5',
                    borderRadius: 10,
                    padding: '10px 12px',
                    fontSize: 13,
                  }}
                >
                  {message}
                </div>
              ) : null}

              <SectionTitle
                title="Email"
                subtitle="Prefilled from CRM data, but fully editable before draft or send."
              />

              <label style={{ display: 'grid' }}>
                <FieldLabel>To email</FieldLabel>
                <input
                  value={form.to_email}
                  onChange={(event) => setDraftField('to_email', event.target.value)}
                  style={inputBase}
                  placeholder="customer@example.com"
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid' }}>
                  <FieldLabel>CC</FieldLabel>
                  <input
                    value={form.cc_email}
                    onChange={(event) => setDraftField('cc_email', event.target.value)}
                    style={inputBase}
                    placeholder="optional"
                  />
                </label>
                <label style={{ display: 'grid' }}>
                  <FieldLabel>BCC</FieldLabel>
                  <input
                    value={form.bcc_email}
                    onChange={(event) => setDraftField('bcc_email', event.target.value)}
                    style={inputBase}
                    placeholder="optional"
                  />
                </label>
              </div>

              <label style={{ display: 'grid' }}>
                <FieldLabel>Template preset</FieldLabel>
                <select
                  value={form.template_key}
                  onChange={(event) => applyTemplate(event.target.value)}
                  style={inputBase}
                >
                  {templatePresets.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid' }}>
                <FieldLabel>Subject</FieldLabel>
                <input
                  value={form.subject}
                  onChange={(event) => setDraftField('subject', event.target.value)}
                  style={inputBase}
                  placeholder={`${documentLabel} ready`}
                />
              </label>

              <label style={{ display: 'grid' }}>
                <FieldLabel>Email body</FieldLabel>
                <textarea
                  value={form.body}
                  onChange={(event) => setDraftField('body', event.target.value)}
                  style={textareaBase}
                  placeholder="Write the customer message here"
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <button type="button" disabled={busy} onClick={persistDraft} style={actionButton}>
                  Save Draft
                </button>
                <button type="button" disabled={busy} onClick={() => submitEstimate('test')} style={secondaryButton}>
                  Send Test
                </button>
                <button type="button" disabled={busy} onClick={() => submitEstimate('send')} style={actionButton}>
                {actionLabel}
              </button>
                <button type="button" disabled={!hasLiveLink} onClick={copyLink} style={secondaryButton}>
                  Copy Link
                </button>
              </div>

              <details open style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 900, color: C.ink }}>
                  Advanced
                </summary>
                <div style={{ marginTop: 14, display: 'grid', gap: 14 }}>
                  <label style={{ display: 'grid' }}>
                    <FieldLabel>{documentLabel} title</FieldLabel>
                    <input
                      value={form.title}
                      onChange={(event) => setDraftField('title', event.target.value)}
                      style={inputBase}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={{ display: 'grid' }}>
                      <FieldLabel>Quote validity days</FieldLabel>
                      <input
                        value={form.quote_validity_days}
                        onChange={(event) => setDraftField('quote_validity_days', event.target.value)}
                        style={inputBase}
                        inputMode="numeric"
                      />
                    </label>
                    <label style={{ display: 'grid' }}>
                      <FieldLabel>Template key</FieldLabel>
                      <input value={currentTemplate.key} readOnly style={{ ...inputBase, opacity: 0.72 }} />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    <FieldLabel>Scope wording edits</FieldLabel>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {(['walls', 'ceilings', 'trim', 'doors', 'cabinets', 'other'] as CustomerEstimateSectionKey[]).map((key) => (
                        <label key={key} style={{ display: 'grid', gap: 6 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.ink2, textTransform: 'capitalize' }}>{key}</div>
                          <textarea
                            value={form.scope_text_edits[key]}
                            onChange={(event) =>
                              setForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      scope_text_edits: {
                                        ...prev.scope_text_edits,
                                        [key]: event.target.value,
                                      },
                                    }
                                  : prev
                              )
                            }
                            placeholder="Leave blank to use calculated customer copy"
                            style={{ ...textareaBase, minHeight: 74 }}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </details>

              <div style={{ display: 'grid', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
                <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.55 }}>
                  Current live link: {publicUrl ? <span style={{ color: '#d7f3df' }}>{publicUrl}</span> : 'Not sent yet'}
                </div>
                <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.55 }}>
                  {isLive
                  ? 'This quote version is live and frozen.'
                    : 'Edits here stay in the draft until you send the quote.'}
                </div>
              </div>
            </aside>

            <main
              className="send-preview"
              style={{
                ...shellCard,
                padding: 18,
                position: 'sticky',
                top: 18,
                maxHeight: 'calc(100vh - 56px)',
                overflow: 'auto',
              }}
            >
              <div
                className="send-preview-panel"
                style={{
                  display: 'grid',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.ink3, fontWeight: 700 }}>
                      Customer Preview
                    </div>
                    <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>
                      Exact document the customer will see
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span
                      style={{
                        border: `1px solid ${C.borderSoft}`,
                        background: '#101010',
                        borderRadius: 999,
                        padding: '6px 10px',
                        color: C.ink2,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {liveDocument.scopes.length} scope sections
                    </span>
                    <span
                      style={{
                        border: `1px solid ${C.borderSoft}`,
                        background: '#101010',
                        borderRadius: 999,
                        padding: '6px 10px',
                        color: C.ink2,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {liveDocument.meta.status}
                    </span>
                  </div>
                </div>
                <CustomerEstimateDocumentView document={liveDocument} showShell={false} />
              </div>
            </main>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .send-shell {
            background: #fff !important;
            color: #111 !important;
          }
          .send-page {
            background: #fff !important;
            padding: 0 !important;
          }
          .send-topbar,
          .send-controls,
          .send-buttons,
          .send-preview-panel > div:first-child {
            display: none !important;
          }
          .send-preview {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            background: #fff !important;
            padding: 0 !important;
          }
          .send-preview-panel {
            display: block !important;
            padding: 0 !important;
          }
          a[href]:after {
            content: '';
          }
        }
      `}</style>
    </div>
  )
}
