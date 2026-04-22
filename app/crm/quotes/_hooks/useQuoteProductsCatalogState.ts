'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  QUOTE_PRODUCT_FAMILIES,
  normalizeQuoteProductStatusFilter,
  type ProductFamily,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'

type Options = {
  products: QuoteProductRow[]
}

export function useQuoteProductsCatalogState({ products }: Options) {
  const [activeFamily, setActiveFamily] = useState<ProductFamily>(QUOTE_PRODUCT_FAMILIES[0])
  const [statusFilter, setStatusFilter] = useState<QuoteProductStatusFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return products.filter((product) => {
      if (product.family !== activeFamily) return false
      if (statusFilter !== 'all') {
        const normalizedStatus = product.status.toLowerCase()
        if (normalizedStatus !== statusFilter) return false
      }
      if (!query) return true
      const haystack =
        `${product.name} ${product.base ?? ''} ${product.subtype ?? ''} ${product.notes ?? ''} ${product.status}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [activeFamily, products, search, statusFilter])

  const selected = useMemo(() => {
    return filtered.find((product) => product.id === selectedId) ?? filtered[0] ?? null
  }, [filtered, selectedId])

  useEffect(() => {
    if (!selected) {
      setSelectedId(null)
      return
    }
    if (selected.id !== selectedId) {
      setSelectedId(selected.id)
    }
  }, [selected, selectedId])

  function selectProduct(id: string | null) {
    setSelectedId(id)
  }

  return {
    activeFamily,
    setActiveFamily,
    statusFilter,
    setStatusFilter: (next: string) =>
      setStatusFilter(normalizeQuoteProductStatusFilter(next, 'all')),
    selectedId,
    setSelectedId: selectProduct,
    search,
    setSearch,
    filtered,
    selected,
  }
}
