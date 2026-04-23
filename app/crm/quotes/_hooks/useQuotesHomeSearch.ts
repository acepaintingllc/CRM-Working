'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  type QuoteHomeSearchResponse,
  type QuoteHomeSearchResultReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeSearch } from '@/lib/quotes/client'

const emptySearchResponse: QuoteHomeSearchResponse = {
  query: '',
  items: [],
}

export function useQuotesHomeSearch(query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [data, setData] = useState<QuoteHomeSearchResponse>(emptySearchResponse)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        setData({ query: nextQuery, items: [] })
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
  }, [debouncedQuery])

  return useMemo(
    () => ({
      query: data.query,
      results: data.items as QuoteHomeSearchResultReadModel[],
      loading,
      error,
    }),
    [data, error, loading]
  )
}
