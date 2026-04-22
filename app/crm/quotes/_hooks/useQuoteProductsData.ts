'use client'

import { useLoadableResource } from '@/app/crm/_hooks/useLoadableResource'
import { loadQuoteProducts } from '@/lib/quotes/client'
import type { QuoteProductRow } from '@/lib/quotes/productsForm'

const emptyProductRows: QuoteProductRow[] = []

export function useQuoteProductsData() {
  return useLoadableResource<QuoteProductRow[]>({
    initialData: emptyProductRows,
    load: () => loadQuoteProducts<QuoteProductRow[]>({ status: 'all' }),
    getErrorMessage: (loadError: unknown) =>
      loadError instanceof Error ? loadError.message : 'Failed to load quote products.',
  })
}
