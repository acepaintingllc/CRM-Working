'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSwrResource } from '@/app/crm/_hooks/useSwrResource'
import { loadCustomerList } from '@/lib/customers/client'
import type { CustomerListPage } from '@/lib/customers/types'

const emptyCustomerListPage: CustomerListPage = {
  data: [],
  total: 0,
  page: 1,
  pageSize: 50,
}

type UseCustomerListOptions = {
  initialSearch?: string
  initialPage?: number
}

function normalizePage(value: number | undefined) {
  return Math.max(1, Math.trunc(value ?? 1) || 1)
}

export function useCustomerList(options: UseCustomerListOptions = {}) {
  const [search, setSearchState] = useState(options.initialSearch ?? '')
  const [page, setPageState] = useState(() => normalizePage(options.initialPage))

  useEffect(() => {
    setSearchState(options.initialSearch ?? '')
  }, [options.initialSearch])

  useEffect(() => {
    setPageState(normalizePage(options.initialPage))
  }, [options.initialPage])

  const customerListKey = useMemo(() => {
    const params = new URLSearchParams()
    const trimmedSearch = search.trim()

    if (trimmedSearch) params.set('search', trimmedSearch)
    if (page > 1) params.set('page', String(page))

    const serialized = params.toString()
    return serialized ? `/api/customers?${serialized}` : '/api/customers'
  }, [page, search])

  const listResource = useSwrResource<CustomerListPage>(customerListKey, {
    fallbackData: emptyCustomerListPage,
    load: () => loadCustomerList({ search, page }),
  })

  const setSearch = useCallback((nextSearch: string) => {
    setSearchState(nextSearch)
    setPageState(1)
  }, [])

  const setPage = useCallback((nextPage: number) => {
    setPageState(normalizePage(nextPage))
  }, [])

  return {
    customers: listResource.data?.data ?? emptyCustomerListPage.data,
    total: listResource.data?.total ?? 0,
    page: listResource.data?.page ?? page,
    pageSize: listResource.data?.pageSize ?? emptyCustomerListPage.pageSize,
    search,
    setSearch,
    setPage,
    loading: listResource.loading,
    error: listResource.error,
    refresh: listResource.refresh,
  }
}
