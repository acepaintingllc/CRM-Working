'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobsPageReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeBootstrap, loadQuoteHomeJobs } from '@/lib/quotes/client'
import {
  normalizeQuoteHomeJobQuery,
  resolveQuoteHomeBootstrapJobsSync,
  resolveQuoteHomeJobsPageAfterRequest,
  resolveQuoteHomeJobsRefresh,
  resolveQuoteHomeLoadMoreJobs,
  resolveQuoteHomeQueryJobsSync,
} from './quoteHomePagePolicy'

const EMPTY_BOOTSTRAP: QuoteHomeBootstrapReadModel = {
  summary: {
    total_versions: 0,
    draft_count: 0,
    sent_or_awaiting_count: 0,
    live_count: 0,
    pipeline_total: 0,
  },
  jobs: {
    query: '',
    limit: 25,
    next_cursor: null,
    items: [],
  },
  selected_job_id: null,
  selected_job_versions: null,
}

function getJobsPaginationRequestKey(query: string, cursor: string) {
  return JSON.stringify([query, cursor])
}

function toLoadErrorMessage(scope: string, loadError: unknown) {
  return loadError instanceof Error ? loadError.message : `Failed to load ${scope}.`
}

type QuoteHomeJobsRequestPurpose = 'query_change' | 'refresh' | 'pagination'

type QuoteHomeJobsOperation = {
  requestId: number
  query: string
  purpose: QuoteHomeJobsRequestPurpose
}

type QuoteHomeJobsLoadResult =
  | {
      ok: true
      error: null
    }
  | {
      ok: false
      error: string | null
    }

type UseQuotesHomeDataOptions = {
  jobQuery?: string
}

export function useQuotesHomeBootstrap(initialData?: QuoteHomeBootstrapReadModel | null) {
  const resolvedInitialData = initialData ?? EMPTY_BOOTSTRAP
  const resource = useResource<QuoteHomeBootstrapReadModel>({
    initialData: resolvedInitialData,
    initialLoading: !initialData,
    skipInitialLoad: Boolean(initialData),
    resetOnError: false,
    load: async () => {
      return loadQuoteHomeBootstrap<QuoteHomeBootstrapReadModel>()
    },
    getErrorMessage: (loadError) => toLoadErrorMessage('quote home bootstrap', loadError),
  })

  return {
    bootstrapData: resource.data,
    bootstrapLoading: resource.loading,
    bootstrapError: resource.error,
    refreshBootstrap: resource.attemptRefresh,
  }
}

