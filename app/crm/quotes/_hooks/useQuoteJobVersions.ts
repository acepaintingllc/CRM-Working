'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { QuoteJobVersionsPageReadModel, QuoteJobVersionsReadModel, QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { loadQuoteJobVersions } from '@/lib/quotes/client'
import { createJobVersionsCache } from './jobVersionsCache'

const emptyJobVersions = (jobId: string): QuoteJobVersionsPageReadModel => ({
  job_id: jobId, total_versions: 0, limit: 25, next_cursor: null, items: [],
})

function mergeJobVersionsPages(currentData: QuoteJobVersionsPageReadModel, nextPage: QuoteJobVersionsPageReadModel): QuoteJobVersionsPageReadModel {
  const seenEstimateIds = new Set<string>()
  const items = [...currentData.items, ...nextPage.items].filter((item) => {
    if (seenEstimateIds.has(item.estimate_id)) return false
    seenEstimateIds.add(item.estimate_id)
    return true
  })

  return { ...nextPage, items }
}

type UseQuoteJobVersionsOptions = { enabled?: boolean; initialData?: QuoteJobVersionsPageReadModel | null }

type LoadOptions = { force?: boolean; preserveDataOnError?: boolean; reportError?: boolean; cursor?: string | null; append?: boolean }

export function useQuoteJobVersions(jobId: string, options?: UseQuoteJobVersionsOptions) {
  const enabled = options?.enabled ?? true
  const cacheRef = useRef(createJobVersionsCache())
  const requestIdRef = useRef(0)
  const initialData = options?.initialData ?? null

  useMemo(() => {
    if (initialData?.job_id) cacheRef.current.set(initialData.job_id, initialData)
  }, [initialData])

  const initialPageData = enabled ? initialData ?? emptyJobVersions(jobId) : emptyJobVersions('')
  const dataRef = useRef<QuoteJobVersionsPageReadModel>(initialPageData)
  const [data, setData] = useState<QuoteJobVersionsPageReadModel>(initialPageData)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setCurrentData = useCallback((nextData: QuoteJobVersionsPageReadModel) => {
    dataRef.current = nextData; setData(nextData)
  }, [])

  const commitData = useCallback((nextData: QuoteJobVersionsPageReadModel) => {
    cacheRef.current.set(nextData.job_id, nextData); setCurrentData(nextData)
  }, [setCurrentData])

  useEffect(() => {
    if (initialData?.job_id === jobId) {
      requestIdRef.current += 1
      setCurrentData(initialData)
      setError(null); setLoading(false); setLoadingMore(false)
    }
  }, [initialData, jobId, setCurrentData])

  const load = useCallback(
    async (targetJobId: string, loadOptions?: LoadOptions) => {
      if (!targetJobId || !enabled) {
        setCurrentData(emptyJobVersions(''))
        setLoading(false); setLoadingMore(false); setError(null)
        return { ok: false as const, error: null }
      }

      const append = loadOptions?.append ?? false
      const cursor = loadOptions?.cursor ?? null

      if (!append && cacheRef.current.has(targetJobId) && !loadOptions?.force) {
        setCurrentData(cacheRef.current.get(targetJobId) ?? emptyJobVersions(targetJobId))
        setLoading(false); setLoadingMore(false); setError(null)
        return { ok: true as const, error: null }
      }
      if (append && !cursor) return { ok: false as const, error: null }

      const requestId = ++requestIdRef.current
      const preserveDataOnError = loadOptions?.preserveDataOnError ?? append
      const reportError = loadOptions?.reportError ?? true
      const currentData = dataRef.current.job_id === targetJobId ? dataRef.current : emptyJobVersions(targetJobId)

      if (append) {
        setLoadingMore(true)
      } else {
        setLoadingMore(false)
        if (!preserveDataOnError) setCurrentData(emptyJobVersions(targetJobId))
        setLoading(true)
      }
      if (reportError) setError(null)

      try {
        const response = cursor
          ? await loadQuoteJobVersions<QuoteJobVersionsPageReadModel>(targetJobId, { cursor })
          : await loadQuoteJobVersions<QuoteJobVersionsPageReadModel>(targetJobId)
        if (requestIdRef.current !== requestId) return { ok: false as const, error: null }
        commitData(append ? mergeJobVersionsPages(currentData, response) : response)
        if (reportError) setError(null)
        return { ok: true as const, error: null }
      } catch (loadError) {
        if (requestIdRef.current !== requestId) return { ok: false as const, error: null }
        const nextError = loadError instanceof Error ? loadError.message : 'Failed to load job quote versions.'
        if (!preserveDataOnError) setCurrentData(emptyJobVersions(targetJobId))
        if (reportError) setError(nextError)
        return { ok: false as const, error: nextError }
      } finally {
        if (requestIdRef.current === requestId) {
          if (append) setLoadingMore(false)
          else setLoading(false)
        }
      }
    },
    [commitData, enabled, setCurrentData]
  )

  useEffect(() => {
    if (enabled) void load(jobId)
  }, [enabled, jobId, load])

  const refresh = useCallback(async () => {
    if (!enabled) return false
    const result = await load(jobId, { force: true, preserveDataOnError: true })
    return result.ok
  }, [enabled, jobId, load])

  const attemptRefresh = useCallback(
    async (loadOptions?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      if (!enabled) return { ok: false as const, error: null }
      return load(jobId, { force: true, preserveDataOnError: loadOptions?.preserveDataOnError, reportError: loadOptions?.reportError })
    },
    [enabled, jobId, load]
  )

  const loadMore = useCallback(async () => {
    if (!enabled || loading || loadingMore || !dataRef.current.next_cursor) return false
    const result = await load(jobId, { append: true, cursor: dataRef.current.next_cursor, preserveDataOnError: true })
    return result.ok
  }, [enabled, jobId, load, loading, loadingMore])

  const hasResolved = Boolean(jobId && cacheRef.current.has(jobId))

  return { data: data as QuoteJobVersionsReadModel, pageData: data, items: data.items as QuoteHomeJobVersionItemReadModel[], loading, loadingMore, error, hasMore: Boolean(data.next_cursor), hasResolved, loadMore, refresh, attemptRefresh }
}
