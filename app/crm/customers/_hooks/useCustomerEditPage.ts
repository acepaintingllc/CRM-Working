'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEditableResource } from '@/app/crm/_hooks/useEditableResource'
import { invalidateSwrKey, invalidateSwrPrefix } from '@/app/crm/_hooks/swrCache'
import { safeReturnTo } from '@/lib/crm/navigation'
import {
  customerRecordToFormValues,
  normalizeCustomerFormValues,
  validateCustomerFormValues,
  type CustomerFormValues,
  type CustomerLegacyAddressCleanup,
} from '@/lib/customers/forms'
import { loadCustomerDetail, updateCustomer } from '@/lib/customers/client'
import type { UpdateCustomerInput } from '@/lib/customers/types'

type EditCustomerResource = {
  value: CustomerFormValues
  legacyAddressCleanup: CustomerLegacyAddressCleanup | null
}

const emptyEditCustomerResource: EditCustomerResource = {
  value: normalizeCustomerFormValues(),
  legacyAddressCleanup: null,
}

export function useCustomerEditPage() {
  const params = useParams()
  const rawId = (params as { id?: string } | null | undefined)?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  const router = useRouter()
  const searchParams = useSearchParams()
  const [redirectAfterSave, setRedirectAfterSave] = useState(false)
  const fallbackReturnTo = id ? `/crm/customers/${id}` : '/crm/customers'
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get('returnTo'), fallbackReturnTo),
    [fallbackReturnTo, searchParams]
  )

  const resource = useEditableResource({
    initialData: emptyEditCustomerResource,
    load: async () => {
      if (!id || typeof id !== 'string') {
        throw new Error('Missing customer id.')
      }

      const customer = await loadCustomerDetail(id)
      const formValues = customer ? customerRecordToFormValues(customer) : null
      if (formValues && !formValues.ok) {
        throw new Error(formValues.error)
      }

      return {
        value: formValues?.value.values ?? normalizeCustomerFormValues(),
        legacyAddressCleanup: formValues?.value.legacyAddressCleanup ?? null,
      }
    },
    save: async (current) => {
      if (!id || typeof id !== 'string') {
        throw new Error('Missing customer id.')
      }

      const validated = validateCustomerFormValues(current.value, current.legacyAddressCleanup)
      if (!validated.ok) {
        throw new Error(validated.error)
      }

      const payload: UpdateCustomerInput = {
        name: validated.value.name,
        phone: validated.value.phone || null,
        email: validated.value.email || null,
        street: validated.value.street || null,
        city: validated.value.city || null,
        state: validated.value.state || null,
        zip: validated.value.zip || null,
        notes: null,
      }

      const result = await updateCustomer(id, payload)
      await Promise.all([
        invalidateSwrPrefix('/api/customers'),
        invalidateSwrKey(`/api/customers/${id}`),
      ])

      return {
        data: {
          value: validated.value,
          legacyAddressCleanup: null,
        },
        notice: result.notice ?? 'Customer updated.',
      }
    },
    getErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Failed to save customer.',
  })

  const validationError = useMemo(() => {
    const result = validateCustomerFormValues(resource.data.value, resource.data.legacyAddressCleanup)
    return result.ok ? null : result.error
  }, [resource.data])

  const canSave =
    resource.hasLoaded && resource.dirty && !resource.saving && !validationError

  const setValue = useCallback(
    (next: CustomerFormValues) => {
      resource.setData((current) => ({ ...current, value: next }))
    },
    [resource]
  )

  const saveChanges = useCallback(async () => {
    const beforeError = validateCustomerFormValues(resource.data.value, resource.data.legacyAddressCleanup)
    if (!beforeError.ok) {
      setRedirectAfterSave(false)
      return false
    }

    await resource.saveChanges()
    return true
  }, [resource])

  useEffect(() => {
    if (!redirectAfterSave) return
    if (resource.saving) return
    if (resource.error) {
      setRedirectAfterSave(false)
      return
    }
    if (resource.notice) {
      setRedirectAfterSave(false)
      router.push(returnTo)
    }
  }, [redirectAfterSave, resource.saving, resource.error, resource.notice, returnTo, router])

  const saveAndNavigate = useCallback(async () => {
    setRedirectAfterSave(true)
    return saveChanges()
  }, [saveChanges])

  return {
    resource,
    validationError: resource.error ? null : validationError,
    canSave,
    returnTo,
    setValue,
    saveChanges,
    saveAndNavigate,
  }
}
