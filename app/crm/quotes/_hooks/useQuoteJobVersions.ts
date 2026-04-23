'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type QuoteJobVersionsReadModel,
  type QuoteHomeJobVersionItemReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteJobVersions } from '@/lib/quotes/client'

const emptyJobVersions = (jobId: string): QuoteJobVersionsReadModel => ({
  job_id: jobId,
  total_versions: 0,
  items: [],
})

export function useQuoteJobVersions(jobId: string) {
  const cacheRef = useRef<Record<string, QuoteJobVersionsReadModel>>({})
  const requestIdRef = useRef(0)
  const [data, setData] = useState<QuoteJobVersionsReadModel>(emptyJobVersions(jobId))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (targetJobId: string, options?: { force?: boolean }) => {
      if (!targetJobId) {
        setData(emptyJobVersions(''))
        setLoading(false)
        setError(null)
        return false
      }

      const cached = cacheRef.current[targetJobId]
      if (cached && !options?.force) {
        setData(cached)
        setLoading(false)
        setError(null)
        return true
      }

      const requestId = ++requestIdRef.current
      setLoading(true)
      setError(null)

      try {
        // Versions stay on their own request path so a selected job can render
        // its full version list without being capped by home search or summary data.
        const response = await loadQuoteJobVersions<QuoteJobVersionsReadModel>(targetJobId)
        if (requestIdRef.current !== requestId) return false
        cacheRef.current[targetJobId] = response
        setData(response)
        return true
      } catch (loadError) {
        if (requestIdRef.current !== requestId) return false
        setData(emptyJobVersions(targetJobId))
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load job quote versions.'
        )
        return false
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    void load(jobId)
  }, [jobId, load])

  const refresh = useCallback(async () => load(jobId, { force: true }), [jobId, load])

  return {
    data,
    items: data.items as QuoteHomeJobVersionItemReadModel[],
    loading,
    error,
    refresh,
  }
}
