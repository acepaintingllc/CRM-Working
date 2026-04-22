import type { CompanyProfileSettings } from '@/lib/settings/types'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { CrmSectionCard } from '@/app/crm/_components/CrmSectionCard'

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
  'ace-crm-input text-sm'

export function CompanyProfileForm(props: CompanyProfileFormProps) {
  return (
    <CrmSectionCard
      title="Profile"
      description="Set the business identity and outbound defaults used in customer-facing CRM flows."
    >
      {props.error ? <CrmNotice tone="error" compact>{props.error}</CrmNotice> : null}
      {props.notice ? <CrmNotice tone="success" compact>{props.notice}</CrmNotice> : null}
      {props.validationError ? <CrmNotice tone="info" compact>{props.validationError}</CrmNotice> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <CrmField label="Business name">
          <input
            value={props.value.business_name}
            onChange={(event) => props.onChange({ business_name: event.target.value })}
            placeholder="ACE Painting"
            className={inputClassName}
          />
        </CrmField>

        <CrmField label="Timezone">
          <input
            value={props.value.timezone}
            onChange={(event) => props.onChange({ timezone: event.target.value })}
            placeholder="America/Chicago"
            className={inputClassName}
          />
        </CrmField>

        <CrmField label="Main phone">
          <input
            value={props.value.main_phone}
            onChange={(event) => props.onChange({ main_phone: event.target.value })}
            placeholder="(812) 555-1234"
            className={inputClassName}
          />
        </CrmField>

        <CrmField label="Business email">
          <input
            value={props.value.business_email}
            onChange={(event) => props.onChange({ business_email: event.target.value })}
            placeholder="hello@acepainting.com"
            className={inputClassName}
          />
        </CrmField>

        <CrmField label="Website">
          <input
            value={props.value.website}
            onChange={(event) => props.onChange({ website: event.target.value })}
            placeholder="https://acepainting.com"
            className={inputClassName}
          />
        </CrmField>

        <CrmField label="Logo URL">
          <input
            value={props.value.logo_url}
            onChange={(event) => props.onChange({ logo_url: event.target.value })}
            placeholder="https://..."
            className={inputClassName}
          />
        </CrmField>
      </div>

      <div className="grid gap-3">
        <CrmField label="Address">
          <input
            value={props.value.address}
            onChange={(event) => props.onChange({ address: event.target.value })}
            placeholder="123 Main St, Newburgh, IN 47630"
            className={inputClassName}
          />
        </CrmField>

        <CrmField
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
        </CrmField>
      </div>

      <CrmFormActions>
        <p className="text-xs text-[color:var(--crm-ui-muted)]">
          These fields are stored as canonical company profile settings.
        </p>
        <CrmButton type="button" onClick={props.onSave} disabled={!props.canSave} tone="primary">
          <span>{props.saving ? 'Saving...' : 'Save changes'}</span>
        </CrmButton>
      </CrmFormActions>
    </CrmSectionCard>
  )
}
