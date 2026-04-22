import type { QuoteSendDefaults } from '@/lib/settings/types'
import { templatePresets } from '@/lib/customer-estimates/presets'
import { SettingsField } from './SettingsField'
import { SettingsNotice } from './SettingsNotice'
import { SettingsSectionCard } from './SettingsSectionCard'

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

export function QuoteSendDefaultsForm(props: QuoteSendDefaultsFormProps) {
  return (
    <SettingsSectionCard
      title="Quote Send Defaults"
      description="These defaults drive the quote send and review flow without rewriting unrelated estimate settings."
    >
      {props.error ? <SettingsNotice tone="error">{props.error}</SettingsNotice> : null}
      {props.notice ? <SettingsNotice tone="success">{props.notice}</SettingsNotice> : null}
      {props.validationError ? <SettingsNotice tone="info">{props.validationError}</SettingsNotice> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <SettingsField label="Default template preset" help="Used when opening the quote send page.">
          <select
            value={props.value.default_template_key}
            onChange={(event) => props.onChange({ default_template_key: event.target.value })}
            className={inputClassName}
          >
            {templatePresets.map((preset) => (
              <option key={preset.key} value={preset.key}>
                {preset.label}
              </option>
            ))}
          </select>
        </SettingsField>

        <SettingsField label="Quote validity days" help="Rendered on the customer terms page.">
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
        </SettingsField>
      </div>

      <SettingsField
        label="Terms and conditions"
        help="Use one paragraph per term. The customer quote view formats this into a clean terms section."
      >
        <textarea
          value={props.value.terms_text}
          onChange={(event) => props.onChange({ terms_text: event.target.value })}
          rows={10}
          className={`${inputClassName} min-h-48 resize-y`}
        />
      </SettingsField>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[color:var(--crm-ui-muted)]">
          Email templates stay editable in the dedicated email templates screen.
        </p>
        <button
          type="button"
          onClick={props.onSave}
          disabled={!props.canSave}
          className="ace-crm-btn ace-crm-btn-primary"
        >
          <span>{props.saving ? 'Saving...' : 'Save defaults'}</span>
        </button>
      </div>
    </SettingsSectionCard>
  )
}
