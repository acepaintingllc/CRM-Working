import { useCallback, useMemo, useState } from 'react'
import type { QuoteSendDefaults } from '@/lib/settings/types'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
import { CustomerEstimateDocumentView } from '@/lib/customer-estimates/view'
import { ensureAssembledCustomerEstimateDocument } from '@/lib/customer-estimates/assemble.ts'
import type { BuiltCustomerEstimateDocument } from '@/lib/customer-estimates/types'
import type { QuoteTermsSections } from '@/lib/customer-estimates/termsDefaults'
import type { TemplatePreset } from '@/lib/customer-estimates/presets'

type QuoteSendDefaultsFormProps = {
  value: QuoteSendDefaults
  onChange: (patch: Partial<QuoteSendDefaults>) => void
  onSave: () => void
  canSave: boolean
  saving: boolean
  error: string | null
  notice: string | null
  validationError: string | null
}

const inputClassName =
  'ace-crm-input text-sm'

function buildPreviewDocument(value: QuoteSendDefaults) {
  const previewDocument: BuiltCustomerEstimateDocument = {
    meta: {
      estimate_id: 'settings-preview',
      version_name: 'Settings Preview',
      version_state: 'draft',
      flow_version: 'v2',
      title: 'Sample Interior Repaint',
      quote_date: 'May 12, 2026',
      sent_at: null,
      viewed_at: null,
      accepted_at: null,
      declined_at: null,
      status: 'draft',
      public_token: null,
    },
    company: {
      business_name: 'ACE Painting',
      timezone: 'America/Chicago',
      main_phone: '(555) 123-4567',
      business_email: 'office@example.com',
      address: '',
      website: '',
      sender_signature: '',
      logo_url: '',
    },
    customer: {
      name: 'Sample Customer',
      email: '',
      phone: '',
      address: '123 Main Street\nSpringfield, IL 62701',
      street: '',
      city: '',
      state: '',
      zip: '',
    },
    intro_paragraph: '',
    closing_paragraph: '',
    quote_validity_days: value.quote_validity_days,
    deposit_language: '',
    card_fee_note: '',
    quote_rows: [
      {
        key: 'walls',
        label: 'Walls',
        description:
          'Prepare and paint walls in the main living areas using customer-selected colors.',
        price: 2400,
      },
      {
        key: 'trim',
        label: 'Trim',
        description: 'Paint baseboards, casing, and door frames included in the selected rooms.',
        price: 850,
      },
      {
        key: 'doors',
        label: 'Doors',
        description: 'Paint interior doors included in the project scope.',
        price: 450,
      },
    ],
    scopes: [],
    total: 3700,
    terms: [],
    terms_sections: value.terms_sections,
    source_meta: {
      company: {
        business_name: true,
        main_phone: true,
        business_email: true,
        address: false,
        website: false,
        sender_signature: false,
        logo_url: false,
      },
      settings: {
        quote_validity_days: true,
        terms_text: false,
        terms_sections: true,
      },
      overrides: {
        title: true,
        intro_paragraph: false,
        closing_paragraph: false,
        deposit_language: false,
        card_fee_note: false,
      },
    },
  }

  return ensureAssembledCustomerEstimateDocument(previewDocument)
}

function TermsTextarea({
  label,
  value,
  rows = 3,
  onChange,
}: {
  label: string
  value: string
  rows?: number
  onChange: (value: string) => void
}) {
  return (
    <CrmField label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className={`${inputClassName} resize-y`}
      />
    </CrmField>
  )
}

