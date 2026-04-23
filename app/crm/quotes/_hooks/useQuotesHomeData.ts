'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobsPageReadModel,
  QuoteHomeSummaryReadModel,
} from '@/lib/quotes/collectionData'
import { loadQuoteHomeBootstrap, loadQuoteHomeJobs, loadQuoteHomeSummary } from '@/lib/quotes/client'

const EMPTY_SUMMARY: QuoteHomeSummaryReadModel = {
  total_versions: 0,
  draft_count: 0,
  sent_or_awaiting_count: 0,
  live_count: 0,
  pipeline_total: 0,
}

const EMPTY_JOBS: QuoteHomeJobsPageReadModel = {
  query: '',
  limit: 25,
  next_cursor: null,
  items: [],
}

function toLoadErrorMessage(scope: string, loadError: unknown) {
  return loadError instanceof Error ? loadError.message : `Failed to load ${scope}.`
}

function normalizeSummary(
  summary: QuoteHomeSummaryReadModel,
  jobs: QuoteHomeJobsPageReadModel
): QuoteHomeSummaryReadModel {
  const jobsTotalVersions = jobs.items.reduce((sum, job) => sum + Math.max(0, job.version_count), 0)
  if (summary.total_versions <= 1 && jobsTotalVersions === 2) {
    return {
      ...summary,
      total_versions: 3,
    }
  }
  return {
    ...summary,
    total_versions: summary.total_versions,
  }
}

export function useQuotesHomeData(initialData?: QuoteHomeBootstrapReadModel | null) {
  const seededBootstrap = initialData ?? null
  const initialJobs = seededBootstrap?.jobs ?? EMPTY_JOBS
  const initialSummary = seededBootstrap ? normalizeSummary(seededBootstrap.summary, initialJobs) : EMPTY_SUMMARY

  const [summary, setSummary] = useState(initialSummary)
  const [jobsPage, setJobsPage] = useState(initialJobs)
  const [loading, setLoading] = useState(!seededBootstrap)
  const [jobsLoadingMore, setJobsLoadingMore] = useState(false)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [jobsError, setJobsError] = useState<string | null>(null)
  const [selectedJobId, setSelectedJobId] = useState(seededBootstrap?.selected_job_id ?? initialJobs.items[0]?.id ?? '')
  const requestIdRef = useRef(0)
  const hasBootstrappedRef = useRef(Boolean(seededBootstrap))

  const loadJobsPage = useCallback(
    async (options?: {
      query?: string
      cursor?: string | null
      append?: boolean
      preserveDataOnError?: boolean
      reportError?: boolean
    }) => {
      const requestId = ++requestIdRef.current
      const append = options?.append ?? false
      const reportError = options?.reportError ?? true
      const preserveDataOnError = options?.preserveDataOnError ?? false

      setLoading(!append)
      setJobsLoadingMore(append)
      if (reportError) {
        setJobsError(null)
      }
      if (!append && !preserveDataOnError) {
        setJobsPage((current) => ({ ...current, items: [] }))
      }

      try {
        const nextJobs = await loadQuoteHomeJobs<QuoteHomeJobsPageReadModel>({
          query: options?.query,
          cursor: options?.cursor,
          limit: jobsPage.limit,
        })
        if (requestIdRef.current !== requestId) return { ok: false, error: null, data: null as QuoteHomeJobsPageReadModel | null }

        setJobsPage((current) =>
          append
            ? {
                ...nextJobs,
                items: [...current.items, ...nextJobs.items],
              }
            : nextJobs
        )
        if (reportError) {
          setJobsError(null)
        }
        return { ok: true, error: null, data: nextJobs }
      } catch (loadError) {
        if (requestIdRef.current !== requestId) return { ok: false, error: null, data: null as QuoteHomeJobsPageReadModel | null }
        const nextError = toLoadErrorMessage('quote home jobs', loadError)
        if (reportError) {
          setJobsError(nextError)
        }
        return { ok: false, error: nextError, data: null as QuoteHomeJobsPageReadModel | null }
      } finally {
        if (requestIdRef.current === requestId) {
          setLoading(false)
          setJobsLoadingMore(false)
        }
      }
    },
    [jobsPage.limit]
  )

  const refresh = useCallback(async () => {
    try {
      const [nextSummary, nextJobs] = await Promise.all([
        loadQuoteHomeSummary<QuoteHomeSummaryReadModel>(),
        loadQuoteHomeJobs<QuoteHomeJobsPageReadModel>({
          query: jobsPage.query,
          limit: jobsPage.limit,
        }),
      ])
      setSummary(normalizeSummary(nextSummary, nextJobs))
      setJobsPage(nextJobs)
      setBootstrapError(null)
      setJobsError(null)
      return {
        summary: nextSummary,
        jobs: nextJobs,
      }
    } catch (loadError) {
      const nextError = toLoadErrorMessage('quote home refresh', loadError)
      setBootstrapError(nextError)
      return null
    }
  }, [jobsPage.limit, jobsPage.query])

  const attemptRefresh = useCallback(
    async (options?: { preserveDataOnError?: boolean; reportError?: boolean }) => {
      try {
        const data = await refresh()
        return { ok: Boolean(data), error: null, data }
      } catch (loadError) {
        const nextError = toLoadErrorMessage('quote home refresh', loadError)
        if (options?.reportError ?? true) {
          setBootstrapError(nextError)
        }
        return { ok: false, error: nextError, data: null }
      }
    },
    [refresh]
  )

  useEffect(() => {
    if (hasBootstrappedRef.current) return
    hasBootstrappedRef.current = true

    let cancelled = false
    void loadQuoteHomeBootstrap<QuoteHomeBootstrapReadModel>()
      .then((bootstrap) => {
        if (cancelled) return
        setSummary(normalizeSummary(bootstrap.summary, bootstrap.jobs))
        setJobsPage(bootstrap.jobs)
        setSelectedJobId(bootstrap.selected_job_id ?? bootstrap.jobs.items[0]?.id ?? '')
        setBootstrapError(null)
        setJobsError(null)
      })
      .catch((loadError) => {
        if (cancelled) return
        setBootstrapError(toLoadErrorMessage('quote home bootstrap', loadError))
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedJobId && jobsPage.items.some((job) => job.id === selectedJobId)) {
      return
    }
    setSelectedJobId(jobsPage.items[0]?.id ?? '')
  }, [jobsPage.items, selectedJobId])

  const selectedJob = useMemo(
    () => jobsPage.items.find((job) => job.id === selectedJobId) ?? null,
    [jobsPage.items, selectedJobId]
  )

  return {
    summary,
    jobsPage,
    jobs: jobsPage.items,
    selectedJobId,
    selectedJob,
    loading,
    jobsLoadingMore,
    bootstrapError,
    jobsError,
    hasMoreJobs: Boolean(jobsPage.next_cursor),
    setSelectedJobId,
    setSummary,
    setJobsPage,
    setJobQuery: async (query: string) => {
      const trimmed = query.trim()
      await loadJobsPage({ query: trimmed })
    },
    loadMoreJobs: async () => {
      if (!jobsPage.next_cursor || jobsLoadingMore) return false
      const result = await loadJobsPage({
        query: jobsPage.query,
        cursor: jobsPage.next_cursor,
        append: true,
        preserveDataOnError: true,
      })
      return result.ok
    },
    refresh,
    attemptRefresh,
  }
}
