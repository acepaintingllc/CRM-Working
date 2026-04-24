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
}

export function useQuotesHomeData(
  initialData?: QuoteHomeBootstrapReadModel | null,
  options?: UseQuotesHomeDataOptions
) {
  const resolvedInitialData = initialData ?? EMPTY_BOOTSTRAP
  const activeJobQuery = normalizeQuoteHomeJobQuery(options?.jobQuery ?? resolvedInitialData.jobs.query)
  const latestLoadedBootstrapRef = useRef(resolvedInitialData)
  const activeJobQueryRef = useRef(activeJobQuery)
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
  const setResourceError = resource.setError
  const [jobsPage, setJobsPage] = useState<QuoteHomeJobsPageReadModel>(resolvedInitialData.jobs)
  const [jobsLoading, setJobsLoading] = useState(false)
  const jobsPageRef = useRef(resolvedInitialData.jobs)
  const jobsRequestIdRef = useRef(0)

  const commitJobsPage = useCallback((nextJobsPage: QuoteHomeJobsPageReadModel) => {
    jobsPageRef.current = nextJobsPage
    setJobsPage(nextJobsPage)
  }, [])

  useEffect(() => {
    activeJobQueryRef.current = activeJobQuery
  }, [activeJobQuery])

  useEffect(() => {
    latestLoadedBootstrapRef.current = resource.data
    if (normalizeQuoteHomeJobQuery(resource.data.jobs.query) !== activeJobQueryRef.current) {
      return
    }

    jobsRequestIdRef.current += 1
    setJobsLoading(false)
    commitJobsPage(resource.data.jobs)
  }, [commitJobsPage, resource.data])

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
        setResourceError(null)
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
          setResourceError(null)
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
          setResourceError(nextError)
        }
        return { ok: false as const, error: nextError }
      } finally {
        if (jobsRequestIdRef.current === requestId) {
          setJobsLoading(false)
        }
      }
    },
    [commitJobsPage, setResourceError]
  )

  useEffect(() => {
    if (activeJobQuery === normalizeQuoteHomeJobQuery(jobsPageRef.current.query)) {
      return
    }

    void loadJobsPage({ query: activeJobQuery })
  }, [activeJobQuery, loadJobsPage])

  const refreshActiveJobsPage = useCallback(
    async (
      options?: { reportError?: boolean },
      refreshedBootstrap: QuoteHomeBootstrapReadModel = latestLoadedBootstrapRef.current
    ) => {
      const currentQuery = activeJobQueryRef.current
      const bootstrapQuery = normalizeQuoteHomeJobQuery(refreshedBootstrap.jobs.query)

      if (currentQuery === bootstrapQuery) {
        jobsRequestIdRef.current += 1
        setJobsLoading(false)
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

  const loadMore = useCallback(async () => {
    const currentJobsPage = jobsPageRef.current
    const cursor = currentJobsPage.next_cursor
    if (!cursor || resource.loading || jobsLoading) {
      return
    }

    await loadJobsPage({
      query: currentJobsPage.query,
      cursor,
      append: true,
    })
  }, [jobsLoading, loadJobsPage, resource.loading])

  const bootstrap = {
    ...resource.data,
    jobs: jobsPage,
  }

  return {
    bootstrap,
    summary: resource.data.summary,
    jobsPage,
    jobs: jobsPage.items,
    hasMore: Boolean(jobsPage.next_cursor),
    initialSelectedJobId: bootstrap.selected_job_id,
    initialSelectedJobVersions: bootstrap.selected_job_versions,
    jobsLoading,
    loading: resource.loading,
    bootstrapError: resource.error,
    loadMore,
    refresh: async () => {
      const result = await resource.attemptRefresh()
      if (!result.ok || !result.data) {
        return null
      }

      latestLoadedBootstrapRef.current = result.data
      const jobsRefresh = await refreshActiveJobsPage(undefined, result.data)
      return jobsRefresh.ok ? result.data : null
    },
    attemptRefresh: async (options?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      const result = await resource.attemptRefresh(options)
      if (!result.ok || !result.data) {
        return {
          ok: false,
          error: result.error,
          data: null,
        }
      }

      latestLoadedBootstrapRef.current = result.data
      const jobsRefresh = await refreshActiveJobsPage({
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
