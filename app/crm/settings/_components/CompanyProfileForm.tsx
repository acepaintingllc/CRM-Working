import type { CompanyProfileSettings } from '@/lib/settings/types'
import { SettingsField } from './SettingsField'
import { SettingsNotice } from './SettingsNotice'
import { SettingsSectionCard } from './SettingsSectionCard'

type CompanyProfileFormProps = {
  value: CompanyProfileSettings
  onChange: (patch: Partial<CompanyProfileSettings>) => void
  onSave: () => void
  canSave: boolean
  saving: boolean
  error: string | null
  notice: string | null
  validationError: string | null
}

const inputClassName =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-slate-900/70 placeholder:text-slate-400 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100'

export function CompanyProfileForm(props: CompanyProfileFormProps) {
  return (
    <SettingsSectionCard
      title="Profile"
      description="Set the business identity and outbound defaults used in customer-facing CRM flows."
    >
      {props.error ? <SettingsNotice tone="error">{props.error}</SettingsNotice> : null}
      {props.notice ? <SettingsNotice tone="success">{props.notice}</SettingsNotice> : null}
      {props.validationError ? <SettingsNotice tone="info">{props.validationError}</SettingsNotice> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <SettingsField label="Business name">
          <input
            value={props.value.business_name}
            onChange={(event) => props.onChange({ business_name: event.target.value })}
            placeholder="ACE Painting"
            className={inputClassName}
          />
        </SettingsField>

        <SettingsField label="Timezone">
          <input
            value={props.value.timezone}
            onChange={(event) => props.onChange({ timezone: event.target.value })}
            placeholder="America/Chicago"
            className={inputClassName}
          />
        </SettingsField>

        <SettingsField label="Main phone">
          <input
            value={props.value.main_phone}
            onChange={(event) => props.onChange({ main_phone: event.target.value })}
            placeholder="(812) 555-1234"
            className={inputClassName}
          />
        </SettingsField>

        <SettingsField label="Business email">
          <input
            value={props.value.business_email}
            onChange={(event) => props.onChange({ business_email: event.target.value })}
            placeholder="hello@acepainting.com"
            className={inputClassName}
          />
        </SettingsField>

        <SettingsField label="Website">
          <input
            value={props.value.website}
            onChange={(event) => props.onChange({ website: event.target.value })}
            placeholder="https://acepainting.com"
            className={inputClassName}
          />
        </SettingsField>

        <SettingsField label="Logo URL">
          <input
            value={props.value.logo_url}
            onChange={(event) => props.onChange({ logo_url: event.target.value })}
            placeholder="https://..."
            className={inputClassName}
          />
        </SettingsField>
      </div>

      <div className="grid gap-3">
        <SettingsField label="Address">
          <input
            value={props.value.address}
            onChange={(event) => props.onChange({ address: event.target.value })}
            placeholder="123 Main St, Newburgh, IN 47630"
            className={inputClassName}
          />
        </SettingsField>

        <SettingsField
          label="Default sender signature"
          help="Used by customer-facing email flows that need a default signature."
        >
          <textarea
            value={props.value.sender_signature}
            onChange={(event) => props.onChange({ sender_signature: event.target.value })}
            placeholder={'Thanks,\nACE Painting Team'}
            rows={5}
            className={`${inputClassName} min-h-36 resize-y`}
          />
        </SettingsField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          These fields are stored as canonical company profile settings.
        </p>
        <button
          type="button"
          onClick={props.onSave}
          disabled={!props.canSave}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-900 bg-slate-900 px-3 text-sm font-semibold text-white transition hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{props.saving ? 'Saving...' : 'Save changes'}</span>
        </button>
      </div>
    </SettingsSectionCard>
  )
}
