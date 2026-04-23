'use client'

import { useMemo, type Dispatch, type SetStateAction } from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import { loadQuoteProducts } from '@/lib/quotes/client'
import type { QuoteProductQuery, QuoteProductRow } from '@/lib/quotes/productsForm'

const emptyProductRows: QuoteProductRow[] = []

type Options = {
  query: QuoteProductQuery
}

export type QuoteProductsResourceAdapter = {
  data: QuoteProductRow[]
  setData: Dispatch<SetStateAction<QuoteProductRow[]>>
  loading: boolean
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>
  refresh: () => Promise<boolean>
  attemptRefresh: (options?: {
    preserveDataOnError?: boolean
    reportError?: boolean
  }) => Promise<{
    ok: boolean
    error: string | null
    data: QuoteProductRow[] | null
  }>
  allKnownData?: QuoteProductRow[]
  setAllKnownData?: Dispatch<SetStateAction<QuoteProductRow[]>>
}

export function useQuoteProductsData({ query }: Options) {
  const reloadKey = useMemo(
    () => JSON.stringify(query),
    [query]
  )

  return useResource<QuoteProductRow[]>({
    initialData: emptyProductRows,
    load: () => loadQuoteProducts<QuoteProductRow[]>(query),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote products.',
    reloadKey,
    resetOnError: false,
  }) as QuoteProductsResourceAdapter
}
