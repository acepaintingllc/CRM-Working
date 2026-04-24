'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  QuoteJobVersionsPageReadModel,
  QuoteJobVersionsReadModel,
  QuoteHomeJobVersionItemReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteJobVersions } from '@/lib/quotes/client'
import {
  createJobVersionsCache,
  emptyJobVersions,
  getCachedJobVersionsPage,
  hydrateJobVersionsCache,
  mergeJobVersionsPages,
  resolveInitialJobVersionsPage,
  type JobVersionsCache,
} from './jobVersionsCache'

type UseQuoteJobVersionsOptions = {
  enabled?: boolean
  initialData?: QuoteJobVersionsPageReadModel | null
}

type LoadOptions = {
  force?: boolean
  preserveDataOnError?: boolean
  reportError?: boolean
  cursor?: string | null
  append?: boolean
}

type FreshLoadOptions = Pick<LoadOptions, 'force' | 'preserveDataOnError' | 'reportError'>
type LoadMoreOptions = Pick<LoadOptions, 'cursor' | 'preserveDataOnError' | 'reportError'>
type LoadResult = { ok: true; error: null } | { ok: false; error: string | null }
type RequestState = { current: number }
type LoadMoreRequestState = { current: number | null }

type JobVersionsRequestLifecycle = {
  currentRequest: RequestState
  activeLoadMoreRequest: LoadMoreRequestState
}

type JobVersionsStateActions = {
  replaceData(nextData: QuoteJobVersionsPageReadModel): void
  commitData(nextData: QuoteJobVersionsPageReadModel): void
  setLoading(nextLoading: boolean): void
  setLoadingMore(nextLoading: boolean): void
  setError(nextError: string | null): void
}

type FreshLoadRequest = {
  jobId: string
  cache: JobVersionsCache
  lifecycle: JobVersionsRequestLifecycle
  actions: JobVersionsStateActions
  options?: FreshLoadOptions
}

type LoadMoreRequest = {
  jobId: string
  currentData: QuoteJobVersionsPageReadModel
  lifecycle: JobVersionsRequestLifecycle
  actions: JobVersionsStateActions
  options?: LoadMoreOptions
}

export function startJobVersionsRequest(requestState: RequestState): number {
  requestState.current += 1
  return requestState.current
}

export function beginFreshJobVersionsRequest(
  lifecycle: JobVersionsRequestLifecycle
): number {
  const requestId = startJobVersionsRequest(lifecycle.currentRequest)
  lifecycle.activeLoadMoreRequest.current = null
  return requestId
}

export function beginLoadMoreJobVersionsRequest(
  lifecycle: JobVersionsRequestLifecycle,
  cursor: string | null
): number | null {
  if (!canStartJobVersionsLoadMore(lifecycle, cursor)) {
    return null
  }

  const requestId = startJobVersionsRequest(lifecycle.currentRequest)
  lifecycle.activeLoadMoreRequest.current = requestId
  return requestId
}

export function isCurrentJobVersionsRequest(
  lifecycle: JobVersionsRequestLifecycle,
  requestId: number
): boolean {
  return lifecycle.currentRequest.current === requestId
}

export function canStartJobVersionsLoadMore(
  lifecycle: JobVersionsRequestLifecycle,
  cursor: string | null
): boolean {
  return Boolean(cursor) && lifecycle.activeLoadMoreRequest.current === null
}

export function finishJobVersionsLoadMoreRequest(
  lifecycle: JobVersionsRequestLifecycle,
  requestId: number
) {
  if (lifecycle.activeLoadMoreRequest.current === requestId) {
    lifecycle.activeLoadMoreRequest.current = null
  }
}

export function jobVersionsErrorMessage(loadError: unknown): string {
  return loadError instanceof Error ? loadError.message : 'Failed to load job quote versions.'
}

function resetJobVersionsState(actions: JobVersionsStateActions, jobId: string) {
  actions.replaceData(emptyJobVersions(jobId))
  actions.setLoading(false)
  actions.setLoadingMore(false)
  actions.setError(null)
}

