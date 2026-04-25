'use client'

import { useCallback } from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import {
  normalizeQuoteHomeJobQuery,
  type QuoteHomeBootstrapReadModel,
  type QuoteHomeJobsPageReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeBootstrap } from '@/lib/quotes/client'
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

export function useQuoteHomeBootstrapResource(
  initialData?: QuoteHomeBootstrapReadModel | null,
): QuoteHomeBootstrapResourceContract {
  const resolvedInitialData = initialData ?? EMPTY_BOOTSTRAP
  const resource = useResource<QuoteHomeBootstrapReadModel>({
    initialData: resolvedInitialData,
    initialLoading: !initialData,
    skipInitialLoad: Boolean(initialData),
    resetOnError: false,
    load: async () => {
      return loadQuoteHomeBootstrap<QuoteHomeBootstrapReadModel>()
    },
    getErrorMessage: (loadError) =>
      toLoadErrorMessage('quote home bootstrap', loadError),
  })

  return {
    bootstrapData: resource.data,
    bootstrapLoading: resource.loading,
    bootstrapError: resource.error,
    refreshBootstrap: resource.attemptRefresh,
  } satisfies QuoteHomeBootstrapResourceContract
}

export function useQuotesHomeData(
  initialData?: QuoteHomeBootstrapReadModel | null,
  options?: UseQuotesHomeDataOptions,
): QuoteHomeDataResourceContract {
  const bootstrapResource = useQuoteHomeBootstrapResource(initialData)
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
