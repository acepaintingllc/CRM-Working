'use client'

import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import type {
  CustomerFormValues,
  CustomerLegacyAddressCleanup,
} from '@/lib/customers/forms'

type CustomerFormProps = {
  value: CustomerFormValues
  onChange: (next: CustomerFormValues) => void
  onSubmit?: () => void
  submitLabel?: string
  submittingLabel?: string
  cancelLabel?: string
  onCancel?: () => void
  legacyAddressCleanup?: CustomerLegacyAddressCleanup | null
  saving?: boolean
  error?: string | null
  notice?: string | null
  validationError?: string | null
}

export function CustomerForm({
  value,
  onChange,
  onSubmit,
  submitLabel = 'Save changes',
  submittingLabel = 'Saving...',
  cancelLabel = 'Cancel',
  onCancel,
  legacyAddressCleanup = null,
  saving = false,
  error = null,
  notice = null,
  validationError = null,
}: CustomerFormProps) {
  const fieldId = {
    name: 'customer-name',
    phone: 'customer-phone',
    email: 'customer-email',
    street: 'customer-street',
    city: 'customer-city',
    state: 'customer-state',
    zip: 'customer-zip',
  }

  function updateField<K extends keyof CustomerFormValues>(field: K, nextValue: CustomerFormValues[K]) {
    onChange({ ...value, [field]: nextValue })
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onSubmit?.()
  }

  return (
    <>
      {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}
      {notice ? <CrmNotice tone="success" compact>{notice}</CrmNotice> : null}
      {validationError ? <CrmNotice tone="info" compact>{validationError}</CrmNotice> : null}
      {legacyAddressCleanup ? (
        <CrmNotice tone="warning" title="Legacy address needs cleanup" compact>
          <div>{legacyAddressCleanup.warning}</div>
          <div className="mt-2 text-xs">
            Current stored address: {legacyAddressCleanup.legacyAddress}
          </div>
        </CrmNotice>
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <CrmField label="Name *">
          <input
            id={fieldId.name}
            className="ace-crm-input text-sm"
            value={value.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </CrmField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CrmField label="Phone">
            <input
              id={fieldId.phone}
              className="ace-crm-input text-sm"
              value={value.phone}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </CrmField>
          <CrmField label="Email">
            <input
              id={fieldId.email}
              className="ace-crm-input text-sm"
              value={value.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </CrmField>
        </div>

        <CrmField label="Street">
          <input
            id={fieldId.street}
            className="ace-crm-input text-sm"
            value={value.street}
            onChange={(event) => updateField('street', event.target.value)}
          />
        </CrmField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CrmField label="City">
            <input
              id={fieldId.city}
              className="ace-crm-input text-sm"
              value={value.city}
              onChange={(event) => updateField('city', event.target.value)}
            />
          </CrmField>
          <CrmField label="State">
            <input
              id={fieldId.state}
              className="ace-crm-input text-sm"
              value={value.state}
              onChange={(event) => updateField('state', event.target.value)}
            />
          </CrmField>
          <CrmField label="ZIP">
            <input
              id={fieldId.zip}
              className="ace-crm-input text-sm"
              value={value.zip}
              onChange={(event) => updateField('zip', event.target.value)}
            />
          </CrmField>
        </div>

        <CrmFormActions>
          <div className="text-xs text-[color:var(--crm-ui-muted)]">
            Customer identity and address fields follow the shared CRM form system.
          </div>
          <div className="flex flex-wrap gap-2">
            <CrmButton type="submit" disabled={saving} tone="primary">
              <span>{saving ? submittingLabel : submitLabel}</span>
            </CrmButton>
            {onCancel ? (
              <CrmButton type="button" onClick={onCancel}>
                <span>{cancelLabel}</span>
              </CrmButton>
            ) : null}
          </div>
        </CrmFormActions>
      </form>
    </>
  )
}
