'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeQuoteHomeJobQuery } from '@/lib/quotes/quoteHomeCursors'
import {
  type QuoteHomeBootstrapReadModel,
  type QuoteHomeJobsPageReadModel,
} from '@/lib/quotes/quoteHomeTypes'
import { readLastOpenedQuote } from '@/lib/quotes/lastOpenedQuote'
import { loadQuoteHomeBootstrap } from '@/lib/quotes/client'
import {
  cancelQuotePagedAsyncRequests,
  runQuotePagedAsyncRequest,
  startQuotePagedAsyncRequest,
  type QuotePagedAsyncRequest,
} from './quotePagedAsyncLifecycle'
import { useQuoteHomeJobsPageResource } from './quoteHomeJobsResource'

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
  latest_version: null,
}

function toLoadErrorMessage(scope: string, loadError: unknown) {
  return loadError instanceof Error
    ? loadError.message
    : `Failed to load ${scope}.`
}

export type QuoteHomeRefreshAttemptOptions = {
  preserveDataOnError?: boolean
  reportError?: boolean
}

export type QuoteHomeRefreshAttemptResult<TData = null> = {
  ok: boolean
  error: string | null
  data: TData | null
}

export type QuoteHomeBootstrapResourceContract = {
  bootstrapData: QuoteHomeBootstrapReadModel
  bootstrapLoading: boolean
  bootstrapError: string | null
  refreshBootstrap: (
    options?: QuoteHomeRefreshAttemptOptions,
  ) => Promise<QuoteHomeRefreshAttemptResult<QuoteHomeBootstrapReadModel>>
}

export type QuoteHomeDataResourceContract = {
  bootstrap: QuoteHomeBootstrapReadModel
  summary: QuoteHomeBootstrapReadModel['summary']
  jobsPage: QuoteHomeJobsPageReadModel
  jobs: QuoteHomeJobsPageReadModel['items']
  hasMore: boolean
  initialSelectedJobId: string | null
  initialSelectedJobVersions: QuoteHomeBootstrapReadModel['selected_job_versions']
  latestVersion: QuoteHomeBootstrapReadModel['latest_version']
  jobsLoading: boolean
  loading: boolean
  bootstrapError: string | null
  jobsError: string | null
  loadMore: () => Promise<void>
  retryJobs: () => Promise<boolean>
  attemptRefresh: (
    options?: QuoteHomeRefreshAttemptOptions,
  ) => Promise<QuoteHomeRefreshAttemptResult<QuoteHomeBootstrapReadModel>>
}

type UseQuotesHomeDataOptions = {
  jobQuery?: string
}

type QuoteHomeBootstrapRequest = QuotePagedAsyncRequest<{
  scope: 'bootstrap'
  preserveDataOnError: boolean
  reportError: boolean
}>

