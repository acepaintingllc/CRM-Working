'use client'

import { useEffect, useMemo, useState } from 'react'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'

type Options = {
  products: QuoteProductRow[]
}

export function useQuoteProductsSelectionState({ products }: Options) {
  const [selectedId, setSelectedIdState] = useState<string | null>(null)
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

      setSelectedIdState(fallback.id)
      setEditorSelected(fallback)
      return
    }

    if (selected) {
      setEditorSelected(selected)
    }
  }, [products, selected, selectedId])

  return {
    selectedId,
    selected,
    editorSelected,
    setSelectedIdState,
    setEditorSelected,
  }
}
