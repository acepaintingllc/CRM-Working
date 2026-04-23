'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchJobList, type JobSummary } from '@/lib/jobs/client'
import type {
  QuoteHomeJobVersionCountsReadModel,
  QuoteHomeSummaryReadModel,
} from '@/lib/quotes/collectionData'
import {
  loadQuoteHomeJobCounts,
  loadQuoteHomeSummary,
} from '@/lib/quotes/client'
import {
  filterEligibleQuoteVersionJobs,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'

type QuoteHomeEligibleJob = EligibleQuoteVersionJob<JobSummary>

const EMPTY_SUMMARY: QuoteHomeSummaryReadModel = {
  total_versions: 0,
  draft_count: 0,
  sent_or_awaiting_count: 0,
  live_count: 0,
  pipeline_total: 0,
}

const EMPTY_JOB_COUNTS: QuoteHomeJobVersionCountsReadModel = {
  items: [],
}

function toLoadErrorMessage(scope: string, loadError: unknown) {
  return loadError instanceof Error ? loadError.message : `Failed to load ${scope}.`
}

export function useQuotesHomeData() {
  const [summary, setSummary] = useState<QuoteHomeSummaryReadModel | null>(null)
  const [jobCounts, setJobCounts] = useState<QuoteHomeJobVersionCountsReadModel | null>(null)
  const [jobs, setJobs] = useState<QuoteHomeEligibleJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const summaryRef = useRef<QuoteHomeSummaryReadModel | null>(null)
  const jobCountsRef = useRef<QuoteHomeJobVersionCountsReadModel | null>(null)
  const jobsRef = useRef<QuoteHomeEligibleJob[]>([])

  useEffect(() => {
    summaryRef.current = summary
  }, [summary])

  useEffect(() => {
    jobCountsRef.current = jobCounts
  }, [jobCounts])

  useEffect(() => {
    jobsRef.current = jobs
  }, [jobs])

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)

    // Keep the last successful values per slice so a partial reload failure
    // does not blank unrelated home panels.
    const [summaryResult, jobCountsResult, jobsResult] =
      await Promise.allSettled([
        loadQuoteHomeSummary<QuoteHomeSummaryReadModel>(),
        loadQuoteHomeJobCounts<QuoteHomeJobVersionCountsReadModel>(),
        fetchJobList(),
      ])

    if (requestIdRef.current !== requestId) return false

    setSummary(
      summaryResult.status === 'fulfilled'
        ? summaryResult.value
        : (summaryRef.current ?? EMPTY_SUMMARY)
    )
    setJobCounts(
      jobCountsResult.status === 'fulfilled'
        ? jobCountsResult.value
        : (jobCountsRef.current ?? EMPTY_JOB_COUNTS)
    )
    setJobs(
      jobsResult.status === 'fulfilled'
        ? filterEligibleQuoteVersionJobs(jobsResult.value)
        : jobsRef.current
    )

    const nextErrors = [
      summaryResult.status === 'rejected'
        ? toLoadErrorMessage('quote summary', summaryResult.reason)
        : null,
      jobCountsResult.status === 'rejected'
        ? toLoadErrorMessage('quote job counts', jobCountsResult.reason)
        : null,
      jobsResult.status === 'rejected'
        ? toLoadErrorMessage('eligible jobs', jobsResult.reason)
        : null,
    ].filter(Boolean)

    setError(nextErrors.length > 0 ? nextErrors.join(' ') : null)
    setLoading(false)
    return nextErrors.length === 0
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return useMemo(
    () => ({
      summary: summary ?? EMPTY_SUMMARY,
      jobCounts: jobCounts ?? EMPTY_JOB_COUNTS,
      jobs,
      loading,
      error,
      setError,
      refresh,
    }),
    [error, jobCounts, jobs, loading, refresh, summary]
  )
}
