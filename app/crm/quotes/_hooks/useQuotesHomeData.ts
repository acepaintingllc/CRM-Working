'use client'

import { useEffect, useState } from 'react'
import { fetchJobList, type JobSummary } from '@/lib/jobs/client'
import { type QuoteHomeData } from '@/lib/quotes/collectionData'
import { loadQuoteHome } from '@/lib/quotes/client'
import {
  filterEligibleQuoteVersionJobs,
  type EligibleQuoteVersionJob,
} from '@/lib/quotes/versionCreation'

type QuoteHomeEligibleJob = EligibleQuoteVersionJob<JobSummary>

export function useQuotesHomeData() {
  const [data, setData] = useState<QuoteHomeData | null>(null)
  const [jobs, setJobs] = useState<QuoteHomeEligibleJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load(active = true) {
    setLoading(true)
    setError(null)
    try {
      const [homePayload, jobsPayload] = await Promise.all([loadQuoteHome<QuoteHomeData>(), fetchJobList()])

      if (!active) return false

      setData(homePayload)
      setJobs(filterEligibleQuoteVersionJobs(jobsPayload))
      return true
    } catch (loadError) {
      if (!active) return false
      setError(loadError instanceof Error ? loadError.message : 'Failed to load quotes home.')
      setData(null)
      setJobs([])
      return false
    } finally {
      if (active) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    void load(active)
    return () => {
      active = false
    }
  }, [])

  return {
    data,
    setData,
    jobs,
    loading,
    error,
    setError,
    refresh: () => load(true),
  }
}
