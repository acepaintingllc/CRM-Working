'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  deriveQuoteVersionsForJob,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'
import { buildSearchHaystack, buildSummaryCards } from '../_home/quoteHomePresentation'
import type { QuoteHomeData, QuoteHomeEstimate } from '@/lib/quotes/collectionData'

type Options<TJob extends EligibleQuoteVersionJob> = {
  data: QuoteHomeData | null
  jobs: TJob[]
}

type SearchableQuoteHomeJob = EligibleQuoteVersionJob & {
  title: string
  customer_name: string | null
  customer_address: string | null
}

export function useQuotesHomeSelection<TJob extends SearchableQuoteHomeJob>({
  data,
  jobs,
}: Options<TJob>) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [jobQuery, setJobQuery] = useState('')
  const [selectedJobId, setSelectedJobId] = useState('')

  useEffect(() => {
    setSelectedJobId((current) => {
      if (current && jobs.some((job) => job.id === current)) return current
      return jobs[0]?.id ?? ''
    })
  }, [jobs])

  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const summaryCards = useMemo(() => buildSummaryCards(data), [data])

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return [] as QuoteHomeEstimate[]
    return (data?.search_estimates ?? [])
      .filter((estimate) => buildSearchHaystack(estimate).includes(q))
      .slice(0, 8)
  }, [data, searchQuery])

  const heroSummaryText = data
    ? `${data.search_estimates.length} total versions | ${data.summary.draft_count} drafts | ${data.summary.sent_or_awaiting_count} sent/awaiting | ${data.summary.live_count} live`
    : 'Build and track quote versions with live status, totals, and search.'

  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((job) => {
      const haystack = `${job.title} ${job.customer_name ?? ''} ${job.customer_address ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [jobQuery, jobs])

  const selectedJobVersions = useMemo(
    () => deriveQuoteVersionsForJob(data?.search_estimates ?? [], selectedJobId),
    [data, selectedJobId]
  )

  const versionCountByJob = useMemo(() => {
    const map: Record<string, number> = {}
    for (const estimate of data?.search_estimates ?? []) {
      map[estimate.job_id] = (map[estimate.job_id] ?? 0) + 1
    }
    return map
  }, [data])

  const mobileSummaryCards = useMemo(
    () => [summaryCards[0], summaryCards[3]].filter(Boolean),
    [summaryCards]
  )

  return {
    searchQuery,
    setSearchQuery,
    searchFocused,
    setSearchFocused,
    searchResults,
    heroSummaryText,
    jobQuery,
    setJobQuery,
    selectedJobId,
    setSelectedJobId,
    selectedJob,
    filteredJobs,
    selectedJobVersions,
    versionCountByJob,
    summaryCards,
    mobileSummaryCards,
  }
}
