'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { invalidateSwrKey } from '@/app/crm/_hooks/swrCache'
import { loadCustomerList } from '@/lib/customers/client'
import { createJob } from '@/lib/jobs/client'
import {
  normalizeJobCreateValues,
  validateJobCreateValues,
  type JobCreateValues,
} from '@/lib/jobs/forms'
import { useJobCreateWorkflow } from '@/app/crm/jobs/_hooks/useJobCreateWorkflow'

export type CustomerOption = {
  id: string
  name: string
  address: string | null
  email: string | null
  phone: string | null
}

const emptyCustomerOptions: CustomerOption[] = []

function getLoadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Failed to load customers.'
}

export function useNewJobPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedCustomerId = searchParams.get('customerId')
  const [value, setValue] = useState<JobCreateValues>(() => normalizeJobCreateValues())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [createdJobId, setCreatedJobId] = useState<string | null>(null)
  const [debouncedCustomerQuery, setDebouncedCustomerQuery] = useState('')
  const [selectedCustomerSnapshot, setSelectedCustomerSnapshot] = useState<CustomerOption | null>(null)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedCustomerQuery(value.customerQuery.trim())
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [value.customerQuery])

  const customerResource = useLoadableResource<CustomerOption[]>({
    initialData: emptyCustomerOptions,
    load: async () => {
      const rows = await loadCustomerList({ search: debouncedCustomerQuery || undefined })
      const customers = Array.isArray(rows.data)
        ? rows.data
        : Array.isArray(rows)
          ? rows
          : []
      return customers.map((customer) => ({
        id: customer.id,
        name: customer.name ?? 'Unknown customer',
        address: customer.address ?? null,
        email: customer.email ?? null,
        phone: customer.phone ?? null,
      }))
    },
    getErrorMessage: getLoadErrorMessage,
    reloadKey: debouncedCustomerQuery,
  })

  const selectedCustomer = useMemo(
    () =>
      customerResource.data.find((customer) => customer.id === value.customerId) ??
      (selectedCustomerSnapshot?.id === value.customerId ? selectedCustomerSnapshot : null),
    [customerResource.data, selectedCustomerSnapshot, value.customerId]
  )

  useEffect(() => {
    const match = customerResource.data.find((customer) => customer.id === value.customerId) ?? null
    if (match) setSelectedCustomerSnapshot(match)
  }, [customerResource.data, value.customerId])

  useEffect(() => {
    if (!preselectedCustomerId || value.customerId) return
    const match = customerResource.data.find((customer) => customer.id === preselectedCustomerId)
    if (!match) return
    setSelectedCustomerSnapshot(match)
    setValue((current) => ({ ...current, customerId: match.id, customerQuery: '' }))
  }, [customerResource.data, preselectedCustomerId, value.customerId])

  const validationError = useMemo(() => {
    const result = validateJobCreateValues(value)
    return result.ok ? null : result.error
  }, [value])

  const canSave =
    customerResource.data.length > 0 && !customerResource.loading && !saving && !validationError

  const workflow = useJobCreateWorkflow({
    value,
    selectedCustomer,
    setValue,
    setError,
    setNotice,
  })

  const save = useCallback(async (options?: { sendEstimateScheduled?: boolean }) => {
    setError(null)
    setNotice(null)
    setCreatedJobId(null)
    const validated = validateJobCreateValues(value, {
      sendStage: options?.sendEstimateScheduled ? 'estimate_scheduled' : null,
      selectedCustomerEmail: selectedCustomer?.email ?? null,
    })
    if (!validated.ok) {
      setError(validated.error)
      return false
    }

    setSaving(true)
    try {
      const createdJob = await createJob({
        customer_id: validated.value.customerId,
        title: validated.value.title,
        description: validated.value.description,
        status: validated.value.status,
        estimate_date:
          validated.value.status === 'estimate_scheduled' ? validated.value.estimateIso : null,
        scheduled_date: validated.value.status === 'scheduled' ? validated.value.scheduledIso : null,
      })
      const createdId = createdJob?.id ?? null
      setCreatedJobId(createdId)

      await workflow.runPostCreateSideEffects({
        createdId,
        sendEstimateScheduled: options?.sendEstimateScheduled,
        validated: validated.value,
      })

      await invalidateSwrKey('/api/jobs')
      setNotice('Job created.')
      router.push(createdId ? `/crm/jobs/${createdId}` : '/crm/jobs')
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create job')
      workflow.setSendingStage(null)
      return false
    } finally {
      setSaving(false)
    }
  }, [router, selectedCustomer, value, workflow])

  return {
    customerResource,
    value,
    setValue,
    selectedCustomer,
    filteredCustomers: customerResource.data,
    saving,
    error,
    notice,
    createdJobId,
    composeLoading: workflow.composeLoading,
    sendingStage: workflow.sendingStage,
    validationError: error ? null : validationError,
    canSave,
    openComposer: workflow.openComposer,
    save,
  }
}
