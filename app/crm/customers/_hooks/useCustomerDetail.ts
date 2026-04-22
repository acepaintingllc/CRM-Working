'use client'

import { useCallback, useState } from 'react'
import { useSwrResource } from '@/app/crm/_hooks/useSwrResource'
import { invalidateSwrKey } from '@/app/crm/_hooks/swrCache'
import { deleteCustomer as deleteCustomerRequest } from '@/lib/customers/client'
import type { CustomerDetail } from '@/lib/customers/types'

const emptyCustomer = null

export function useCustomerDetail(id: string | undefined) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const customerKey = typeof id === 'string' && id ? `/api/customers/${id}` : null
  const customerResource = useSwrResource<CustomerDetail | null>(customerKey, {
    fallbackData: emptyCustomer,
  })

  const { refresh: loadCustomer, setError: setResourceError } = customerResource
  const error =
    actionError ??
    customerResource.error ??
    (customerKey ? null : 'Missing customer id in URL.')
  const setError = useCallback(
    (value: string | null) => {
      setActionError(value)
      if (value) return
      setResourceError(null)
    },
    [setResourceError]
  )

  const deleteCustomer = useCallback(async () => {
    if (typeof id !== 'string' || !id) {
      setActionError('Missing customer id in URL.')
      return false
    }

    setActionError(null)
    setDeleting(true)
    try {
      await deleteCustomerRequest(id)
      await Promise.all([
        invalidateSwrKey('/api/customers'),
        invalidateSwrKey(`/api/customers/${id}`),
      ])
      return true
    } catch (deleteError: unknown) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Unable to delete customer.')
      return false
    } finally {
      setDeleting(false)
    }
  }, [id])

  return {
    customer: customerResource.data ?? emptyCustomer,
    loading: customerResource.loading,
    deleting,
    error,
    setError,
    statusMessage,
    setStatusMessage,
    loadCustomer,
    deleteCustomer,
  }
}
