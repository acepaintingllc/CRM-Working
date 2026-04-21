'use client'

import { useCallback, useMemo } from 'react'
import { Save, X } from 'lucide-react'
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
      {error && <div className="text-red-600">{error}</div>}
      {legacyAddressCleanup && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-semibold">Legacy address needs cleanup</div>
          <div className="mt-1">{legacyAddressCleanup.warning}</div>
          <div className="mt-2 text-xs text-amber-800">
            Current stored address: {legacyAddressCleanup.legacyAddress}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor={fieldId.name} className="text-sm">Name *</label>
          <input
            id={fieldId.name}
            className="border rounded-md w-full p-2"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={fieldId.phone} className="text-sm">Phone</label>
            <input
              id={fieldId.phone}
              className="border rounded-md w-full p-2"
              value={values.phone}
              onChange={(event) => updateField('phone', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={fieldId.email} className="text-sm">Email</label>
            <input
              id={fieldId.email}
              className="border rounded-md w-full p-2"
              value={values.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
          </div>
        </div>

        <div>
          <label htmlFor={fieldId.street} className="text-sm">Street</label>
          <input
            id={fieldId.street}
            className="border rounded-md w-full p-2"
            value={values.street}
            onChange={(event) => updateField('street', event.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor={fieldId.city} className="text-sm">City</label>
            <input
              id={fieldId.city}
              className="border rounded-md w-full p-2"
              value={values.city}
              onChange={(event) => updateField('city', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={fieldId.state} className="text-sm">State</label>
            <input
              id={fieldId.state}
              className="border rounded-md w-full p-2"
              value={values.state}
              onChange={(event) => updateField('state', event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={fieldId.zip} className="text-sm">ZIP</label>
            <input
              id={fieldId.zip}
              className="border rounded-md w-full p-2"
              value={values.zip}
              onChange={(event) => updateField('zip', event.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-black text-white px-3 py-2 text-sm disabled:opacity-50 inline-flex items-center gap-2"
          >
            <Save size={16} aria-hidden="true" />
            <span>{saving ? submittingLabel : submitLabel}</span>
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm inline-flex items-center gap-2"
            >
              <X size={16} aria-hidden="true" />
              <span>{cancelLabel}</span>
            </button>
          )}
        </div>
      </form>
    </>
  )
}
