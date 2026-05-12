import type { QuoteSendDefaults } from '@/lib/settings/types'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'
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
        <div className="grid gap-3">
          <TermsTextarea
            label="Our Process & What to Expect"
            value={props.value.terms_sections.our_process}
            rows={10}
            onChange={(value) => patchTerms({ our_process: value })}
          />
          <TermsTextarea
            label="Project Terms"
            value={props.value.terms_sections.project_terms}
            rows={10}
            onChange={(value) => patchTerms({ project_terms: value })}
          />
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
