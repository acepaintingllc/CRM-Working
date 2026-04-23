'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  QUOTE_PRODUCT_FAMILIES,
  type ProductFamily,
  type QuoteProductQuery,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'

export function useQuoteProductsQueryState() {
  const [activeFamily, setActiveFamilyState] = useState<ProductFamily>(QUOTE_PRODUCT_FAMILIES[0])
  const [statusFilter, setStatusFilterState] = useState<QuoteProductStatusFilter>('all')
  const [search, setSearchState] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [search])

  const query = useMemo<QuoteProductQuery>(
    () => ({
      status: statusFilter,
      family: activeFamily,
      search: debouncedSearch || null,
    }),
    [activeFamily, debouncedSearch, statusFilter]
  )

  function resetVisibleFilters(nextFamily: ProductFamily) {
    setActiveFamilyState(nextFamily)
    setStatusFilterState('all')
    setSearchState('')
    setDebouncedSearch('')
  }

  return {
    activeFamily,
    statusFilter,
    search,
    query,
    setActiveFamilyState,
    setStatusFilterState,
    setSearchState,
    resetVisibleFilters,
  }
}
