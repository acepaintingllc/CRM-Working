'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { loadQuoteProducts } from '@/lib/quotes/client'
import type { QuoteProductQuery, QuoteProductRow } from '@/lib/quotes/productsForm'
import { mergeKnownQuoteProducts } from './quoteProductsControllerUtils'

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
  allKnownData: QuoteProductRow[]
  setAllKnownData: Dispatch<SetStateAction<QuoteProductRow[]>>
}

export function useQuoteProductsData({ query }: Options) {
  const reloadKey = useMemo(() => JSON.stringify(query), [query])
  const [data, setDataState] = useState<QuoteProductRow[]>(emptyProductRows)
  const [allKnownData, setAllKnownDataState] = useState<QuoteProductRow[]>(emptyProductRows)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const queryRef = useRef(query)

  useEffect(() => {
    queryRef.current = query
  }, [query])

  const setData: Dispatch<SetStateAction<QuoteProductRow[]>> = useCallback((nextState) => {
    setDataState(nextState)
  }, [])

  const setAllKnownData: Dispatch<SetStateAction<QuoteProductRow[]>> = useCallback((nextState) => {
    setAllKnownDataState(nextState)
  }, [])

  const attemptRefresh = useCallback(
    async (options?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      const requestId = ++requestIdRef.current
      const preserveDataOnError = options?.preserveDataOnError ?? false
      const reportError = options?.reportError ?? true

      setLoading(true)
      if (reportError) {
        setError(null)
      }

      try {
        const nextData = await loadQuoteProducts<QuoteProductRow[]>(queryRef.current)
        if (requestIdRef.current !== requestId) {
          return { ok: false, error: null, data: null as QuoteProductRow[] | null }
        }

        setDataState(nextData)
        setAllKnownDataState((current) => mergeKnownQuoteProducts(current, nextData))
        if (reportError) {
          setError(null)
        }

        return { ok: true, error: null, data: nextData }
      } catch (loadError) {
        if (requestIdRef.current !== requestId) {
          return { ok: false, error: null, data: null as QuoteProductRow[] | null }
        }

        const nextError =
          loadError instanceof Error ? loadError.message : 'Failed to load quote products.'
        if (!preserveDataOnError) {
          setDataState(emptyProductRows)
          setAllKnownDataState(emptyProductRows)
        }
        if (reportError) {
          setError(nextError)
        }

        return { ok: false, error: nextError, data: null as QuoteProductRow[] | null }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    []
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
