'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  QuoteJobVersionsPageReadModel,
  QuoteJobVersionsReadModel,
  QuoteHomeJobVersionItemReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteJobVersions } from '@/lib/quotes/client'

const emptyJobVersions = (jobId: string): QuoteJobVersionsPageReadModel => ({
  job_id: jobId,
  total_versions: 0,
  limit: 25,
  next_cursor: null,
  items: [],
})

type UseQuoteJobVersionsOptions = {
  enabled?: boolean
  initialData?: QuoteJobVersionsPageReadModel | null
}

export function useQuoteJobVersions(jobId: string, options?: UseQuoteJobVersionsOptions) {
  const enabled = options?.enabled ?? true
  const cacheRef = useRef<Record<string, QuoteJobVersionsPageReadModel>>({})
  const requestIdRef = useRef(0)
  const seededInitialDataRef = useRef(options?.initialData ?? null)
  const [data, setData] = useState<QuoteJobVersionsPageReadModel>(() => {
    const initialData = options?.initialData
    if (initialData?.job_id) {
      cacheRef.current[initialData.job_id] = initialData
    }
    return initialData ?? emptyJobVersions(jobId)
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const commitData = useCallback((nextData: QuoteJobVersionsPageReadModel) => {
    cacheRef.current[nextData.job_id] = nextData
    setData(nextData)
  }, [])

  useEffect(() => {
    const seededData = options?.initialData
    if (!seededData?.job_id) {
      return
    }
    cacheRef.current[seededData.job_id] = seededData
    if (seededInitialDataRef.current !== seededData && seededData.job_id === jobId) {
      seededInitialDataRef.current = seededData
      setData(seededData)
      setError(null)
      setLoading(false)
    }
  }, [jobId, options?.initialData])

  const load = useCallback(
    async (
      targetJobId: string,
      loadOptions?: { force?: boolean; preserveDataOnError?: boolean; reportError?: boolean }
    ) => {
      if (!targetJobId || !enabled) {
        setData(emptyJobVersions(''))
        setLoading(false)
        setError(null)
        return { ok: false as const, error: null }
      }

      const cached = cacheRef.current[targetJobId]
      if (cached && !loadOptions?.force) {
        setData(cached)
        setLoading(false)
        setError(null)
        return { ok: true as const, error: null }
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
        const response = await loadQuoteJobVersions<QuoteJobVersionsPageReadModel>(targetJobId)
        if (requestIdRef.current !== requestId) {
          return { ok: false as const, error: null }
        }
        commitData(response)
        if (reportError) {
          setError(null)
        }
        return { ok: true as const, error: null }
      } catch (loadError) {
        if (requestIdRef.current !== requestId) {
          return { ok: false as const, error: null }
        }
        const nextError =
          loadError instanceof Error ? loadError.message : 'Failed to load job quote versions.'
        if (!preserveDataOnError) {
          setData(emptyJobVersions(targetJobId))
        }
        if (reportError) {
          setError(nextError)
        }
        return { ok: false as const, error: nextError }
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
        return { ok: false as const, error: null }
      }
      return load(jobId, {
        force: true,
        preserveDataOnError: loadOptions?.preserveDataOnError,
        reportError: loadOptions?.reportError,
      })
    },
    [enabled, jobId, load]
  )

  return {
    data: data as QuoteJobVersionsReadModel,
    pageData: data,
    items: data.items as QuoteHomeJobVersionItemReadModel[],
    loading,
    error,
    refresh,
    attemptRefresh,
  }
}