async function loadFreshJobVersionsPage({
  jobId,
  cache,
  lifecycle,
  actions,
  options,
}: FreshLoadRequest): Promise<LoadResult> {
  const requestId = beginFreshJobVersionsRequest(lifecycle)
  const cachedPage = getCachedJobVersionsPage(cache, jobId, {
    force: options?.force,
  })

  if (cachedPage) {
    actions.commitData(cachedPage)
    actions.setLoading(false)
    actions.setLoadingMore(false)
    actions.setError(null)
    return { ok: true, error: null }
  }

  const preserveDataOnError = options?.preserveDataOnError ?? false
  const reportError = options?.reportError ?? true

  actions.setLoadingMore(false)

  if (!preserveDataOnError) {
    actions.replaceData(emptyJobVersions(jobId))
  }

  actions.setLoading(true)

  if (reportError) {
    actions.setError(null)
  }

  try {
    const response = await loadQuoteJobVersions<QuoteJobVersionsPageReadModel>(jobId)

    if (!isCurrentJobVersionsRequest(lifecycle, requestId)) {
      return { ok: false, error: null }
    }

    actions.commitData(response)

    if (reportError) {
      actions.setError(null)
    }

    return { ok: true, error: null }
  } catch (loadError) {
    if (!isCurrentJobVersionsRequest(lifecycle, requestId)) {
      return { ok: false, error: null }
    }

    const nextError = jobVersionsErrorMessage(loadError)

    if (!preserveDataOnError) {
      actions.replaceData(emptyJobVersions(jobId))
    }

    if (reportError) {
      actions.setError(nextError)
    }

    return { ok: false, error: nextError }
  } finally {
    if (isCurrentJobVersionsRequest(lifecycle, requestId)) {
      actions.setLoading(false)
    }
  }
}

async function loadMoreJobVersionsPage({
  jobId,
  currentData,
  lifecycle,
  actions,
  options,
}: LoadMoreRequest): Promise<LoadResult> {
  const cursor = options?.cursor ?? null
  const requestId = beginLoadMoreJobVersionsRequest(lifecycle, cursor)

  if (requestId === null) {
    return { ok: false, error: null }
  }

  const preserveDataOnError = options?.preserveDataOnError ?? true
  const reportError = options?.reportError ?? true

  actions.setLoadingMore(true)

  if (reportError) {
    actions.setError(null)
  }

  try {
    const response = await loadQuoteJobVersions<QuoteJobVersionsPageReadModel>(jobId, {
      cursor,
    })

    if (!isCurrentJobVersionsRequest(lifecycle, requestId)) {
      return { ok: false, error: null }
    }

    actions.commitData(mergeJobVersionsPages(currentData, response))

    if (reportError) {
      actions.setError(null)
    }

    return { ok: true, error: null }
  } catch (loadError) {
    if (!isCurrentJobVersionsRequest(lifecycle, requestId)) {
      return { ok: false, error: null }
    }

    const nextError = jobVersionsErrorMessage(loadError)

    if (!preserveDataOnError) {
      actions.replaceData(emptyJobVersions(jobId))
    }

    if (reportError) {
      actions.setError(nextError)
    }

    return { ok: false, error: nextError }
  } finally {
    if (isCurrentJobVersionsRequest(lifecycle, requestId)) {
      actions.setLoadingMore(false)
    }

    finishJobVersionsLoadMoreRequest(lifecycle, requestId)
  }
}