export function useQuotesHomeJobs(
  bootstrapData: QuoteHomeBootstrapReadModel,
  query?: string
) {
  const activeJobQuery = normalizeQuoteHomeJobQuery(query ?? bootstrapData.jobs.query)
  const latestLoadedBootstrapRef = useRef(bootstrapData)
  const activeJobQueryRef = useRef(activeJobQuery)
  const [jobsPage, setJobsPage] = useState<QuoteHomeJobsPageReadModel>(bootstrapData.jobs)
  const [jobsOperation, setJobsOperation] = useState<QuoteHomeJobsOperation | null>(null)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const jobsPageRef = useRef(bootstrapData.jobs)
  const jobsRequestIdRef = useRef(0)
  const jobsOperationRef = useRef<QuoteHomeJobsOperation | null>(null)
  const jobPaginationInFlightKeysRef = useRef(new Set<string>())

  const commitJobsPage = useCallback((nextJobsPage: QuoteHomeJobsPageReadModel) => {
    jobsPageRef.current = nextJobsPage
    setJobsPage(nextJobsPage)
  }, [])

  const setActiveJobsOperation = useCallback(
    (nextOperation: QuoteHomeJobsOperation | null) => {
      jobsOperationRef.current = nextOperation
      setJobsOperation(nextOperation)
    },
    []
  )

  const isActiveJobsRequest = useCallback(
    (operation: QuoteHomeJobsOperation) =>
      jobsRequestIdRef.current === operation.requestId &&
      jobsOperationRef.current?.requestId === operation.requestId &&
      activeJobQueryRef.current === operation.query,
    []
  )

  const cancelJobsRequestsForQuery = useCallback(
    (queryForLoadedPage: string) => {
      const normalizedQuery = normalizeQuoteHomeJobQuery(queryForLoadedPage)
      const activeOperation = jobsOperationRef.current
      if (!activeOperation || activeOperation.query === normalizedQuery) {
        return
      }

      jobsRequestIdRef.current += 1
      jobPaginationInFlightKeysRef.current.clear()
      setActiveJobsOperation(null)
      setJobsError(null)
    },
    [setActiveJobsOperation]
  )

  const adoptJobsPage = useCallback(
    (nextJobsPage: QuoteHomeJobsPageReadModel) => {
      jobsRequestIdRef.current += 1
      jobPaginationInFlightKeysRef.current.clear()
      setActiveJobsOperation(null)
      setJobsError(null)
      commitJobsPage(nextJobsPage)
    },
    [commitJobsPage, setActiveJobsOperation]
  )

  useEffect(() => {
    activeJobQueryRef.current = activeJobQuery
  }, [activeJobQuery])

  useEffect(() => {
    latestLoadedBootstrapRef.current = bootstrapData
    const syncDecision = resolveQuoteHomeBootstrapJobsSync({
      activeJobQuery: activeJobQueryRef.current,
      bootstrapJobsPage: bootstrapData.jobs,
    })

    if (syncDecision.action === 'keep_active_jobs') {
      return
    }

    adoptJobsPage(syncDecision.jobsPage)
  }, [adoptJobsPage, bootstrapData])

  const loadJobsPage = useCallback(
    async (params: {
      query: string
      cursor?: string | null
      append?: boolean
      reportError?: boolean
      purpose: QuoteHomeJobsRequestPurpose
    }): Promise<QuoteHomeJobsLoadResult> => {
      const normalizedQuery = normalizeQuoteHomeJobQuery(params.query)
      const operation = {
        requestId: ++jobsRequestIdRef.current,
        query: normalizedQuery,
        purpose: params.purpose,
      }
      const reportError = params.reportError ?? true

      setActiveJobsOperation(operation)
      if (reportError) {
        setJobsError(null)
      }

      try {
        const nextPage = await loadQuoteHomeJobs<QuoteHomeJobsPageReadModel>({
          query: normalizedQuery,
          limit: jobsPageRef.current.limit,
          cursor: params.cursor,
        })

        if (!isActiveJobsRequest(operation)) {
          return { ok: false as const, error: null }
        }

        if (reportError) {
          setJobsError(null)
        }

        commitJobsPage(
          resolveQuoteHomeJobsPageAfterRequest({
            currentJobsPage: jobsPageRef.current,
            loadedJobsPage: nextPage,
            mergeMode: params.append ? 'append' : 'replace',
          })
        )

        return { ok: true as const, error: null }
      } catch (loadError) {
        if (!isActiveJobsRequest(operation)) {
          return { ok: false as const, error: null }
        }

        const nextError = toLoadErrorMessage('quote home jobs', loadError)
        if (reportError) {
          setJobsError(nextError)
        }
        return { ok: false as const, error: nextError }
      } finally {
        if (jobsOperationRef.current?.requestId === operation.requestId) {
          setActiveJobsOperation(null)
        }
      }
    },
    [commitJobsPage, isActiveJobsRequest, setActiveJobsOperation]
  )

  useEffect(() => {
    const syncDecision = resolveQuoteHomeQueryJobsSync({
      activeJobQuery,
      currentJobsPage: jobsPageRef.current,
    })

    if (syncDecision.action === 'keep_current_jobs') {
      cancelJobsRequestsForQuery(activeJobQuery)
      return
    }

    void loadJobsPage({ query: syncDecision.query, purpose: 'query_change' })
  }, [activeJobQuery, cancelJobsRequestsForQuery, loadJobsPage])

  const refreshJobs = useCallback(
    async (
      options?: { reportError?: boolean },
      refreshedBootstrap: QuoteHomeBootstrapReadModel = latestLoadedBootstrapRef.current
    ) => {
      const currentQuery = activeJobQueryRef.current
      const refreshDecision = resolveQuoteHomeJobsRefresh({
        activeJobQuery: currentQuery,
        refreshedBootstrapJobsPage: refreshedBootstrap.jobs,
      })

      if (refreshDecision.action === 'adopt_bootstrap_jobs') {
        adoptJobsPage(refreshDecision.jobsPage)
        return { ok: true as const, error: null }
      }

      return loadJobsPage({
        query: refreshDecision.query,
        reportError: options?.reportError,
        purpose: 'refresh',
      })
    },
    [adoptJobsPage, loadJobsPage]
  )

  const loadMoreJobs = useCallback(async () => {
    const currentJobsPage = jobsPageRef.current
    const loadMoreDecision = resolveQuoteHomeLoadMoreJobs({
      currentJobsPage,
      jobsRequestInFlight: Boolean(jobsOperationRef.current),
    })

    if (loadMoreDecision.action === 'skip_load_more') {
      return
    }

    const paginationRequestKey = getJobsPaginationRequestKey(
      loadMoreDecision.query,
      loadMoreDecision.cursor
    )
    if (jobPaginationInFlightKeysRef.current.has(paginationRequestKey)) {
      return
    }

    jobPaginationInFlightKeysRef.current.add(paginationRequestKey)
    try {
      await loadJobsPage({
        query: loadMoreDecision.query,
        cursor: loadMoreDecision.cursor,
        append: true,
        purpose: 'pagination',
      })
    } finally {
      jobPaginationInFlightKeysRef.current.delete(paginationRequestKey)
    }
  }, [loadJobsPage])

  return {
    jobsPage,
    jobs: jobsPage.items,
    jobsLoading: Boolean(jobsOperation),
    jobsError,
    loadMoreJobs,
    hasMoreJobs: Boolean(jobsPage.next_cursor),
    refreshJobs,
  }
}

