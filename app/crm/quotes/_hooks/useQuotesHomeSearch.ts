'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type QuoteHomeSearchResponse } from '@/lib/quotes/collectionData'
import { loadQuoteHomeSearch } from '@/lib/quotes/client'

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

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const nextQuery = debouncedQuery

    if (!nextQuery) {
      requestIdRef.current += 1
      setData(emptySearchResponse)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    const requestId = ++requestIdRef.current

    void loadQuoteHomeSearch<QuoteHomeSearchResponse>(nextQuery)
      .then((response) => {
        if (requestIdRef.current !== requestId) return
        setData(response)
      })
      .catch((loadError) => {
        if (requestIdRef.current !== requestId) return
        setData({ query: nextQuery, items: [] })
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load quote search results.'
        )
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      })
  }, [attempt, debouncedQuery])

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