export function QuoteSendDefaultsForm(props: QuoteSendDefaultsFormProps) {
  const [previewTermsFontSize, setPreviewTermsFontSize] = useState(14.8)
  const [termsPageOverflow, setTermsPageOverflow] = useState<Record<string, number>>({})
  const previewDocument = useMemo(() => buildPreviewDocument(props.value), [props.value])
  const termsPages = previewDocument.terms_pages?.length
    ? previewDocument.terms_pages
    : [previewDocument.terms_page]
  const recordTermsPageOverflow = useCallback(
    (pageTitle: string, pageIndex: number, overflowPx: number) => {
      setTermsPageOverflow((current) => {
        const key = `${pageTitle}:${pageIndex}`
        if (current[key] === overflowPx) return current
        return { ...current, [key]: overflowPx }
      })
    },
    []
  )

  const patchTerms = (patch: Partial<QuoteTermsSections>) => {
    props.onChange({
      terms_sections: {
        ...props.value.terms_sections,
        ...patch,
      },
    })
  }
  const patchTemplatePreset = (key: string, patch: Partial<TemplatePreset>) => {
    props.onChange({
      template_presets: props.value.template_presets.map((preset) =>
        preset.key === key ? { ...preset, ...patch, key: preset.key } : preset
      ),
    })
  }

  return (
    <div className="grid gap-4">
      <CrmSectionCard
        title="Quote Send Defaults"
        description="These defaults drive the quote send and review flow without rewriting unrelated estimate settings."
      >
        {props.error ? <CrmNotice tone="error" compact>{props.error}</CrmNotice> : null}
        {props.notice ? <CrmNotice tone="success" compact>{props.notice}</CrmNotice> : null}
        {props.validationError ? <CrmNotice tone="info" compact>{props.validationError}</CrmNotice> : null}

        <div className="grid gap-3 md:grid-cols-2">
          <CrmField label="Default template preset" help="Used when opening the quote send page.">
            <select
              value={props.value.default_template_key}
              onChange={(event) => props.onChange({ default_template_key: event.target.value })}
              className={inputClassName}
            >
              {props.value.template_presets.map((preset) => (
                <option key={preset.key} value={preset.key}>
                  {preset.label}
                </option>
              ))}
            </select>
          </CrmField>

          <CrmField label="Quote validity days" help="Rendered on the customer terms page.">
            <input
              type="number"
              min={1}
              max={365}
              value={props.value.quote_validity_days}
              onChange={(event) =>
                props.onChange({ quote_validity_days: Number(event.target.value || 0) })
              }
              className={inputClassName}
            />
          </CrmField>
        </div>
      </CrmSectionCard>

      <CrmSectionCard
        title="Quote Email Presets"
        description="These presets appear in the quote send and review screens. Keys stay fixed so existing drafts keep working."
      >
        <div className="grid gap-4">
          {props.value.template_presets.map((preset) => (
            <div
              key={preset.key}
              className="grid gap-3 border-t border-[color:var(--crm-ui-line)] pt-4 first:border-t-0 first:pt-0"
            >
              <div className="ace-crm-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--crm-ui-muted)]">
                {preset.key}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <CrmField label="Preset label">
                  <input
                    value={preset.label}
                    onChange={(event) =>
                      patchTemplatePreset(preset.key, { label: event.target.value })
                    }
                    className={inputClassName}
                  />
                </CrmField>
                <CrmField label="Default subject">
                  <input
                    value={preset.subject}
                    onChange={(event) =>
                      patchTemplatePreset(preset.key, { subject: event.target.value })
                    }
                    className={inputClassName}
                  />
                </CrmField>
              </div>
              <TermsTextarea
                label="Default message"
                value={preset.body}
                rows={4}
                onChange={(value) => patchTemplatePreset(preset.key, { body: value })}
              />
            </div>
          ))}
        </div>
      </CrmSectionCard>

      <CrmSectionCard
        title="Customer Terms Sections"
        description="These boxes become the two customer-facing pages after the quote page."
      >
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
          <div className="grid content-start gap-3">
            <TermsTextarea
              label="Our Process & What to Expect"
              value={props.value.terms_sections.our_process}
              rows={16}
              onChange={(value) => patchTerms({ our_process: value })}
            />
            <TermsTextarea
              label="Project Terms"
              value={props.value.terms_sections.project_terms}
              rows={16}
              onChange={(value) => patchTerms({ project_terms: value })}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="ace-crm-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--crm-ui-muted)]">
                Customer preview
              </div>
              <CrmField label="Preview terms font size">
                <input
                  type="number"
                  min={11}
                  max={18}
                  step={0.2}
                  value={previewTermsFontSize}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    if (Number.isFinite(next)) {
                      setPreviewTermsFontSize(Math.min(18, Math.max(11, next)))
                    }
                  }}
                  className="ace-crm-input w-24 text-sm"
                />
              </CrmField>
            </div>
            <div className="grid gap-2 rounded-lg border border-[color:var(--crm-ui-line)] bg-white/80 p-3">
              {termsPages.map((page, index) => {
                const key = `${page.title}:${index}`
                const overflowPx = termsPageOverflow[key] ?? 0
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-3 text-xs text-[color:var(--crm-ui-muted)]"
                  >
                    <span className="font-semibold text-[color:var(--crm-ui-ink)]">
                      {page.title}
                    </span>
                    <span>{overflowPx ? `Over by ${overflowPx}px` : 'Fits on one page'}</span>
                  </div>
                )
              })}
            </div>
            <div className="max-h-[900px] overflow-auto rounded-lg border border-[color:var(--crm-ui-line)] bg-[#f3f3f3]">
              <CustomerEstimateDocumentView
                document={previewDocument}
                showShell={false}
                showOverflowWarnings
                termsFontSize={previewTermsFontSize}
                onTermsPageOverflowChange={recordTermsPageOverflow}
              />
            </div>
          </div>
        </div>
      </CrmSectionCard>

      <CrmFormActions>
        <p className="text-xs text-[color:var(--crm-ui-muted)]">
          Stage email templates stay editable in the dedicated email templates screen.
        </p>
        <CrmButton type="button" onClick={props.onSave} disabled={!props.canSave} tone="primary">
          <span>{props.saving ? 'Saving...' : 'Save defaults'}</span>
        </CrmButton>
      </CrmFormActions>
    </div>
  )
}
