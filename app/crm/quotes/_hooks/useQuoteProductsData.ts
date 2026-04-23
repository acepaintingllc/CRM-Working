'use client'

import { useMemo } from 'react'
import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { loadQuoteProducts } from '@/lib/quotes/client'
import type { QuoteProductQuery, QuoteProductRow } from '@/lib/quotes/productsForm'

const emptyProductRows: QuoteProductRow[] = []

type Options = {
  query: QuoteProductQuery
}

export function useQuoteProductsData({ query }: Options) {
  const reloadKey = useMemo(
    () => JSON.stringify(query),
    [query.family, query.search, query.status]
  )

  return useLoadableResource<QuoteProductRow[]>({
    initialData: emptyProductRows,
    load: () => loadQuoteProducts<QuoteProductRow[]>(query),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote products.',
    reloadKey,
  })
}
