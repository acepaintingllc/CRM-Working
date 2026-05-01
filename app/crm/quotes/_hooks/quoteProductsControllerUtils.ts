'use client'

import {
  quoteProductMatchesQuery,
  type ProductFamily,
  type QuoteProductQuery,
  type QuoteProductRow,
  type QuoteProductScopeFilter,
  type QuoteProductStatusFilter,
} from '@/lib/quotes/productsForm'

type QuoteProductsNavigationState = {
  activeFamily: ProductFamily
  statusFilter: QuoteProductStatusFilter
  scopeFilter: QuoteProductScopeFilter
  search: string
  debouncedSearch: string
}

type QuoteProductsResourcePatch = {
  visibleRows: QuoteProductRow[]
  knownRows: QuoteProductRow[]
}

function buildQuoteProductsMutationQuery(
  navigation: QuoteProductsNavigationState
): QuoteProductQuery {
  return {
    family: navigation.activeFamily,
    status: navigation.statusFilter,
    ...(navigation.scopeFilter === 'all' ? {} : { scope: navigation.scopeFilter }),
    search: navigation.debouncedSearch || null,
  }
}

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

export function buildCreatedQuoteProductResourcePatch(params: {
  knownRows: QuoteProductRow[]
  createdRow: QuoteProductRow
  navigation: QuoteProductsNavigationState
}): QuoteProductsResourcePatch & {
  navigation: QuoteProductsNavigationState
} {
  const nextNavigation = {
    activeFamily: params.navigation.activeFamily,
    statusFilter: 'all' as const,
    scopeFilter: 'all' as const,
    search: '',
    debouncedSearch: '',
  }
  const postCreateQuery = buildQuoteProductsMutationQuery(nextNavigation)
  const nextKnownRows = mergeKnownQuoteProducts(params.knownRows, [params.createdRow])
  const nextVisibleRows = [
    params.createdRow,
    ...nextKnownRows.filter(
      (product) =>
        product.id !== params.createdRow.id && quoteProductMatchesQuery(product, postCreateQuery)
    ),
  ]

  return {
    visibleRows: nextVisibleRows,
    knownRows: nextKnownRows,
    navigation: nextNavigation,
  }
}

export function buildUpdatedQuoteProductResourcePatch(params: {
  visibleRows: QuoteProductRow[]
  knownRows: QuoteProductRow[]
  updatedRow: QuoteProductRow
  navigation: QuoteProductsNavigationState
  previousId: string
}): QuoteProductsResourcePatch {
  return {
    visibleRows: upsertProductIntoVisibleSlice(
      params.visibleRows,
      params.updatedRow,
      buildQuoteProductsMutationQuery(params.navigation),
      params.previousId
    ),
    knownRows: mergeKnownQuoteProducts(
      removeProductFromVisibleSlice(params.knownRows, params.previousId),
      [params.updatedRow]
    ),
  }
}

export function buildArchivedQuoteProductResourcePatch(params: {
  visibleRows: QuoteProductRow[]
  knownRows: QuoteProductRow[]
  archivedRow: QuoteProductRow
  navigation: QuoteProductsNavigationState
  archivedId: string
}): QuoteProductsResourcePatch {
  return {
    visibleRows: upsertProductIntoVisibleSlice(
      params.visibleRows,
      params.archivedRow,
      buildQuoteProductsMutationQuery(params.navigation),
      params.archivedId
    ),
    knownRows: mergeKnownQuoteProducts(params.knownRows, [params.archivedRow]),
  }
}

