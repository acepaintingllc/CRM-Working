'use client'

import { useCallback, useState } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { authedFetch } from '@/lib/auth/authedFetch'
import type { CustomerDetail } from '@/lib/customers/types'
import { readJsonResponse } from '../_lib/http'

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

      const response = await authedFetch(`/api/customers/${id}`, { cache: 'no-store' })
      const payload = await readJsonResponse<{ customer?: CustomerDetail; error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload?.error ?? response.statusText)
      }

      return payload?.customer ?? null
    },
    getErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Failed to load customer.',
    reloadKey: id,
  })

  const loadCustomer = customerResource.refresh
  const error = actionError ?? customerResource.error
  const setError = useCallback(
    (value: string | null) => {
      setActionError(value)
      if (value) return
      customerResource.setError(null)
    },
    [customerResource.setError]
  )

  const deleteCustomer = useCallback(async () => {
    if (typeof id !== 'string' || !id) {
      setActionError('Missing customer id in URL.')
      return false
    }

    setActionError(null)
    try {
      const response = await authedFetch(`/api/customers/${id}`, { method: 'DELETE' })
      const payload = await readJsonResponse<{ error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload?.error ?? response.statusText)
      }

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
