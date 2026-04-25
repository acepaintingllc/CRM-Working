'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { templatePresets } from '@/lib/customer-estimates/presets'
import { CustomerEstimateDocumentView } from '@/lib/customer-estimates/view'
import {
  estimateRouteFamily,
  quoteRouteFamily,
  type EstimateRouteFamily,
} from '../estimateRouteFamily'
import {
  asText,
  buildCustomerSendComposerDraft,
  buildCustomerSendComposerPreview,
  type CustomerSendComposerDraft,
  useCustomerSendWorkflow,
} from './_shared/customerSendWorkflow'

const shellBg =
  'radial-gradient(circle at top left, rgba(133,199,155,0.08), transparent 28%), radial-gradient(circle at bottom right, rgba(255,255,255,0.05), transparent 24%), linear-gradient(180deg, #111 0%, #090909 100%)'

const C = {
  bg: '#0b0b0b',
  shell: '#111111',
  card: '#171717',
  border: '#2a2a2a',
  borderSoft: '#373737',
  ink: '#f4f4f4',
  ink2: '#c4c4c4',
  ink3: '#8f8f8f',
} as const

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
  border: '1px solid rgba(133,199,155,0.28)',
  background: 'rgba(133,199,155,0.12)',
  color: '#d7f3df',
}

const secondaryButton: CSSProperties = {
  ...actionButton,
  border: `1px solid ${C.borderSoft}`,
  background: '#101010',
  color: C.ink,
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
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: C.ink3,
          fontWeight: 700,
        }}
      >
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

