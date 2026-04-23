'use client'

import { quoteProductMatchesQuery, type QuoteProductQuery, type QuoteProductRow } from '@/lib/quotes/productsForm'

export function upsertProductIntoVisibleSlice(
  current: QuoteProductRow[],
  nextProduct: QuoteProductRow,
  query: QuoteProductQuery,
  previousId?: string
) {
  const matchesQuery = quoteProductMatchesQuery(nextProduct, query)
  if (matchesQuery) {
    const targetId = previousId ?? nextProduct.id
    const hasExisting = current.some((product) => product.id === targetId)
    if (hasExisting) {
      return current.map((product) => (product.id === targetId ? nextProduct : product))
    }

    return [nextProduct, ...current]
  }

  return current.filter((product) => product.id !== (previousId ?? nextProduct.id))
}

export function removeProductFromVisibleSlice(current: QuoteProductRow[], id: string) {
  return current.filter((product) => product.id !== id)
}

