'use client'

import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { authedFetch } from '@/lib/auth/authedFetch'
import type { CustomerSummary } from '@/lib/customers/types'
import { readJsonResponse } from '../_lib/http'

const emptyCustomerList: CustomerSummary[] = []

export function useCustomerList() {
  const listResource = useLoadableResource<CustomerSummary[]>({
    initialData: emptyCustomerList,
    load: async () => {
      const response = await authedFetch('/api/customers', { cache: 'no-store' })
      const payload = await readJsonResponse<{ customers?: CustomerSummary[]; error?: string }>(response)

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Failed to load customers.')
      }

      return payload?.customers ?? []
    },
    getErrorMessage: (error: unknown) =>
      error instanceof Error ? error.message : 'Failed to load customers.',
    reloadKey: 'customers',
  })

  return {
    listCustomers: listResource.data,
    listLoading: listResource.loading,
    listError: listResource.error,
    loadList: listResource.refresh,
  }
}
