'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  QuoteHomeBootstrapReadModel,
  QuoteHomeJobVersionCountsReadModel,
  QuoteHomeSummaryReadModel,
} from '@/lib/quotes/collectionData'
import {
  loadQuoteHomeBootstrap,
} from '@/lib/quotes/client'
import { buildQuotesHomeFeedbackVm } from '../_home/quoteHomePresentation'

type QuoteHomeEligibleJob = QuoteHomeBootstrapReadModel['jobs'][number]
type QuoteHomeSliceSource = 'bootstrap'
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

const EMPTY_FAILURES: Record<QuoteHomeSliceSource, QuoteHomeSliceFailure | null> = { bootstrap: null }

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

export function useQuotesHomeData(initialData?: QuoteHomeBootstrapReadModel | null) {
  const [summary, setSummary] = useState<QuoteHomeSummaryReadModel | null>(
    initialData?.summary ?? null
  )
  const [jobCounts, setJobCounts] = useState<QuoteHomeJobVersionCountsReadModel | null>(
    initialData?.jobCounts ?? null
  )
  const [jobs, setJobs] = useState<QuoteHomeEligibleJob[]>(initialData?.jobs ?? [])
  const [loading, setLoading] = useState(!initialData)
  const [failures, setFailures] =
    useState<Record<QuoteHomeSliceSource, QuoteHomeSliceFailure | null>>(EMPTY_FAILURES)
  const requestIdRef = useRef(0)
  const initialDataRef = useRef(initialData)
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

    const [bootstrapResult] = await Promise.allSettled([
      loadQuoteHomeBootstrap<QuoteHomeBootstrapReadModel>(),
    ])

    if (requestIdRef.current !== requestId) return false

    if (bootstrapResult.status === 'fulfilled') {
      setSummary(bootstrapResult.value.summary)
      setJobCounts(bootstrapResult.value.jobCounts)
      setJobs(bootstrapResult.value.jobs)
    } else {
      setSummary(summaryRef.current ?? EMPTY_SUMMARY)
      setJobCounts(jobCountsRef.current ?? EMPTY_JOB_COUNTS)
      setJobs(jobsRef.current)
    }

    const nextFailures = {
      bootstrap: resolveFailure('bootstrap', 'quote home bootstrap', bootstrapResult),
    }

    setFailures(nextFailures)
    setLoading(false)
    return Object.values(nextFailures).every((failure) => failure === null)
  }, [])

  useEffect(() => {
    if (initialDataRef.current) {
      initialDataRef.current = null
      return
    }
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
