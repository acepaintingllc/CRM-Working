'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  normalizeQuoteHomeJobQuery,
  type QuoteHomeBootstrapReadModel,
  type QuoteHomeJobsPageReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeJobs } from '@/lib/quotes/client'
import {
  cancelQuotePagedAsyncRequests,
  clearQuotePagedAsyncLoadMoreKeys,
  isQuotePagedAsyncRequestCurrent,
  runQuotePagedAsyncLoadMoreKey,
  runQuotePagedAsyncRequest,
  startQuotePagedAsyncRequest,
  useQuotePagedAsyncLifecycle,
} from './quotePagedAsyncLifecycle'
import {
  createQuoteHomeJobsPageState,
  reduceQuoteHomeJobsPageState,
  resolveQuoteHomeBootstrapJobsSync,
  resolveQuoteHomeJobsRefresh,
  resolveQuoteHomeLoadMoreJobs,
  resolveQuoteHomeQueryJobsSync,
  type QuoteHomeJobsPageAction,
  type QuoteHomeJobsPageRequest,
  type QuoteHomeJobsPageState,
  type QuoteHomeJobsRequestPurpose,
} from './quoteHomePagePolicy'

function getJobsPaginationRequestKey(query: string, cursor: string) {
  return JSON.stringify([query, cursor])
}

function toJobsLoadErrorMessage(loadError: unknown) {
  return loadError instanceof Error
    ? loadError.message
    : 'Failed to load quote home jobs.'
}

export type QuoteHomeJobsLoadResult =
  | {
      ok: true
      error: null
    }
  | {
      ok: false
      error: string | null
    }

export type QuoteHomeJobsPageResourceContract = {
  jobsPage: QuoteHomeJobsPageReadModel
  jobs: QuoteHomeJobsPageReadModel['items']
  jobsLoading: boolean
  jobsError: string | null
  loadMoreJobs: () => Promise<void>
  hasMoreJobs: boolean
  refreshJobs: (
    options?: { reportError?: boolean },
    refreshedBootstrap?: QuoteHomeBootstrapReadModel,
  ) => Promise<QuoteHomeJobsLoadResult>
}

