'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type QuoteJobVersionsReadModel,
  type QuoteHomeJobVersionItemReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteJobVersions } from '@/lib/quotes/client'

const DEFAULT_LIMIT = 25

const emptyJobVersions = (jobId: string): QuoteJobVersionsReadModel => ({
  job_id: jobId,
  total_versions: 0,
  limit: DEFAULT_LIMIT,
  next_cursor: null,
  items: [],
})

<<<<<<< Updated upstream
export function useQuoteJobVersions(jobId: string) {
=======
type UseQuoteJobVersionsOptions = {
  enabled?: boolean
  initialData?: QuoteJobVersionsReadModel | null
  limit?: number
}

export function useQuoteJobVersions(jobId: string, options?: UseQuoteJobVersionsOptions) {
  const enabled = options?.enabled ?? true
  const limit = options?.limit ?? DEFAULT_LIMIT
>>>>>>> Stashed changes
  const cacheRef = useRef<Record<string, QuoteJobVersionsReadModel>>({})
  const requestIdRef = useRef(0)
  const [data, setData] = useState<QuoteJobVersionsReadModel>(
    options?.initialData && options.initialData.job_id === jobId ? options.initialData : emptyJobVersions(jobId)
  )
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

<<<<<<< Updated upstream
  const load = useCallback(
    async (targetJobId: string, options?: { force?: boolean }) => {
      if (!targetJobId) {
=======
  const commitData = useCallback((nextData: QuoteJobVersionsReadModel) => {
    cacheRef.current[nextData.job_id] = nextData
    setData(nextData)
  }, [])

  useEffect(() => {
    if (options?.initialData) {
      cacheRef.current[options.initialData.job_id] = options.initialData
      if (options.initialData.job_id === jobId) {
        setData(options.initialData)
      }
    }
  }, [jobId, options?.initialData])

  const load = useCallback(
    async (
      targetJobId: string,
      loadOptions?: {
        force?: boolean
        preserveDataOnError?: boolean
        reportError?: boolean
        cursor?: string | null
        append?: boolean
      }
    ) => {
      if (!targetJobId || !enabled) {
>>>>>>> Stashed changes
        setData(emptyJobVersions(''))
        setLoading(false)
        setLoadingMore(false)
        setError(null)
        return false
      }

      const cached = cacheRef.current[targetJobId]
<<<<<<< Updated upstream
      if (cached && !options?.force) {
=======
      if (cached && !loadOptions?.force && !loadOptions?.append) {
>>>>>>> Stashed changes
        setData(cached)
        setLoading(false)
        setLoadingMore(false)
        setError(null)
        return true
      }

      const requestId = ++requestIdRef.current
<<<<<<< Updated upstream
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
=======
      const preserveDataOnError = loadOptions?.preserveDataOnError ?? false
      const reportError = loadOptions?.reportError ?? true
      if (!preserveDataOnError && !loadOptions?.append) {
        setData(emptyJobVersions(targetJobId))
      }
      setLoading(!loadOptions?.append)
      setLoadingMore(Boolean(loadOptions?.append))
      if (reportError) {
        setError(null)
      }

      try {
        const response = await loadQuoteJobVersions<QuoteJobVersionsReadModel>(targetJobId, {
          cursor: loadOptions?.cursor,
          limit,
        })
        if (requestIdRef.current !== requestId) return { ok: false, error: null }
        commitData(
          loadOptions?.append
            ? {
                ...response,
                items: [...(cacheRef.current[targetJobId]?.items ?? []), ...response.items],
              }
            : response
        )
        if (reportError) {
          setError(null)
        }
        return { ok: true, error: null }
>>>>>>> Stashed changes
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
          setLoadingMore(false)
        }
      }
    },
<<<<<<< Updated upstream
    []
  )

  useEffect(() => {
=======
    [commitData, enabled, limit]
  )

  useEffect(() => {
    if (!enabled) {
      setData(emptyJobVersions(''))
      setLoading(false)
      setLoadingMore(false)
      setError(null)
      return
    }
    const seeded = cacheRef.current[jobId]
    if (seeded) {
      setData(seeded)
      setError(null)
      setLoading(false)
      setLoadingMore(false)
      return
    }
>>>>>>> Stashed changes
    void load(jobId)
  }, [jobId, load])

  const refresh = useCallback(async () => load(jobId, { force: true }), [jobId, load])

<<<<<<< Updated upstream
  const removeVersion = useCallback((estimateId: string) => {
    if (!jobId) return
    const cached = cacheRef.current[jobId]
    const current = cached ?? emptyJobVersions(jobId)
    const nextItems = current.items.filter((item) => item.estimate_id !== estimateId)
    const nextValue: QuoteJobVersionsReadModel = {
      job_id: jobId,
      total_versions: nextItems.length,
      items: nextItems,
    }
    cacheRef.current[jobId] = nextValue
    setData(nextValue)
  }, [jobId])
=======
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

  const loadMore = useCallback(async () => {
    if (!enabled || !data.next_cursor || loading || loadingMore) return false
    const result = await load(jobId, {
      append: true,
      cursor: data.next_cursor,
      preserveDataOnError: true,
    })
    return result.ok
  }, [data.next_cursor, enabled, jobId, load, loading, loadingMore])

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
>>>>>>> Stashed changes

  return {
    data,
    items: data.items as QuoteHomeJobVersionItemReadModel[],
    loading,
    loadingMore,
    error,
    hasMore: Boolean(data.next_cursor),
    refresh,
<<<<<<< Updated upstream
=======
    attemptRefresh,
    loadMore,
>>>>>>> Stashed changes
    removeVersion,
  }
}
