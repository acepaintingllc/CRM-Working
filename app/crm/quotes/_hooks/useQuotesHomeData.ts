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
import { buildQuotesHomeFeedbackVm } from '../_home/quoteHomePresentation'

type QuoteHomeEligibleJob = EligibleQuoteVersionJob<JobSummary>
type QuoteHomeSliceSource = 'summary' | 'jobCounts' | 'jobs'
type QuoteHomeSliceFailure = {
  source: QuoteHomeSliceSource
  message: string
}

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

const EMPTY_FAILURES: Record<QuoteHomeSliceSource, QuoteHomeSliceFailure | null> = {
  summary: null,
  jobCounts: null,
  jobs: null,
}

function toLoadErrorMessage(scope: string, loadError: unknown) {
  return loadError instanceof Error ? loadError.message : `Failed to load ${scope}.`
}

function resolveFailure(
  source: QuoteHomeSliceSource,
  scope: string,
  result: PromiseSettledResult<unknown>
): QuoteHomeSliceFailure | null {
  if (result.status !== 'rejected') return null

  return {
    source,
    message: toLoadErrorMessage(scope, result.reason),
  }
}

export function useQuotesHomeData() {
  const [summary, setSummary] = useState<QuoteHomeSummaryReadModel | null>(null)
  const [jobCounts, setJobCounts] = useState<QuoteHomeJobVersionCountsReadModel | null>(null)
  const [jobs, setJobs] = useState<QuoteHomeEligibleJob[]>([])
  const [loading, setLoading] = useState(true)
  const [failures, setFailures] =
    useState<Record<QuoteHomeSliceSource, QuoteHomeSliceFailure | null>>(EMPTY_FAILURES)
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
    setFailures(EMPTY_FAILURES)

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

    const nextFailures = {
      summary: resolveFailure('summary', 'quote summary', summaryResult),
      jobCounts: resolveFailure('jobCounts', 'quote job counts', jobCountsResult),
      jobs: resolveFailure('jobs', 'eligible jobs', jobsResult),
    }

    setFailures(nextFailures)
    setLoading(false)
    return Object.values(nextFailures).every((failure) => failure === null)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return useMemo(() => {
    const homeFailures = Object.values(failures).filter(
      (failure): failure is QuoteHomeSliceFailure => failure !== null
    )

    return {
      summary: summary ?? EMPTY_SUMMARY,
      jobCounts: jobCounts ?? EMPTY_JOB_COUNTS,
      jobs,
      loading,
      failures,
      feedback: buildQuotesHomeFeedbackVm({
        homeFailures,
        jobVersionsError: null,
        createError: null,
        deleteError: null,
      }),
      refresh,
    }
  }, [failures, jobCounts, jobs, loading, refresh, summary])
}
