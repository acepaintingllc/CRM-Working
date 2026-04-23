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

type UseQuoteJobVersionsOptions = {
  enabled?: boolean
}

export function useQuoteJobVersions(jobId: string, options?: UseQuoteJobVersionsOptions) {
  const enabled = options?.enabled ?? true
  const cacheRef = useRef<Record<string, QuoteJobVersionsReadModel>>({})
  const requestIdRef = useRef(0)
  const [data, setData] = useState<QuoteJobVersionsReadModel>(emptyJobVersions(jobId))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const commitData = useCallback((nextData: QuoteJobVersionsReadModel) => {
    cacheRef.current[nextData.job_id] = nextData
    setData(nextData)
  }, [])

  const load = useCallback(
    async (
      targetJobId: string,
      loadOptions?: { force?: boolean; preserveDataOnError?: boolean; reportError?: boolean }
    ) => {
      if (!targetJobId || !enabled) {
        setData(emptyJobVersions(''))
        setLoading(false)
        setError(null)
        return { ok: false, error: null }
      }

      const cached = cacheRef.current[targetJobId]
      if (cached && !loadOptions?.force) {
        setData(cached)
        setLoading(false)
        setError(null)
        return { ok: true, error: null }
      }

      const requestId = ++requestIdRef.current
      const preserveDataOnError = loadOptions?.preserveDataOnError ?? false
      const reportError = loadOptions?.reportError ?? true
      if (!preserveDataOnError) {
        setData(emptyJobVersions(targetJobId))
      }
      setLoading(true)
      if (reportError) {
        setError(null)
      }

      try {
        // Versions stay on their own request path so a selected job can render
        // its full version list without being capped by home search or summary data.
        const response = await loadQuoteJobVersions<QuoteJobVersionsReadModel>(targetJobId)
        if (requestIdRef.current !== requestId) return { ok: false, error: null }
        commitData(response)
        if (reportError) {
          setError(null)
        }
        return { ok: true, error: null }
      } catch (loadError) {
        if (requestIdRef.current !== requestId) return { ok: false, error: null }
        const nextError =
          loadError instanceof Error ? loadError.message : 'Failed to load job quote versions.'
        if (!preserveDataOnError) {
          setData(emptyJobVersions(targetJobId))
        }
        if (reportError) {
          setError(nextError)
        }
        return { ok: false, error: nextError }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
        }
      }
    },
    [commitData, enabled]
  )

  useEffect(() => {
    if (!enabled) {
      setData(emptyJobVersions(''))
      setLoading(false)
      setError(null)
      return
    }
    void load(jobId)
  }, [enabled, jobId, load])

  const refresh = useCallback(async () => {
    if (!enabled) return false
    const result = await load(jobId, { force: true, preserveDataOnError: true })
    return result.ok
  }, [enabled, jobId, load])

  const attemptRefresh = useCallback(
    async (loadOptions?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      if (!enabled) {
        return { ok: false, error: null }
      }
      return load(jobId, {
        force: true,
        preserveDataOnError: loadOptions?.preserveDataOnError,
        reportError: loadOptions?.reportError,
      })
    },
    [enabled, jobId, load]
  )

  const removeVersion = useCallback(
    (estimateId: string) => {
      setData((current) => {
        if (!current.items.some((item) => item.estimate_id === estimateId)) {
          return current
        }

        const targetJobId = current.job_id || jobId
        const nextData = {
          ...current,
          total_versions: Math.max(0, current.total_versions - 1),
          items: current.items.filter((item) => item.estimate_id !== estimateId),
        }
        if (targetJobId) {
          cacheRef.current[targetJobId] = nextData
        }
        return nextData
      })
    },
    [jobId]
  )

  return {
    data,
    items: data.items as QuoteHomeJobVersionItemReadModel[],
    loading,
    error,
    refresh,
    attemptRefresh,
    removeVersion,
  }
}
