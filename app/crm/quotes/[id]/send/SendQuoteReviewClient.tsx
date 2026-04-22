'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { buildCustomerEstimateDocument } from '@/lib/customer-estimates/build'
import { templatePresets } from '@/lib/customer-estimates/presets'
import { CustomerEstimateDocumentView } from '@/lib/customer-estimates/view'
import {
  type CustomerSendMutationResponse,
  loadCustomerSendPage,
  saveCustomerSendDraft,
  submitCustomerSend,
} from '@/lib/quotes/client'
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
  template_key: string
  subject: string
  body: string
  title: string
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
  settings?: {
    default_template_key?: string | null
    quote_validity_days?: number | null
    terms_text?: string | null
    updated_at?: string | null
  } | null
  draft: Record<string, unknown>
  version: Record<string, unknown> | null
  public_url: string | null
  document: CustomerEstimateDocument
  versions: Record<string, unknown>[]
}

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
  borderRadius: 16,
}

const inputBase: CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: `1px solid ${C.borderSoft}`,
  background: '#101010',
  color: C.ink,
  padding: '10px 12px',
  fontSize: 14,
  outline: 'none',
}

const textareaBase: CSSProperties = {
  ...inputBase,
  minHeight: 96,
  resize: 'vertical',
  lineHeight: 1.5,
}

const actionButton: CSSProperties = {
  borderRadius: 12,
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

function fmtUSD(value: number | null | undefined) {
  if (value == null) return '-'
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function snippet(text: string, max = 96) {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned
}

function sectionDraftText(draft: Record<string, unknown> | null | undefined, key: CustomerEstimateSectionKey) {
  const scope = (draft?.scope_text_edits as Record<string, unknown> | null | undefined) ?? {}
  return asText(scope[key])
}

function scopeSummary(section: CustomerEstimateDocument['scopes'][number], overrideText: string) {
  if (overrideText.trim()) return snippet(overrideText)
  return snippet(section.text)
}

function buildInitialDraft(data: SendPageData): DraftState {
  const draft = data.draft ?? {}
  const settings = data.settings ?? {}
  const preset =
    templatePresets.find((item) => item.key === asText(draft.template_key) || item.key === asText(settings.default_template_key)) ??
    templatePresets[0]
  const scopeTextEdits = {
    walls: sectionDraftText(draft, 'walls'),
    ceilings: sectionDraftText(draft, 'ceilings'),
    trim: sectionDraftText(draft, 'trim'),
    doors: sectionDraftText(draft, 'doors'),
    cabinets: sectionDraftText(draft, 'cabinets'),
    other: sectionDraftText(draft, 'other'),
  }

  return {
    to_email: asText(draft.to_email) || asText(data.job.customer_email) || asText(data.document.customer.email),
    cc_email: asText(draft.cc_email),
    bcc_email: asText(draft.bcc_email),
    template_key: preset.key,
    subject: asText(draft.subject) || preset.subject,
    body: asText(draft.body) || preset.body,
    title: asText(draft.title) || asText(data.document.meta.title),
    scope_text_edits: scopeTextEdits,
  }
}

function draftPayload(form: DraftState) {
  return {
    to_email: form.to_email,
    cc_email: form.cc_email,
    bcc_email: form.bcc_email,
    template_key: form.template_key,
    subject: form.subject,
    body: form.body,
    title: form.title,
    scope_text_edits: form.scope_text_edits,
  }
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 800, color: C.ink2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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

function ScopeEditor({
  section,
  value,
  onChange,
}: {
  section: CustomerEstimateDocument['scopes'][number]
  value: string
  onChange: (next: string) => void
}) {
  const muted = section.price == null
  return (
    <details
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        background: muted ? '#111111' : C.card2,
        overflow: 'hidden',
        opacity: muted ? 0.82 : 1,
      }}
    >
      <summary
        style={{
          listStyle: 'none',
          cursor: 'pointer',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: muted ? C.ink2 : C.ink }}>{section.label}</div>
          <div style={{ marginTop: 4, fontSize: 12, color: muted ? C.ink3 : C.ink3 }}>
            {muted ? 'Not included in this quote' : scopeSummary(section, value)}
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.ink3, fontWeight: 800, whiteSpace: 'nowrap' }}>
          {muted ? 'Muted' : fmtUSD(section.price)}
        </div>
      </summary>
      <div style={{ borderTop: `1px solid ${C.border}`, padding: 14, display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.5 }}>
          Override only when needed. Leave blank to use the calculated customer copy.
        </div>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ ...textareaBase, minHeight: 92 }}
          placeholder={muted ? `${section.label} is not included in this quote.` : 'Edit customer-facing scope copy'}
        />
      </div>
    </details>
  )
}

