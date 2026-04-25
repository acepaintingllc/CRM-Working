'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import { loadQuoteProducts } from '@/lib/quotes/client'
import type { QuoteProductQuery, QuoteProductRow } from '@/lib/quotes/productsForm'
import { mergeKnownQuoteProducts } from './quoteProductsControllerUtils'

const emptyProductRows: QuoteProductRow[] = []

type Options = {
  query: QuoteProductQuery
}

export type QuoteProductsResourceAdapter = {
  /**
   * Rows matching the current family/status/search query.
   *
   * This is intentionally separate from allKnownData so the editor can keep
   * working with a selected row after filters hide it from the catalog slice.
   */
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
  /**
   * Rows seen by prior loads or mutations. Keep this cache merged on success
   * and cleared only when an unpreserved load error owns the latest request.
   */
  allKnownData: QuoteProductRow[]
  setAllKnownData: Dispatch<SetStateAction<QuoteProductRow[]>>
}

type QuoteProductsResourceAttemptOptions = {
  preserveDataOnError?: boolean
  reportError?: boolean
}

type QuoteProductsResourceAttemptResult = {
  ok: boolean
  error: string | null
  data: QuoteProductRow[] | null
}

type KnownRowsResourceOptions = {
  query: QuoteProductQuery
  reloadKey: string
}

function getQuoteProductsLoadErrorMessage(loadError: unknown) {
  return loadError instanceof Error ? loadError.message : 'Failed to load quote products.'
}

function useKnownQuoteProductsResource({
  query,
  reloadKey,
}: KnownRowsResourceOptions): QuoteProductsResourceAdapter {
  const [allKnownData, setAllKnownDataState] = useState<QuoteProductRow[]>(emptyProductRows)

  const setAllKnownData: Dispatch<SetStateAction<QuoteProductRow[]>> = useCallback((nextState) => {
    setAllKnownDataState(nextState)
  }, [])

  const visibleRowsResource = useResource<QuoteProductRow[]>({
    initialData: emptyProductRows,
    load: () => loadQuoteProducts<QuoteProductRow[]>(query),
    getErrorMessage: getQuoteProductsLoadErrorMessage,
    skipInitialLoad: true,
  })
  const {
    data,
    setData,
    loading,
    error,
    setError,
    attemptRefresh: attemptVisibleRowsRefresh,
  } = visibleRowsResource

  const attemptRefresh = useCallback(
    async (
      options?: QuoteProductsResourceAttemptOptions
    ): Promise<QuoteProductsResourceAttemptResult> => {
      const preserveDataOnError = options?.preserveDataOnError ?? false

      const result = await attemptVisibleRowsRefresh(options)
      if (result.ok && result.data) {
        const nextData = result.data
        setAllKnownDataState((current) => mergeKnownQuoteProducts(current, nextData))
      } else if (result.error && !preserveDataOnError) {
        setAllKnownDataState(emptyProductRows)
      }

      return result
    },
    [attemptVisibleRowsRefresh]
  )

  const refresh = useCallback(async () => {
    const result = await attemptRefresh()
    return result.ok
  }, [attemptRefresh])

  useEffect(() => {
    void refresh()
  }, [refresh, reloadKey])

  return {
    data,
    setData,
    loading,
    error,
    setError,
    refresh,
    attemptRefresh,
    allKnownData,
    setAllKnownData,
  } satisfies QuoteProductsResourceAdapter
}

export function useQuoteProductsData({ query }: Options) {
  const reloadKey = useMemo(() => JSON.stringify(query), [query])

  return useKnownQuoteProductsResource({ query, reloadKey })
}