export function useQuoteHomeJobsPageResource(
  bootstrapData: QuoteHomeBootstrapReadModel,
  query?: string,
): QuoteHomeJobsPageResourceContract {
  const activeJobQuery = normalizeQuoteHomeJobQuery(
    query ?? bootstrapData.jobs.query,
  )
  const latestLoadedBootstrapRef = useRef(bootstrapData)
  const activeJobQueryRef = useRef(activeJobQuery)
  const jobsStateRef = useRef<QuoteHomeJobsPageState>(
    createQuoteHomeJobsPageState(bootstrapData.jobs),
  )
  const [jobsState, dispatchBaseJobsAction] = useReducer(
    reduceQuoteHomeJobsPageState,
    bootstrapData.jobs,
    createQuoteHomeJobsPageState,
  )
  // The reducer tracks the active request; this cursor gate coalesces duplicate
  // load-more calls for the same page before React has committed a render.
  const jobPaginationInFlightKeysRef = useRef(new Set<string>())
  const jobsLifecycle = useQuotePagedAsyncLifecycle<QuoteHomeJobsPageRequest>()

  const dispatchJobsAction = useCallback((action: QuoteHomeJobsPageAction) => {
    jobsStateRef.current = reduceQuoteHomeJobsPageState(
      jobsStateRef.current,
      action,
    )
    dispatchBaseJobsAction(action)
  }, [])

  const cancelActiveJobsRequest = useCallback(() => {
    cancelQuotePagedAsyncRequests(jobsLifecycle)
    clearQuotePagedAsyncLoadMoreKeys(jobPaginationInFlightKeysRef)
    dispatchJobsAction({ type: 'request_cancelled' })
  }, [dispatchJobsAction, jobsLifecycle])

  const startJobsRequest = useCallback(
    (params: {
      query: string
      purpose: QuoteHomeJobsRequestPurpose
      reportError: boolean
    }): QuoteHomeJobsPageRequest => {
      return startQuotePagedAsyncRequest(
        jobsLifecycle,
        {
          query: normalizeQuoteHomeJobQuery(params.query),
          purpose: params.purpose,
          reportError: params.reportError,
        },
        (request) => dispatchJobsAction({ type: 'request_started', request }),
      )
    },
    [dispatchJobsAction, jobsLifecycle],
  )

  const isActiveJobsRequest = useCallback(
    (request: QuoteHomeJobsPageRequest) => {
      return (
        isQuotePagedAsyncRequestCurrent(jobsLifecycle, request) &&
        activeJobQueryRef.current === request.query
      )
    },
    [jobsLifecycle],
  )

  const cancelJobsRequestsForQuery = useCallback(
    (queryForLoadedPage: string) => {
      const normalizedQuery = normalizeQuoteHomeJobQuery(queryForLoadedPage)
      const activeRequest = jobsStateRef.current.activeRequest
      if (!activeRequest || activeRequest.query === normalizedQuery) {
        return
      }

      cancelActiveJobsRequest()
    },
    [cancelActiveJobsRequest],
  )

  const adoptJobsPage = useCallback(
    (nextJobsPage: QuoteHomeJobsPageReadModel) => {
      cancelQuotePagedAsyncRequests(jobsLifecycle)
      clearQuotePagedAsyncLoadMoreKeys(jobPaginationInFlightKeysRef)
      dispatchJobsAction({
        type: 'adopt_bootstrap_jobs',
        jobsPage: nextJobsPage,
      })
    },
    [dispatchJobsAction, jobsLifecycle],
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
      const reportError = params.reportError ?? true
      const request = startJobsRequest({
        query: normalizedQuery,
        purpose: params.purpose,
        reportError,
      })

      const result = await runQuotePagedAsyncRequest(jobsLifecycle, request, {
        isCurrent: isActiveJobsRequest,
        getErrorMessage: toJobsLoadErrorMessage,
        load: () =>
          loadQuoteHomeJobs<QuoteHomeJobsPageReadModel>({
            query: normalizedQuery,
            limit: jobsStateRef.current.jobsPage.limit,
            cursor: params.cursor,
          }),
        onSuccess: (completedRequest, nextPage) =>
          dispatchJobsAction({
            type: 'request_succeeded',
            request: completedRequest,
            loadedJobsPage: nextPage,
            mergeMode: params.append ? 'append' : 'replace',
          }),
        onFailure: (failedRequest, error) =>
          dispatchJobsAction({
            type: 'request_failed',
            request: failedRequest,
            error,
          }),
        onFinish: (finishedRequest) =>
          dispatchJobsAction({
            type: 'request_finished',
            request: finishedRequest,
          }),
      })

      return result.ok
        ? { ok: true as const, error: null }
        : { ok: false as const, error: result.error }
    },
    [dispatchJobsAction, isActiveJobsRequest, jobsLifecycle, startJobsRequest],
  )

  useEffect(() => {
    const syncDecision = resolveQuoteHomeQueryJobsSync({
      activeJobQuery,
      currentJobsPage: jobsStateRef.current.jobsPage,
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
      refreshedBootstrap: QuoteHomeBootstrapReadModel = latestLoadedBootstrapRef.current,
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
    [adoptJobsPage, loadJobsPage],
  )

  const loadMoreJobs = useCallback(async () => {
    const currentJobsPage = jobsStateRef.current.jobsPage
    const loadMoreDecision = resolveQuoteHomeLoadMoreJobs({
      currentJobsPage,
      jobsRequestInFlight: Boolean(jobsStateRef.current.activeRequest),
    })

    if (loadMoreDecision.action === 'skip_load_more') {
      return
    }

    const paginationRequestKey = getJobsPaginationRequestKey(
      loadMoreDecision.query,
      loadMoreDecision.cursor,
    )

    await runQuotePagedAsyncLoadMoreKey(
      jobPaginationInFlightKeysRef,
      paginationRequestKey,
      () =>
        loadJobsPage({
          query: loadMoreDecision.query,
          cursor: loadMoreDecision.cursor,
          append: true,
          purpose: 'pagination',
        }),
    )
  }, [loadJobsPage])

  return {
    jobsPage: jobsState.jobsPage,
    jobs: jobsState.jobsPage.items,
    jobsLoading: Boolean(jobsState.activeRequest),
    jobsError: jobsState.error,
    loadMoreJobs,
    hasMoreJobs: Boolean(jobsState.jobsPage.next_cursor),
    refreshJobs,
  } satisfies QuoteHomeJobsPageResourceContract
}