export function useQuoteHomeBootstrapResource(
  initialData?: QuoteHomeBootstrapReadModel | null,
): QuoteHomeBootstrapResourceContract {
  const resolvedInitialData = initialData ?? EMPTY_BOOTSTRAP
  const [bootstrapData, setBootstrapData] =
    useState<QuoteHomeBootstrapReadModel>(resolvedInitialData)
  const [bootstrapLoading, setBootstrapLoading] = useState(!initialData)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const lifecycle = useMemo(
    () => ({
      currentRequestRef: { current: 0 },
      activeRequestRef: { current: null as QuoteHomeBootstrapRequest | null },
    }),
    [],
  )

  const refreshBootstrap = useCallback(
    async (
      options?: QuoteHomeRefreshAttemptOptions,
    ): Promise<QuoteHomeRefreshAttemptResult<QuoteHomeBootstrapReadModel>> => {
      const preserveDataOnError = options?.preserveDataOnError ?? true
      const reportError = options?.reportError ?? true
      const request = startQuotePagedAsyncRequest(
        lifecycle,
        {
          scope: 'bootstrap',
          preserveDataOnError,
          reportError,
        },
        () => {
          setBootstrapLoading(true)
          if (reportError) {
            setBootstrapError(null)
          }
        },
        { cancelLoadMore: true },
      )

      const result = await runQuotePagedAsyncRequest(lifecycle, request, {
        load: () => loadQuoteHomeBootstrap<QuoteHomeBootstrapReadModel>(),
        getErrorMessage: (loadError) =>
          toLoadErrorMessage('quote home bootstrap', loadError),
        onSuccess: (_, nextBootstrapData) => {
          setBootstrapData(nextBootstrapData)
          if (reportError) {
            setBootstrapError(null)
          }
        },
        onFailure: (_, error) => {
          if (!preserveDataOnError) {
            setBootstrapData(EMPTY_BOOTSTRAP)
          }
          if (reportError) {
            setBootstrapError(error)
          }
        },
        onFinish: () => setBootstrapLoading(false),
      })

      if (result.ok) {
        return {
          ok: true,
          error: null,
          data: result.data,
        }
      }

      return {
        ok: false,
        error: result.error,
        data: null,
      }
    },
    [lifecycle],
  )

  const didSkipInitialLoadRef = useRef(Boolean(initialData))

  useEffect(() => {
    if (didSkipInitialLoadRef.current) {
      didSkipInitialLoadRef.current = false
      return () => cancelQuotePagedAsyncRequests(lifecycle)
    }

    void refreshBootstrap({ preserveDataOnError: true })

    return () => cancelQuotePagedAsyncRequests(lifecycle)
  }, [lifecycle, refreshBootstrap])

  return {
    bootstrapData,
    bootstrapLoading,
    bootstrapError,
    refreshBootstrap,
  } satisfies QuoteHomeBootstrapResourceContract
}

export function useQuotesHomeData(
  initialData?: QuoteHomeBootstrapReadModel | null,
  options?: UseQuotesHomeDataOptions,
): QuoteHomeDataResourceContract {
  const bootstrapResource = useQuoteHomeBootstrapResource(initialData)
  const [lastOpenedQuote, setLastOpenedQuote] =
    useState<QuoteHomeBootstrapReadModel['latest_version']>(null)

  useEffect(() => {
    setLastOpenedQuote(readLastOpenedQuote(window.localStorage))
  }, [])

  const activeJobQuery = normalizeQuoteHomeJobQuery(
    options?.jobQuery ?? bootstrapResource.bootstrapData.jobs.query,
  )
  const jobsResource = useQuoteHomeJobsPageResource(
    bootstrapResource.bootstrapData,
    activeJobQuery,
  )
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
    latestVersion: lastOpenedQuote ?? bootstrap.latest_version,
    jobsLoading: jobsResource.jobsLoading,
    loading: bootstrapResource.bootstrapLoading,
    bootstrapError: bootstrapResource.bootstrapError,
    jobsError: jobsResource.jobsError,
    loadMore,
    retryJobs,
    attemptRefresh: async (options?: {
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => {
      const result = await bootstrapResource.refreshBootstrap(options)
      if (!result.ok || !result.data) {
        return {
          ok: false,
          error: result.error,
          data: null,
        }
      }

      const jobsRefresh = await jobsResource.refreshJobs(
        {
          reportError: options?.reportError,
        },
        result.data,
      )
      return {
        ok: jobsRefresh.ok,
        error: jobsRefresh.error,
        data: jobsRefresh.ok ? result.data : null,
      }
    },
  } satisfies QuoteHomeDataResourceContract
}

export const useQuotesHomeBootstrap = useQuoteHomeBootstrapResource
export const useQuotesHomeJobs = useQuoteHomeJobsPageResource
export type { QuoteHomeJobsPageResourceContract } from './quoteHomeJobsResource'
export type { QuoteHomeJobsRequestPurpose } from './quoteHomePagePolicy'
