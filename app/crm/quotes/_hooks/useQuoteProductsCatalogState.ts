'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  QUOTE_PRODUCT_FAMILIES,
  normalizeQuoteProductStatusFilter,
  type ProductFamily,
  type QuoteProductQuery,
  type QuoteProductRow,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'

export function useQuoteProductsQueryState() {
  const [activeFamily, setActiveFamily] = useState<ProductFamily>(QUOTE_PRODUCT_FAMILIES[0])
  const [statusFilter, setStatusFilter] = useState<QuoteProductStatusFilter>('all')
  const [search, setSearch] = useState('')
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

  return {
    activeFamily,
    setActiveFamily,
    statusFilter,
    setStatusFilter: (next: string) =>
      setStatusFilter(normalizeQuoteProductStatusFilter(next, 'all')),
    search,
    setSearch,
    debouncedSearch,
    query,
  }
}

type SelectionOptions = {
  products: QuoteProductRow[]
}

export function useQuoteProductsSelectionState({ products }: SelectionOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorSelected, setEditorSelected] = useState<QuoteProductRow | null>(null)

  const selected = useMemo(() => {
    if (!selectedId) return null
    return products.find((product) => product.id === selectedId) ?? null
  }, [products, selectedId])

  useEffect(() => {
    if (!selectedId) {
      const fallback = products[0] ?? null
      if (!fallback) {
        setEditorSelected(null)
        return
      }
      setSelectedId(fallback.id)
      setEditorSelected(fallback)
      return
    }

    if (selected) {
      setEditorSelected(selected)
    }
  }, [products, selected, selectedId])

  return {
    products,
    selectedId,
    setSelectedId,
    selected,
    editorSelected,
  }
}
