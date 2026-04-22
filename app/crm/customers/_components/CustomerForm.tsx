'use client'

import { useCallback, useMemo } from 'react'
import { CrmButton } from '@/app/crm/_components/CrmButton'
import { CrmField } from '@/app/crm/_components/CrmField'
import { CrmFormActions } from '@/app/crm/_components/CrmFormActions'
import { CrmNotice } from '@/app/crm/_components/CrmNotice'
import { useAsyncSubmitState } from '@/app/crm/_hooks/useAsyncSubmitState'
import {
  normalizeCustomerFormValues,
  type CustomerFormValues,
  type CustomerLegacyAddressCleanup,
} from '@/lib/customers/forms'

type CustomerFormProps = {
  initialValues?: Partial<CustomerFormValues>
  onSubmit: (payload: CustomerFormValues) => Promise<void>
  submitLabel: string
  submittingLabel: string
  cancelLabel?: string
  onCancel?: () => void
  legacyAddressCleanup?: CustomerLegacyAddressCleanup | null
}

export function CustomerForm({
  initialValues,
  onSubmit,
  submitLabel,
  submittingLabel,
  cancelLabel = 'Cancel',
  onCancel,
  legacyAddressCleanup = null,
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
  const normalizedInitialValues = useMemo(
    () => normalizeCustomerFormValues(initialValues),
    [initialValues]
  )
  const prepareSubmit = useCallback((values: CustomerFormValues) => {
    if (!values.name.trim()) {
      return { ok: false as const, error: 'Name is required.' }
    }

    if (
      legacyAddressCleanup?.needsCleanup &&
      (!values.street.trim() || !values.city.trim() || !values.state.trim() || !values.zip.trim())
    ) {
      return {
        ok: false as const,
        error: 'Enter street, city, state, and ZIP to replace the legacy address.',
      }
    }

    return {
      ok: true as const,
      payload: {
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email.trim(),
        street: values.street.trim(),
        city: values.city.trim(),
        state: values.state.trim(),
        zip: values.zip.trim(),
      },
    }
  }, [legacyAddressCleanup])
  const {
    values,
    setValues,
    saving,
    error,
    submit,
  } = useAsyncSubmitState<CustomerFormValues, CustomerFormValues>({
    initialValues: normalizedInitialValues,
    prepareSubmit,
    onSubmit,
    getErrorMessage: (submitError: unknown) =>
      submitError instanceof Error ? submitError.message : 'Failed to save customer.',
  })

  function updateField<K extends keyof CustomerFormValues>(field: K, value: CustomerFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    await submit()
  }

  return (
    <>
      {error ? <CrmNotice tone="error" compact>{error}</CrmNotice> : null}
      {legacyAddressCleanup && (
        <CrmNotice tone="warning" title="Legacy address needs cleanup" compact>
          <div>{legacyAddressCleanup.warning}</div>
          <div className="mt-2 text-xs">
            Current stored address: {legacyAddressCleanup.legacyAddress}
          </div>
        </CrmNotice>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4">
        <CrmField label="Name *">
          <input
            id={fieldId.name}
            className="ace-crm-input text-sm"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </CrmField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CrmField label="Phone">
            <input
              id={fieldId.phone}
              className="ace-crm-input text-sm"
              value={values.phone}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </CrmField>
          <CrmField label="Email">
            <input
              id={fieldId.email}
              className="ace-crm-input text-sm"
              value={values.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </CrmField>
        </div>

        <CrmField label="Street">
          <input
            id={fieldId.street}
            className="ace-crm-input text-sm"
            value={values.street}
            onChange={(event) => updateField('street', event.target.value)}
          />
        </CrmField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CrmField label="City">
            <input
              id={fieldId.city}
              className="ace-crm-input text-sm"
              value={values.city}
              onChange={(event) => updateField('city', event.target.value)}
            />
          </CrmField>
          <CrmField label="State">
            <input
              id={fieldId.state}
              className="ace-crm-input text-sm"
              value={values.state}
              onChange={(event) => updateField('state', event.target.value)}
            />
          </CrmField>
          <CrmField label="ZIP">
            <input
              id={fieldId.zip}
              className="ace-crm-input text-sm"
              value={values.zip}
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
