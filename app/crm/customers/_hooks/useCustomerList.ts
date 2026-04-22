'use client'

import { useSwrResource } from '@/app/crm/_hooks/useSwrResource'
import type { CustomerSummary } from '@/lib/customers/types'

const emptyCustomerList: CustomerSummary[] = []
const customerListKey = '/api/customers'

export function useCustomerList() {
  const listResource = useSwrResource<CustomerSummary[]>(customerListKey, {
    fallbackData: emptyCustomerList,
  })

  return {
    listCustomers: listResource.data ?? emptyCustomerList,
    listLoading: listResource.loading,
    listError: listResource.error,
    loadList: listResource.refresh,
  }
}
