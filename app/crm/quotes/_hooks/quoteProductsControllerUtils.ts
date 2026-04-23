'use client'

import { quoteProductMatchesQuery, type QuoteProductQuery, type QuoteProductRow } from '@/lib/quotes/productsForm'

export function removeProductFromVisibleSlice(products: QuoteProductRow[], productId: string) {
  return products.filter((product) => product.id !== productId)
}

export function upsertProductIntoVisibleSlice(
  products: QuoteProductRow[],
  updated: QuoteProductRow,
  query: QuoteProductQuery,
  previousId?: string
) {
  const nextProducts = products.filter((product) => product.id !== updated.id && product.id !== previousId)
  if (!quoteProductMatchesQuery(updated, query)) {
    return nextProducts
  }
  return [updated, ...nextProducts]
}
