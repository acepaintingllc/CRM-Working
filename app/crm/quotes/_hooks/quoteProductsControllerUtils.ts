'use client'

import {
  quoteProductMatchesQuery,
  type QuoteProductQuery,
  type QuoteProductRow,
} from '@/lib/quotes/productsForm'

export function mergeKnownQuoteProducts(
  current: QuoteProductRow[],
  incoming: QuoteProductRow[]
) {
  if (incoming.length === 0) return current

  const merged = new Map<string, QuoteProductRow>()
  for (const product of current) {
    merged.set(product.id, product)
  }
  for (const product of incoming) {
    merged.set(product.id, product)
  }

  return [...merged.values()]
}

export function findQuoteProductById(
  current: QuoteProductRow[],
  id: string | null | undefined
) {
  if (!id) return null
  return current.find((product) => product.id === id) ?? null
}

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

export function chooseQuoteProductsFallbackId(current: QuoteProductRow[]) {
  return current[0]?.id ?? null
}

