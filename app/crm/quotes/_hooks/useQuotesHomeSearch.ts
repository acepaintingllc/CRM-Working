'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  normalizeQuoteHomeSearchQuery,
} from '@/lib/quotes/quoteHomeCursors'
import type { QuoteHomeSearchResponse } from '@/lib/quotes/quoteHomeTypes'
import { loadQuoteHomeSearch } from '@/lib/quotes/client'
import {
  beginQuotePagedAsyncRequest,
  cancelQuotePagedAsyncRequests,
  runQuotePagedAsyncRequest,
  type QuotePagedAsyncRequest,
} from './quotePagedAsyncLifecycle'

const SEARCH_DEBOUNCE_MS = 150

const emptySearchResponse: QuoteHomeSearchResponse = {
  query: '',
  items: [],
}

type QuoteHomeSearchRequest = QuotePagedAsyncRequest<{
  query: string
  purpose: 'search' | 'retry'
}>

function toSearchLoadErrorMessage(loadError: unknown) {
  return loadError instanceof Error
    ? loadError.message
    : 'Failed to load quote search results.'
}

export function useQuotesHomeSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [data, setData] = useState<QuoteHomeSearchResponse>(emptySearchResponse)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const requestLifecycle = useMemo(
    () => ({
      currentRequestRef: { current: 0 },
      activeRequestRef: { current: null as QuoteHomeSearchRequest | null },
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
      cancelQuotePagedAsyncRequests(requestLifecycle)
      setData(emptySearchResponse)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const request = beginQuotePagedAsyncRequest(requestLifecycle, {
      query: nextQuery,
      purpose: attempt > 0 ? 'retry' : 'search',
    })

    void runQuotePagedAsyncRequest(requestLifecycle, request, {
      load: ({ query: requestQuery }) =>
        loadQuoteHomeSearch<QuoteHomeSearchResponse>(requestQuery),
      getErrorMessage: toSearchLoadErrorMessage,
      onSuccess: (_, response) => setData(response),
      onFailure: (_, nextError) => {
        setData({ query: nextQuery, items: [] })
        setError(nextError)
      },
      onFinish: () => setLoading(false),
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
