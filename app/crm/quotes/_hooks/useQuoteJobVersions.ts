'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { QuoteJobVersionsPageReadModel, QuoteJobVersionsReadModel, QuoteHomeJobVersionItemReadModel } from '@/lib/quotes/collectionData'
import { loadQuoteJobVersions } from '@/lib/quotes/client'
import {
  createJobVersionsCache,
  emptyJobVersions,
  getCachedJobVersionsPage,
  hydrateJobVersionsCache,
  initialJobVersionsPage,
  mergeJobVersionsPages,
} from './jobVersionsCache'

type UseQuoteJobVersionsOptions = { enabled?: boolean; initialData?: QuoteJobVersionsPageReadModel | null }

type LoadOptions = { force?: boolean; preserveDataOnError?: boolean; reportError?: boolean; cursor?: string | null; append?: boolean }
type LoadResult = { ok: true; error: null } | { ok: false; error: string | null }
type RequestState = { current: number }

export function startJobVersionsRequest(requestState: RequestState): number {
  requestState.current += 1
  return requestState.current
}

export function isCurrentJobVersionsRequest(requestState: RequestState, requestId: number): boolean {
  return requestState.current === requestId
}

export function jobVersionsErrorMessage(loadError: unknown): string {
  return loadError instanceof Error ? loadError.message : 'Failed to load job quote versions.'
}

export function useQuoteJobVersions(jobId: string, options?: UseQuoteJobVersionsOptions) {
  const enabled = options?.enabled ?? true
  const cacheRef = useRef(createJobVersionsCache())
  const requestIdRef = useRef(0)
  const initialData = options?.initialData ?? null

  const initialPageData = initialJobVersionsPage(jobId, enabled, initialData)
  const dataRef = useRef<QuoteJobVersionsPageReadModel>(initialPageData)
  const [data, setData] = useState<QuoteJobVersionsPageReadModel>(initialPageData)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, setCacheRevision] = useState(0)

  const setCurrentData = useCallback((nextData: QuoteJobVersionsPageReadModel) => {
    dataRef.current = nextData; setData(nextData)
  }, [])

  const commitData = useCallback((nextData: QuoteJobVersionsPageReadModel) => {
    cacheRef.current.set(nextData.job_id, nextData); setCurrentData(nextData)
  }, [setCurrentData])

  useEffect(() => {
    if (hydrateJobVersionsCache(cacheRef.current, initialData)) {
      setCacheRevision((revision) => revision + 1)
    }

    if (initialData?.job_id === jobId) {
      startJobVersionsRequest(requestIdRef)
      setCurrentData(initialData)
      setError(null); setLoading(false); setLoadingMore(false)
    }
  }, [initialData, jobId, setCurrentData])

  const loadFresh = useCallback(
    async (targetJobId: string, loadOptions?: LoadOptions): Promise<LoadResult> => {
      const cachedPage = getCachedJobVersionsPage(cacheRef.current, targetJobId, {
        force: loadOptions?.force,
      })

      if (cachedPage) {
        setCurrentData(cachedPage)
        setLoading(false); setLoadingMore(false); setError(null)
        return { ok: true, error: null }
      }

      const requestId = startJobVersionsRequest(requestIdRef)
      const preserveDataOnError = loadOptions?.preserveDataOnError ?? false
      const reportError = loadOptions?.reportError ?? true

      setLoadingMore(false)
      if (!preserveDataOnError) setCurrentData(emptyJobVersions(targetJobId))
      setLoading(true)
      if (reportError) setError(null)

      try {
        const response = await loadQuoteJobVersions<QuoteJobVersionsPageReadModel>(targetJobId)
        if (!isCurrentJobVersionsRequest(requestIdRef, requestId)) return { ok: false, error: null }
        commitData(response)
        if (reportError) setError(null)
        return { ok: true, error: null }
      } catch (loadError) {
        if (!isCurrentJobVersionsRequest(requestIdRef, requestId)) return { ok: false, error: null }
        const nextError = jobVersionsErrorMessage(loadError)
        if (!preserveDataOnError) setCurrentData(emptyJobVersions(targetJobId))
        if (reportError) setError(nextError)
        return { ok: false, error: nextError }
      } finally {
        if (isCurrentJobVersionsRequest(requestIdRef, requestId)) {
          setLoading(false)
        }
      }
    },
    [commitData, setCurrentData]
  )

  const loadNextPage = useCallback(
    async (targetJobId: string, loadOptions?: LoadOptions): Promise<LoadResult> => {
      const cursor = loadOptions?.cursor ?? null
      if (!cursor) return { ok: false, error: null }

      const requestId = startJobVersionsRequest(requestIdRef)
      const preserveDataOnError = loadOptions?.preserveDataOnError ?? true
      const reportError = loadOptions?.reportError ?? true
      const currentData = dataRef.current.job_id === targetJobId ? dataRef.current : emptyJobVersions(targetJobId)

      setLoadingMore(true)
      if (reportError) setError(null)

      try {
        const response = await loadQuoteJobVersions<QuoteJobVersionsPageReadModel>(targetJobId, { cursor })
        if (!isCurrentJobVersionsRequest(requestIdRef, requestId)) return { ok: false, error: null }
        commitData(mergeJobVersionsPages(currentData, response))
        if (reportError) setError(null)
        return { ok: true, error: null }
      } catch (loadError) {
        if (!isCurrentJobVersionsRequest(requestIdRef, requestId)) return { ok: false, error: null }
        const nextError = jobVersionsErrorMessage(loadError)
        if (!preserveDataOnError) setCurrentData(emptyJobVersions(targetJobId))
        if (reportError) setError(nextError)
        return { ok: false, error: nextError }
      } finally {
        if (isCurrentJobVersionsRequest(requestIdRef, requestId)) {
          setLoadingMore(false)
        }
      }
    },
    [commitData, setCurrentData]
  )

  const load = useCallback(
    async (targetJobId: string, loadOptions?: LoadOptions) => {
      if (!targetJobId || !enabled) {
        setCurrentData(emptyJobVersions(''))
        setLoading(false); setLoadingMore(false); setError(null)
        return { ok: false, error: null }
      }

      return loadOptions?.append ? loadNextPage(targetJobId, loadOptions) : loadFresh(targetJobId, loadOptions)
    },
    [enabled, loadFresh, loadNextPage, setCurrentData]
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
