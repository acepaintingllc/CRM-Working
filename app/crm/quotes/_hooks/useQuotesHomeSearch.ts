'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  normalizeQuoteHomeSearchQuery,
  type QuoteHomeSearchResponse,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeSearch } from '@/lib/quotes/client'
import {
  beginQuoteHomeAsyncRequest,
  cancelQuoteHomeAsyncRequests,
  finishQuoteHomeAsyncRequest,
  isQuoteHomeAsyncRequestCurrent,
} from './quoteHomeAsyncLifecycle'

const SEARCH_DEBOUNCE_MS = 150

const emptySearchResponse: QuoteHomeSearchResponse = {
  query: '',
  items: [],
}

export function useQuotesHomeSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [data, setData] = useState<QuoteHomeSearchResponse>(emptySearchResponse)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const requestIdRef = useRef(0)
  const requestLifecycle = useMemo(
    () => ({
      currentRequestRef: requestIdRef,
    }),
    []
  )

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(normalizeQuoteHomeSearchQuery(query))
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const nextQuery = debouncedQuery

    if (!nextQuery) {
      cancelQuoteHomeAsyncRequests(requestLifecycle)
      setData(emptySearchResponse)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const request = beginQuoteHomeAsyncRequest(requestLifecycle, { query: nextQuery })

    void loadQuoteHomeSearch<QuoteHomeSearchResponse>(nextQuery)
      .then((response) => {
        if (!isQuoteHomeAsyncRequestCurrent(requestLifecycle, request)) return
        setData(response)
      })
      .catch((loadError) => {
        if (!isQuoteHomeAsyncRequestCurrent(requestLifecycle, request)) return
        setData({ query: nextQuery, items: [] })
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load quote search results.'
        )
      })
      .finally(() => {
        finishQuoteHomeAsyncRequest(requestLifecycle, request, () => setLoading(false))
      })
  }, [attempt, debouncedQuery, requestLifecycle])

  const retry = useCallback(() => {
    if (!debouncedQuery) return
    setAttempt((value) => value + 1)
  }, [debouncedQuery])

  return useMemo(
    () => ({
      query: debouncedQuery,
      results: data.items,
      loading,
      error,
      retry,
    }),
    [data, debouncedQuery, error, loading, retry]
  )
}
