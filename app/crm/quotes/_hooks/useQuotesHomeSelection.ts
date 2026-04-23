'use client'

import { useEffect, useMemo, useState } from 'react'
import { type EligibleQuoteVersionJob } from '@/lib/quotes/versionCreation'
import type { QuoteHomeJobVersionCountsReadModel } from '@/lib/quotes/collectionData'

type Options<TJob extends EligibleQuoteVersionJob> = {
  jobCounts: QuoteHomeJobVersionCountsReadModel
  jobs: TJob[]
}

type SearchableQuoteHomeJob = EligibleQuoteVersionJob & {
  title: string
  customer_name: string | null
  customer_address: string | null
}

export function useQuotesHomeSelection<TJob extends SearchableQuoteHomeJob>({
  jobCounts,
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

  const filteredJobs = useMemo(() => {
    const q = jobQuery.trim().toLowerCase()
    if (!q) return jobs
    return jobs.filter((job) => {
      const haystack = `${job.title} ${job.customer_name ?? ''} ${job.customer_address ?? ''}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [jobQuery, jobs])

  const versionCountByJob = useMemo(() => {
    return jobCounts.items.reduce<Record<string, number>>((counts, item) => {
      counts[item.job_id] = item.version_count
      return counts
    }, {})
  }, [jobCounts.items])

  return {
    searchQuery,
    setSearchQuery,
    searchFocused,
    setSearchFocused,
    jobQuery,
    setJobQuery,
    selectedJobId,
    setSelectedJobId,
    selectedJob,
    filteredJobs,
    versionCountByJob,
  }
}