function draftPayload(form: CustomerSendComposerDraft) {
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

export default function SendEstimateClient({
  estimateId,
  catalogSource,
  routeFamilyKey = 'estimate',
  routeFamily,
}: {
  estimateId: string
  catalogSource?: 'estimate' | 'v2'
  routeFamilyKey?: 'estimate' | 'quote'
  routeFamily?: EstimateRouteFamily
}) {
  const resolvedRouteFamily =
    routeFamily ?? (routeFamilyKey === 'quote' ? quoteRouteFamily : estimateRouteFamily)
  const {
    loading,
    busy,
    message,
    setMessage,
    error,
    setError,
    data,
    publicUrl,
    form,
    setForm,
    reload,
    persistDraft,
    submit,
    labels,
    liveDocument,
    currentTemplate,
    hasLiveLink,
    version,
  } = useCustomerSendWorkflow<CustomerSendComposerDraft>({
    estimateId,
    catalogSource,
    routeFamily: resolvedRouteFamily,
    buildForm: buildCustomerSendComposerDraft,
    buildDocument: buildCustomerSendComposerPreview,
    draftPayload,
    loadErrorMessage: 'Unable to load quote send page',
  })

  const [showAdvanced, setShowAdvanced] = useState(false)

  const setDraftField = <K extends keyof CustomerSendComposerDraft>(
    key: K,
    value: CustomerSendComposerDraft[K]
  ) => {
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

  const copyLink = async () => {
    if (!publicUrl) {
      setError(`Send the ${labels.documentLower} first to create a live link.`)
      return
    }
    await navigator.clipboard.writeText(publicUrl)
    setMessage('Customer link copied.')
  }

  const hardRefresh = async () => {
    if (busy || !data || !form) return
    const hasUnsavedChanges =
      JSON.stringify(form) !==
      JSON.stringify(buildCustomerSendComposerDraft(data, data.draft ?? {}, true))
    if (hasUnsavedChanges) {
      const shouldDiscard = window.confirm(
        `Reload the latest ${labels.documentLower} data from the server? This will discard unsaved changes on this page.`
      )
      if (!shouldDiscard) return
    }
    await reload({ hard: true })
    setMessage(`Reloaded latest ${labels.documentLower} data.`)
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
      <div style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
        <div style={{ minHeight: '100vh', background: shellBg, padding: 20 }}>
          <div style={{ maxWidth: 1580, margin: '0 auto', display: 'grid', gap: 18 }}>
            <div style={{ ...shellCard, padding: '16px 18px', minHeight: 90 }} />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(360px, 430px) minmax(0, 1fr)',
                gap: 18,
              }}
            >
              <div style={{ ...shellCard, minHeight: 700 }} />
              <div style={{ ...shellCard, minHeight: 900 }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
        <div style={{ minHeight: '100vh', background: shellBg, padding: 20 }}>
          <div style={{ maxWidth: 980, margin: '0 auto' }}>
            <div style={{ ...shellCard, padding: 18 }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{labels.action}</div>
              <div style={{ marginTop: 10, color: C.ink2 }}>{error}</div>
              <div style={{ marginTop: 16 }}>
                <Link
                  href={resolvedRouteFamily.summaryHref(estimateId)}
                  style={{ color: '#d7f3df', fontWeight: 800 }}
                >
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
    <div className="send-shell" style={{ minHeight: '100vh', background: C.bg, color: C.ink }}>
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
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: C.ink3,
                  fontWeight: 700,
                }}
              >
                {labels.shell}
              </div>
              <div style={{ marginTop: 4, fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em' }}>
                {labels.action}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: C.ink2 }}>
                {asText(data.document.customer.name) || 'Customer'} |{' '}
                {asText(data.document.meta.title) || labels.document}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <StatusChip status={version?.status ?? 'draft'} />
              <Link
                href={resolvedRouteFamily.summaryHref(estimateId)}
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

              <SectionTitle
                title="Delivery"
                subtitle={`Prepare the exact ${labels.documentLower} email the customer will receive.`}
              />

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <FieldLabel>Template</FieldLabel>
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
                </div>

                <div>
                  <FieldLabel>To</FieldLabel>
                  <input
                    value={form.to_email}
                    onChange={(event) => setDraftField('to_email', event.target.value)}
                    style={inputBase}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <FieldLabel>CC</FieldLabel>
                    <input
                      value={form.cc_email}
                      onChange={(event) => setDraftField('cc_email', event.target.value)}
                      style={inputBase}
                    />
                  </div>
                  <div>
                    <FieldLabel>BCC</FieldLabel>
                    <input
                      value={form.bcc_email}
                      onChange={(event) => setDraftField('bcc_email', event.target.value)}
                      style={inputBase}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Subject</FieldLabel>
                  <input
                    value={form.subject}
                    onChange={(event) => setDraftField('subject', event.target.value)}
                    style={inputBase}
                  />
                </div>

                <div>
                  <FieldLabel>Title</FieldLabel>
                  <input
                    value={form.title}
                    onChange={(event) => setDraftField('title', event.target.value)}
                    style={inputBase}
                  />
                </div>

                <div>
                  <FieldLabel>Validity (days)</FieldLabel>
                  <input
                    value={form.quote_validity_days}
                    onChange={(event) => setDraftField('quote_validity_days', event.target.value)}
                    style={inputBase}
                  />
                </div>

                <div>
                  <FieldLabel>Message</FieldLabel>
                  <textarea
                    value={form.body}
                    onChange={(event) => setDraftField('body', event.target.value)}
                    style={textareaBase}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((current) => !current)}
                style={secondaryButton}
              >
                {showAdvanced ? 'Hide scope wording edits' : 'Edit scope wording'}
              </button>

              {showAdvanced ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {(
                    ['walls', 'ceilings', 'trim', 'doors', 'cabinets', 'other'] as const
                  ).map((sectionKey) => (
                    <div key={sectionKey}>
                      <FieldLabel>{sectionKey}</FieldLabel>
                      <textarea
                        value={form.scope_text_edits[sectionKey]}
                        onChange={(event) =>
                          setDraftField('scope_text_edits', {
                            ...form.scope_text_edits,
                            [sectionKey]: event.target.value,
                          })
                        }
                        style={{ ...textareaBase, minHeight: 84 }}
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ display: 'grid', gap: 10, marginTop: 'auto', paddingTop: 6 }}>
                <button type="button" disabled={busy} onClick={() => void persistDraft()} style={actionButton}>
                  Save Draft
                </button>
                <button type="button" disabled={busy} onClick={() => void submit('test')} style={secondaryButton}>
                  Send Test
                </button>
                <button type="button" disabled={busy} onClick={() => void submit('send')} style={actionButton}>
                  {labels.action}
                </button>
                <button type="button" disabled={!hasLiveLink} onClick={copyLink} style={secondaryButton}>
                  Copy Link
                </button>
                <button type="button" disabled={busy} onClick={hardRefresh} style={secondaryButton}>
                  Reload Latest
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.16em',
                        textTransform: 'uppercase',
                        color: C.ink3,
                        fontWeight: 700,
                      }}
                    >
                      Customer Preview
                    </div>
                    <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>
                      Exact document the customer will see
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.ink3, fontWeight: 800 }}>
                    {currentTemplate.label} template
                  </div>
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