export function useQuotesHomeData(
  initialData?: QuoteHomeBootstrapReadModel | null,
  options?: UseQuotesHomeDataOptions
) {
  const bootstrapResource = useQuotesHomeBootstrap(initialData)
  const activeJobQuery = normalizeQuoteHomeJobQuery(
    options?.jobQuery ?? bootstrapResource.bootstrapData.jobs.query
  )
  const jobsResource = useQuotesHomeJobs(bootstrapResource.bootstrapData, activeJobQuery)
  const { bootstrapLoading, refreshBootstrap } = bootstrapResource
  const { jobsError, loadMoreJobs, refreshJobs } = jobsResource

  const loadMore = useCallback(async () => {
    if (bootstrapLoading) {
      return
    }

    await loadMoreJobs()
  }, [bootstrapLoading, loadMoreJobs])

  const retryBootstrapThenJobs = useCallback(async () => {
    const bootstrapRefresh = await refreshBootstrap()
    if (!bootstrapRefresh.ok || !bootstrapRefresh.data) {
      return false
    }

    const jobsRefresh = await refreshJobs(undefined, bootstrapRefresh.data)
    return jobsRefresh.ok
  }, [refreshBootstrap, refreshJobs])

  const retryJobsPage = useCallback(async () => {
    const result = await refreshJobs()
    return result.ok
  }, [refreshJobs])

  const retryJobs = useCallback(async () => {
    if (jobsError) {
      return retryJobsPage()
    }

    return retryBootstrapThenJobs()
  }, [jobsError, retryBootstrapThenJobs, retryJobsPage])

  const bootstrap = {
    ...bootstrapResource.bootstrapData,
    jobs: jobsResource.jobsPage,
  }

  return {
    bootstrap,
    summary: bootstrapResource.bootstrapData.summary,
    jobsPage: jobsResource.jobsPage,
    jobs: jobsResource.jobs,
    hasMore: jobsResource.hasMoreJobs,
    initialSelectedJobId: bootstrap.selected_job_id,
    initialSelectedJobVersions: bootstrap.selected_job_versions,
    jobsLoading: jobsResource.jobsLoading,
    loading: bootstrapResource.bootstrapLoading,
    bootstrapError: bootstrapResource.bootstrapError,
    jobsError: jobsResource.jobsError,
    loadMore,
    retryJobs,
    attemptRefresh: async (options?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      const result = await bootstrapResource.refreshBootstrap(options)
      if (!result.ok || !result.data) {
        return {
          ok: false,
          error: result.error,
          data: null,
        }
      }

      const jobsRefresh = await jobsResource.refreshJobs({
        reportError: options?.reportError,
      }, result.data)
      return {
        ok: jobsRefresh.ok,
        error: jobsRefresh.error,
        data: jobsRefresh.ok ? result.data : null,
      }
    },
  }
}