export default function SendEstimateReviewClient({ estimateId }: { estimateId: string }) {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SendPageData | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [version, setVersion] = useState<VersionState | null>(null)
  const [form, setForm] = useState<DraftState | null>(null)

  useEffect(() => {
    let alive = true

    ;(async () => {
      setLoading(true)
      setError(null)
      let payload: SendPageData
      try {
        payload = await loadCustomerSendPage<SendPageData>(`/api/quotes/${estimateId}/customer-send`)
      } catch (error) {
        if (!alive) return
        setError(error instanceof Error ? error.message : 'Unable to load quote send page')
        setLoading(false)
        return
      }
      if (!alive) return

      const next = payload
      setData(next)
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
      setForm(buildInitialDraft(next))
      setLoading(false)
    })()

    return () => {
      alive = false
    }
  }, [estimateId])

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
      settings: data.settings ?? undefined,
      overrides: {
        title: form.title,
        scope_text_edits: form.scope_text_edits,
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

  const currentTemplate = useMemo(
    () => templatePresets.find((preset) => preset.key === form?.template_key) ?? templatePresets[0],
    [form?.template_key]
  )
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
    setForm((prev) => (prev ? { ...prev, template_key: next.key, subject: next.subject, body: next.body } : prev))
  }

  const persistDraft = async () => {
    if (!form) return
    setBusy(true)
    setError(null)
    setMessage(null)
    let payload: CustomerSendMutationResponse
    try {
      payload = await saveCustomerSendDraft<CustomerSendMutationResponse>(
        `/api/quotes/${estimateId}/customer-send`,
        draftPayload(form)
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save draft')
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
    let payload: CustomerSendMutationResponse
    try {
      payload = await submitCustomerSend<CustomerSendMutationResponse>(
        `/api/quotes/${estimateId}/customer-send`,
        {
          mode,
          draft: draftPayload(form),
        }
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : `Unable to send ${documentLabelLower}`)
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
          <div style={{ maxWidth: 1600, margin: '0 auto', display: 'grid', gap: 18 }}>
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
                <Link href={`/crm/quotes/${estimateId}/summary`} style={{ color: '#d7f3df', fontWeight: 800 }}>
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
    <div className="send-shell" style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="send-page" style={{ minHeight: '100vh', background: shellBg, padding: 20 }}>
        <div style={{ maxWidth: 1600, margin: '0 auto', display: 'grid', gap: 18 }}>
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
              <Link
                href={`/crm/quotes/${estimateId}/summary`}
                style={{ ...secondaryButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              >
                Back to review
              </Link>
              <button type="button" onClick={downloadPdf} className="send-buttons" style={secondaryButton}>
                Download PDF
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 430px) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
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
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 13,
                  }}
                >
                  {message}
                </div>
              ) : null}
              {error ? (
                <div
                  style={{
                    border: '1px solid rgba(248,113,113,0.24)',
                    background: 'rgba(248,113,113,0.08)',
                    color: '#fecaca',
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              ) : null}

              <SectionTitle title="Email" subtitle="Prefilled from CRM data, but fully editable before draft or send." />

              <label style={{ display: 'grid' }}>
                <FieldLabel>To</FieldLabel>
                <input value={form.to_email} onChange={(event) => setDraftField('to_email', event.target.value)} style={inputBase} placeholder="customer@example.com" />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{ display: 'grid' }}>
                  <FieldLabel>CC</FieldLabel>
                  <input value={form.cc_email} onChange={(event) => setDraftField('cc_email', event.target.value)} style={inputBase} placeholder="optional" />
                </label>
                <label style={{ display: 'grid' }}>
                  <FieldLabel>BCC</FieldLabel>
                  <input value={form.bcc_email} onChange={(event) => setDraftField('bcc_email', event.target.value)} style={inputBase} placeholder="optional" />
                </label>
              </div>

              <label style={{ display: 'grid' }}>
                <FieldLabel>Template preset</FieldLabel>
                <select value={form.template_key} onChange={(event) => applyTemplate(event.target.value)} style={inputBase}>
                  {templatePresets.map((preset) => (
                    <option key={preset.key} value={preset.key}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid' }}>
                <FieldLabel>Subject</FieldLabel>
                <input value={form.subject} onChange={(event) => setDraftField('subject', event.target.value)} style={inputBase} placeholder={`${documentLabel} ready`} />
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

              <label style={{ display: 'grid' }}>
                <FieldLabel>{documentLabel} title</FieldLabel>
                <input value={form.title} onChange={(event) => setDraftField('title', event.target.value)} style={inputBase} />
              </label>

              <SectionTitle title="Scope Overrides" subtitle="Collapsed by default. Override only when needed." />
              <div style={{ display: 'grid', gap: 10 }}>
                {liveDocument.scopes.map((section) => (
                  <ScopeEditor
                    key={section.key}
                    section={section}
                    value={form.scope_text_edits[section.key]}
                    onChange={(next) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              scope_text_edits: {
                                ...prev.scope_text_edits,
                                [section.key]: next,
                              },
                            }
                          : prev
                      )
                    }
                  />
                ))}
              </div>

              <div style={{ display: 'grid', gap: 8, borderTop: `1px solid ${C.border}`, paddingTop: 14, marginTop: 2 }}>
                <div style={{ fontSize: 12, color: C.ink2, lineHeight: 1.55 }}>
                  Current live link: {publicUrl ? <span style={{ color: '#d7f3df' }}>{publicUrl}</span> : 'Not sent yet'}
                </div>
                <div style={{ fontSize: 12, color: C.ink3, lineHeight: 1.55 }}>
                  {isLive ? 'This quote version is live and frozen.' : 'Edits here stay in the draft until you send the quote.'}
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 'auto', paddingTop: 6 }}>
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
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: C.ink3, fontWeight: 700 }}>
                      Customer Preview
                    </div>
                    <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>Exact document the customer will see</div>
                  </div>
                  <div style={{ fontSize: 12, color: C.ink3, fontWeight: 800 }}>{currentTemplate.label} template</div>
                </div>
                <div style={{ borderRadius: 18, background: '#f2f0eb', padding: 18 }}>
                  <CustomerEstimateDocumentView document={liveDocument} showShell={false} />
                </div>
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
          .send-preview > div:first-child {
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
          a[href]:after {
            content: '';
          }
        }
      `}</style>
    </div>
  )
}
