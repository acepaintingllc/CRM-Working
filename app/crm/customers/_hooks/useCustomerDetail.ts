'use client'

import { useCallback, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { deleteCustomer as deleteCustomerRequest, loadCustomerDetail } from '@/lib/customers/client'
import type { CustomerDetail } from '@/lib/customers/types'

const emptyCustomer = null

export function useCustomerDetail(id: string | undefined) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const customerResource = useLoadableResource<CustomerDetail | null>({
    initialData: emptyCustomer,
    load: async () => {
      if (typeof id !== 'string' || !id) {
        throw new Error('Missing customer id in URL.')
      }

      return loadCustomerDetail(id)
    },
    getErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Failed to load customer.',
    reloadKey: id,
  })

  const { refresh: loadCustomer, setError: setResourceError } = customerResource
  const error = actionError ?? customerResource.error
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
      return true
    } catch (deleteError: unknown) {
      setActionError(deleteError instanceof Error ? deleteError.message : 'Unable to delete customer.')
      return false
    } finally {
      setDeleting(false)
    }
  }, [id])

  return {
    customer: customerResource.data,
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
