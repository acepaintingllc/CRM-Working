'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobsPageReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeBootstrap, loadQuoteHomeJobs } from '@/lib/quotes/client'
import { normalizeQuoteHomeJobQuery } from './quoteHomePagePolicy'

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
  return loadError instanceof Error ? loadError.message : `Failed to load ${scope}.`
}

type UseQuotesHomeDataOptions = {
  jobQuery?: string
  onJobsChange?: (jobs: QuoteHomeJobsPageReadModel['items']) => void
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
  const [jobsLoading, setJobsLoading] = useState(false)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const jobsPageRef = useRef(bootstrapData.jobs)
  const jobsRequestIdRef = useRef(0)

  const commitJobsPage = useCallback((nextJobsPage: QuoteHomeJobsPageReadModel) => {
    jobsPageRef.current = nextJobsPage
    setJobsPage(nextJobsPage)
  }, [])

  useEffect(() => {
    activeJobQueryRef.current = activeJobQuery
  }, [activeJobQuery])

  useEffect(() => {
    latestLoadedBootstrapRef.current = bootstrapData
    if (normalizeQuoteHomeJobQuery(bootstrapData.jobs.query) !== activeJobQueryRef.current) {
      return
    }

    jobsRequestIdRef.current += 1
    setJobsLoading(false)
    setJobsError(null)
    commitJobsPage(bootstrapData.jobs)
  }, [bootstrapData, commitJobsPage])

  const loadJobsPage = useCallback(
    async (params: {
      query: string
      cursor?: string | null
      append?: boolean
      reportError?: boolean
    }) => {
      const requestId = ++jobsRequestIdRef.current
      const reportError = params.reportError ?? true

      setJobsLoading(true)
      if (reportError) {
        setJobsError(null)
      }

      try {
        const nextPage = await loadQuoteHomeJobs<QuoteHomeJobsPageReadModel>({
          query: params.query,
          limit: jobsPageRef.current.limit,
          cursor: params.cursor,
        })

        if (jobsRequestIdRef.current !== requestId) {
          return { ok: false as const, error: null }
        }

        if (reportError) {
          setJobsError(null)
        }

        if (params.append) {
          const existingIds = new Set(jobsPageRef.current.items.map((job) => job.id))
          commitJobsPage({
            ...nextPage,
            items: [
              ...jobsPageRef.current.items,
              ...nextPage.items.filter((job) => !existingIds.has(job.id)),
            ],
          })
        } else {
          commitJobsPage(nextPage)
        }

        return { ok: true as const, error: null }
      } catch (loadError) {
        if (jobsRequestIdRef.current !== requestId) {
          return { ok: false as const, error: null }
        }

        const nextError = toLoadErrorMessage('quote home jobs', loadError)
        if (reportError) {
          setJobsError(nextError)
        }
        return { ok: false as const, error: nextError }
      } finally {
        if (jobsRequestIdRef.current === requestId) {
          setJobsLoading(false)
        }
      }
    },
    [commitJobsPage]
  )

  useEffect(() => {
    if (activeJobQuery === normalizeQuoteHomeJobQuery(jobsPageRef.current.query)) {
      return
    }

    void loadJobsPage({ query: activeJobQuery })
  }, [activeJobQuery, loadJobsPage])

  const refreshJobs = useCallback(
    async (
      options?: { reportError?: boolean },
      refreshedBootstrap: QuoteHomeBootstrapReadModel = latestLoadedBootstrapRef.current
    ) => {
      const currentQuery = activeJobQueryRef.current
      const bootstrapQuery = normalizeQuoteHomeJobQuery(refreshedBootstrap.jobs.query)

      if (currentQuery === bootstrapQuery) {
        jobsRequestIdRef.current += 1
        setJobsLoading(false)
        setJobsError(null)
        commitJobsPage(refreshedBootstrap.jobs)
        return { ok: true as const, error: null }
      }

      return loadJobsPage({
        query: currentQuery,
        reportError: options?.reportError,
      })
    },
    [commitJobsPage, loadJobsPage]
  )

  const loadMoreJobs = useCallback(async () => {
    const currentJobsPage = jobsPageRef.current
    const cursor = currentJobsPage.next_cursor
    if (!cursor || jobsLoading) {
      return
    }

    await loadJobsPage({
      query: currentJobsPage.query,
      cursor,
      append: true,
    })
  }, [jobsLoading, loadJobsPage])

  return {
    jobsPage,
    jobs: jobsPage.items,
    jobsLoading,
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
  const onJobsChangeRef = useRef(options?.onJobsChange ?? null)
  const bootstrapResource = useQuotesHomeBootstrap(initialData)
  const activeJobQuery = normalizeQuoteHomeJobQuery(
    options?.jobQuery ?? bootstrapResource.bootstrapData.jobs.query
  )
  const jobsResource = useQuotesHomeJobs(bootstrapResource.bootstrapData, activeJobQuery)
  const { bootstrapLoading } = bootstrapResource
  const { loadMoreJobs } = jobsResource

  useEffect(() => {
    onJobsChangeRef.current = options?.onJobsChange ?? null
  }, [options?.onJobsChange])

  useEffect(() => {
    onJobsChangeRef.current?.(jobsResource.jobs)
  }, [jobsResource.jobs])

  const loadMore = useCallback(async () => {
    if (bootstrapLoading) {
      return
    }

    await loadMoreJobs()
  }, [bootstrapLoading, loadMoreJobs])

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
    bootstrapError: bootstrapResource.bootstrapError ?? jobsResource.jobsError,
    loadMore,
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
