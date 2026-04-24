'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useResource } from '@/app/crm/_hooks/useResource'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobsPageReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeBootstrap, loadQuoteHomeJobs } from '@/lib/quotes/client'

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

export function useQuotesHomeData(initialData?: QuoteHomeBootstrapReadModel | null) {
  const resolvedInitialData = initialData ?? EMPTY_BOOTSTRAP
  const latestLoadedBootstrapRef = useRef(resolvedInitialData)
  const resource = useResource<QuoteHomeBootstrapReadModel>({
    initialData: resolvedInitialData,
    initialLoading: !initialData,
    skipInitialLoad: Boolean(initialData),
    resetOnError: false,
    load: async () => {
      const nextBootstrap = await loadQuoteHomeBootstrap<QuoteHomeBootstrapReadModel>()
      latestLoadedBootstrapRef.current = nextBootstrap
      return nextBootstrap
    },
    getErrorMessage: (loadError) => toLoadErrorMessage('quote home bootstrap', loadError),
  })
  const [jobsPage, setJobsPage] = useState<QuoteHomeJobsPageReadModel>(resolvedInitialData.jobs)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadMoreRequestIdRef = useRef(0)

  useEffect(() => {
    loadMoreRequestIdRef.current += 1
    setJobsPage(resource.data.jobs)
    setLoadingMore(false)
  }, [resource.data.jobs])

  const loadMore = useCallback(async () => {
    const cursor = jobsPage.next_cursor
    if (!cursor || resource.loading || loadingMore) {
      return
    }

    const requestId = ++loadMoreRequestIdRef.current
    setLoadingMore(true)

    try {
      const nextPage = await loadQuoteHomeJobs<QuoteHomeJobsPageReadModel>({
        query: jobsPage.query,
        limit: jobsPage.limit,
        cursor,
      })

      if (loadMoreRequestIdRef.current !== requestId) {
        return
      }

      resource.setError(null)
      setJobsPage((current) => {
        const existingIds = new Set(current.items.map((job) => job.id))
        return {
          ...nextPage,
          items: [
            ...current.items,
            ...nextPage.items.filter((job) => !existingIds.has(job.id)),
          ],
        }
      })
    } catch (loadError) {
      if (loadMoreRequestIdRef.current !== requestId) {
        return
      }
      resource.setError(toLoadErrorMessage('quote home jobs', loadError))
    } finally {
      if (loadMoreRequestIdRef.current === requestId) {
        setLoadingMore(false)
      }
    }
  }, [
    jobsPage.limit,
    jobsPage.next_cursor,
    jobsPage.query,
    loadingMore,
    resource.loading,
    resource.setError,
  ])

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
    loading: resource.loading,
    bootstrapError: resource.error,
    loadMore,
    refresh: async () => {
      const ok = await resource.refresh()
      return ok ? latestLoadedBootstrapRef.current : null
    },
    attemptRefresh: async (options?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      const result = await resource.attemptRefresh(options)
      return {
        ok: result.ok,
        error: result.error,
        data: result.ok ? latestLoadedBootstrapRef.current : null,
      }
    },
  }
}
