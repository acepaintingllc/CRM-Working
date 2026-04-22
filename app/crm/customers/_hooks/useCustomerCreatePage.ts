'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { invalidateSwrPrefix } from '@/app/crm/_hooks/swrCache'
import { createCustomer } from '@/lib/customers/client'
import {
  normalizeCustomerFormValues,
  validateCustomerFormValues,
  type CustomerFormValues,
} from '@/lib/customers/forms'
import type { CreateCustomerInput } from '@/lib/customers/types'

export function useCustomerCreatePage() {
  const router = useRouter()
  const [value, setValue] = useState<CustomerFormValues>(() => normalizeCustomerFormValues())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const validationError = useMemo(() => {
    const result = validateCustomerFormValues(value, null)
    return result.ok ? null : result.error
  }, [value])

  const canSave = !saving && !validationError

  const save = async () => {
    setError(null)
    setNotice(null)
    const validated = validateCustomerFormValues(value, null)
    if (!validated.ok) {
      setError(validated.error)
      return false
    }

    setSaving(true)
    try {
      const payload: CreateCustomerInput = {
        name: validated.value.name,
        phone: validated.value.phone || null,
        email: validated.value.email || null,
        street: validated.value.street || null,
        city: validated.value.city || null,
        state: validated.value.state || null,
        zip: validated.value.zip || null,
        notes: null,
      }
      const result = await createCustomer(payload)
      await invalidateSwrPrefix('/api/customers')
      setNotice(result.notice ?? 'Customer created.')
      router.push(result.data?.id ? `/crm/customers/${result.data.id}` : '/crm/customers')
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save customer.')
      return false
    } finally {
      setSaving(false)
    }
  }

  return {
    value,
    setValue,
    saving,
    error,
    notice,
    validationError: error ? null : validationError,
    canSave,
    save,
  }
}
