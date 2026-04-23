'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  type QuoteHomeSearchResponse,
  type QuoteHomeSearchResultReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeSearch } from '@/lib/quotes/client'

const emptySearchResponse: QuoteHomeSearchResponse = {
  query: '',
  limit: 8,
  items: [],
}

export function useQuotesHomeSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [data, setData] = useState<QuoteHomeSearchResponse>(emptySearchResponse)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 150)

    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    let cancelled = false
    const nextQuery = debouncedQuery

    if (!nextQuery) {
      setData(emptySearchResponse)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    void loadQuoteHomeSearch<QuoteHomeSearchResponse>(nextQuery)
      .then((response) => {
        if (cancelled) return
        setData(response)
      })
      .catch((loadError) => {
        if (cancelled) return
        setData({ query: nextQuery, limit: 8, items: [] })
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load quote search results.'
        )
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [attempt, debouncedQuery])

  const retry = useCallback(() => {
    if (!debouncedQuery) return
    setAttempt((value) => value + 1)
  }, [debouncedQuery])

  return useMemo(
    () => ({
      query: data.query,
      results: data.items as QuoteHomeSearchResultReadModel[],
      loading,
      error,
      hasQuery: debouncedQuery.length > 0,
      emptyMessage:
        debouncedQuery && !loading && !error && data.items.length === 0
          ? `No quote versions match "${debouncedQuery}".`
          : null,
      canRetry: Boolean(debouncedQuery) && !loading,
      retry,
    }),
    [data, debouncedQuery, error, loading, retry]
  )
}
