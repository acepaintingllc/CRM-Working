'use client'

import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { loadCustomerList } from '@/lib/customers/client'
import type { CustomerSummary } from '@/lib/customers/types'

const emptyCustomerList: CustomerSummary[] = []

export function useCustomerList() {
  const listResource = useLoadableResource<CustomerSummary[]>({
    initialData: emptyCustomerList,
    load: loadCustomerList,
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