export function useQuoteJobVersions(jobId: string, options?: UseQuoteJobVersionsOptions) {
  const enabled = options?.enabled ?? true
  const initialData = options?.initialData ?? null
  const cacheRef = useRef(createJobVersionsCache())
  const requestIdRef = useRef(0)
  const loadMoreRequestIdRef = useRef<number | null>(null)

  const initialPageData = resolveInitialJobVersionsPage({
    jobId,
    enabled,
    initialData,
  })

  const dataRef = useRef<QuoteJobVersionsPageReadModel>(initialPageData)
  const [data, setData] = useState<QuoteJobVersionsPageReadModel>(initialPageData)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolvedJobIds, setResolvedJobIds] = useState<ReadonlySet<string>>(() => {
    if (!enabled || !initialData?.job_id) {
      return new Set()
    }

    return new Set([initialData.job_id])
  })

  const replaceData = useCallback((nextData: QuoteJobVersionsPageReadModel) => {
    dataRef.current = nextData
    setData(nextData)
  }, [])

  const markResolved = useCallback((resolvedJobId: string) => {
    setResolvedJobIds((currentResolvedJobIds) => {
      if (currentResolvedJobIds.has(resolvedJobId)) {
        return currentResolvedJobIds
      }

      const nextResolvedJobIds = new Set(currentResolvedJobIds)
      nextResolvedJobIds.add(resolvedJobId)
      return nextResolvedJobIds
    })
  }, [])

  const commitData = useCallback(
    (nextData: QuoteJobVersionsPageReadModel) => {
      cacheRef.current.set(nextData.job_id, nextData)
      markResolved(nextData.job_id)
      replaceData(nextData)
    },
    [markResolved, replaceData]
  )

  const lifecycle = useMemo<JobVersionsRequestLifecycle>(
    () => ({
      currentRequest: requestIdRef,
      activeLoadMoreRequest: loadMoreRequestIdRef,
    }),
    []
  )

  const actions = useMemo<JobVersionsStateActions>(
    () => ({
      replaceData,
      commitData,
      setLoading,
      setLoadingMore,
      setError,
    }),
    [commitData, replaceData]
  )

  useEffect(() => {
    const didHydrate = enabled
      ? hydrateJobVersionsCache(cacheRef.current, initialData)
      : false

    if (didHydrate && initialData?.job_id) {
      markResolved(initialData.job_id)
    }

    if (!enabled || initialData?.job_id !== jobId) {
      return
    }

    beginFreshJobVersionsRequest(lifecycle)
    actions.replaceData(initialData)
    actions.setError(null)
    actions.setLoading(false)
    actions.setLoadingMore(false)
  }, [actions, enabled, initialData, jobId, lifecycle, markResolved])

  const loadFresh = useCallback(
    async (targetJobId: string, loadOptions?: FreshLoadOptions) =>
      loadFreshJobVersionsPage({
        jobId: targetJobId,
        cache: cacheRef.current,
        lifecycle,
        actions,
        options: loadOptions,
      }),
    [actions, lifecycle]
  )

  const loadNextPage = useCallback(
    async (targetJobId: string, loadOptions?: LoadMoreOptions) => {
      const currentData =
        dataRef.current.job_id === targetJobId
          ? dataRef.current
          : emptyJobVersions(targetJobId)

      return loadMoreJobVersionsPage({
        jobId: targetJobId,
        currentData,
        lifecycle,
        actions,
        options: loadOptions,
      })
    },
    [actions, lifecycle]
  )

  const load = useCallback(
    async (targetJobId: string, loadOptions?: LoadOptions): Promise<LoadResult> => {
      if (!targetJobId || !enabled) {
        beginFreshJobVersionsRequest(lifecycle)
        resetJobVersionsState(actions, '')
        return { ok: false, error: null }
      }

      if (loadOptions?.append) {
        return loadNextPage(targetJobId, loadOptions)
      }

      return loadFresh(targetJobId, loadOptions)
    },
    [actions, enabled, lifecycle, loadFresh, loadNextPage]
  )

  useEffect(() => {
    void load(jobId)
  }, [jobId, load])

  const refresh = useCallback(async () => {
    if (!enabled) return false

    const result = await load(jobId, {
      force: true,
      preserveDataOnError: true,
    })

    return result.ok
  }, [enabled, jobId, load])

  const attemptRefresh = useCallback(
    async (loadOptions?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      if (!enabled) return { ok: false as const, error: null }

      return load(jobId, {
        force: true,
        preserveDataOnError: loadOptions?.preserveDataOnError,
        reportError: loadOptions?.reportError,
      })
    },
    [enabled, jobId, load]
  )

  const loadMore = useCallback(async () => {
    const cursor = dataRef.current.next_cursor

    if (!enabled || loading || loadingMore) {
      return false
    }

    if (!canStartJobVersionsLoadMore(lifecycle, cursor)) {
      return false
    }

    const result = await load(jobId, {
      append: true,
      cursor,
      preserveDataOnError: true,
    })

    return result.ok
  }, [enabled, jobId, lifecycle, load, loading, loadingMore])

  const hasResolved = Boolean(enabled && jobId && resolvedJobIds.has(jobId))

  return {
    data: data as QuoteJobVersionsReadModel,
    pageData: data,
    items: data.items as QuoteHomeJobVersionItemReadModel[],
    loading,
    loadingMore,
    error,
    hasMore: Boolean(data.next_cursor),
    hasResolved,
    loadMore,
    refresh,
    attemptRefresh,
  }
}
